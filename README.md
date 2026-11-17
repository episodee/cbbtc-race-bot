# cbbtc-race-bot

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/episodee/cbbtc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/episodee/cbbtc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A mean-reversion dip-buyer that trades Coinbase Wrapped BTC (cbBTC) on
1-minute on-chain prices with $1,000 of paper money. On the published dev
window it made **+$26.80 net PnL** (6 trades, 0.72% max drawdown), about
11x the best house bot.

**Strategy.** On 1-minute cbBTC bars the 60-minute return mean-reverts
(adjacent non-overlapping 60-minute returns correlate about −0.37 on the
dev window, negative in both halves of the day). The bot buys the whole
cash balance when the close is at least 100 bps below the close 60 bars
ago, and sells the whole position when it is 120 bps above its cost, 150
bps below its cost, or 240 bars have passed since the buy. At most 4 round
trips per window, so a day that keeps falling cannot bleed it out.
Trend-following breakouts were tried first and lose on this market — every
Donchian variant graded negative, whipsawed by 1-minute noise — so the
bot fades sharp hourly dips instead of chasing them.

The bot is fully deterministic: exact integer arithmetic on the raw
closes, no clock, no files, no network, no randomness. Two runs on the
same bars produce byte-identical action logs.

## Run it

The bot speaks `agent-fun/bars-replay/v1`: one JSON line per minute on
stdin, one reply line on stdout. Grade it on the dev window with the
competition kit:

```sh
node main.ts
```

```sh
node <kit>/cli/makefun.mjs grade-local --kit <kit> --bot . --driver process
```

`vendor/makefun-bars.ts` is a byte-for-byte copy of the kit's TypeScript
SDK shim.

---

<sub>Entered on [make.fun](https://make.fun/?ref=6nyxpkac&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
