// CBBTC Momentum Race Bot — a mean-reversion dip-buyer for make.fun's
// "Race a BTC trading bot live for 24 hours" (btc-race-24h-20261117-0603).
//
// Idea
// ----
// On 1-minute cbBTC bars the 60-minute return mean-reverts: on the published
// dev window, adjacent non-overlapping 60-minute returns correlate about
// -0.37 (about -0.44 in the first half of the day, -0.29 in the second), and
// after a 60-minute drop of 100 bps or more the next 60 minutes average
// +40 bps, against +1 bp unconditionally. A full round trip costs about
// 26 bps in fees, slippage and price impact, so the edge only pays when the
// dip is deep and the exit is patient. Trend-following breakouts were tried
// first and lose on this market: every Donchian variant graded negative on
// the dev window, whipsawed by 1-minute noise.
//
// Rules (all comparisons exact bigint arithmetic on the raw closes, so two
// runs on the same bars produce byte-identical action logs)
// ---------------------------------------------------------------------------
//   - Entry: flat and the latest close is at least ENTRY_BPS (100 bps)
//     below the close 60 bars ago: buy with the whole cash balance.
//   - Exit the whole position when any of these holds at a bar's close:
//       * its value is TP_BPS (120 bps) above its cost (take profit),
//       * its value is SL_BPS (150 bps) below its cost (stop loss),
//       * MAX_HOLD_BARS (240) bars have passed since the buy was decided.
//   - At most MAX_ROUND_TRIPS (4) round trips per window: on a day that
//     keeps falling, the bot stops catching knives instead of bleeding out.
//   - One open position, long only, full size, no leverage, no short.
//   - max_slippage_bps is left wide open (10_000) so a fill is never
//     refused for a 1-minute gap; the stop-loss, not the slippage cap,
//     is what limits a bad fill.
//
// The bot keeps no state between batches other than the closes it has been
// sent, the bar its current position was opened on, and how many round
// trips it has closed. It reads no clock, no file and no environment, and
// seeds nothing: it is fully deterministic.

import { BPS, runBars, type BarsState, type Batch, type OrderInput } from "./vendor/makefun-bars.ts";

const SYMBOL = "CBBTC";
/** Lookback for the dip: the close 60 bars ago. */
const LOOKBACK_BARS = 60;
/** Buy when the close is this many bps below the close LOOKBACK_BARS ago. */
const ENTRY_BPS = 100n;
/** Sell when the position is worth this many bps over its cost. */
const TP_BPS = 120n;
/** Sell when the position is worth this many bps under its cost. */
const SL_BPS = 150n;
/** Sell after this many bars since the buy was decided, even with no TP/SL. */
const MAX_HOLD_BARS = 240;
/** Stop opening new round trips after this many have closed. */
const MAX_ROUND_TRIPS = 4;
/** Never let the slippage cap refuse a fill (the stop-loss limits damage). */
const MAX_SLIPPAGE_BPS = 10_000;

/** The close of every bar so far, indexed by batch seq (null on a gap bar). */
const closes: (bigint | null)[] = [];
/** The seq of the batch on which the current position's buy was decided. */
let heldSince: number | null = null;
/** Round trips closed so far (a sell that emptied the position). */
let roundTrips = 0;
/** Whether the previous batch showed a position (to count its close). */
let wasHolding = false;

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    for (const bar of batch.bars) closes[batch.seq] = BigInt(bar.c);

    const held = state.positions.get(SYMBOL);
    const nowHolding = held !== undefined && held.qty > 0n;
    if (wasHolding && !nowHolding) roundTrips += 1;
    wasHolding = nowHolding;
    if (state.warmingUp) return [];

    if (!nowHolding) {
      if (roundTrips >= MAX_ROUND_TRIPS) return [];
      const now = closes[batch.seq];
      const then = batch.seq >= LOOKBACK_BARS ? closes[batch.seq - LOOKBACK_BARS] : null;
      if (now === null || now === undefined || then === null || then === undefined) return [];
      // now < then * (10000 - ENTRY_BPS) / 10000, exactly.
      if (now * BPS < then * (BPS - ENTRY_BPS)) {
        heldSince = batch.seq;
        return [{ side: "buy", symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    const heldPos = held!;
    const value = state.value(SYMBOL, heldPos.qty);
    const sell: OrderInput[] = [{ side: "sell", symbol: SYMBOL, qty: heldPos.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    // value >= cost * (10000 + TP_BPS) / 10000, exactly.
    if (value * BPS >= heldPos.cost * (BPS + TP_BPS)) return sell;
    // value <= cost * (10000 - SL_BPS) / 10000, exactly.
    if (value * BPS <= heldPos.cost * (BPS - SL_BPS)) return sell;
    if (heldSince !== null && batch.seq - heldSince >= MAX_HOLD_BARS) return sell;
    return [];
  },
});
