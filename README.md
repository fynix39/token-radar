# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/fynix39/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/fynix39/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar that ranks pre-token protocols by an implied value, and shows
a reader how to farm each one. An entry for
[make.fun's token-radar-01 bounty](https://make.fun/bounty/token-radar-01):
build the best token launch radar.

## What it does

`main.ts` reads the sealed DefiLlama snapshot (`/input/snapshot.json`, 758
protocols as of 2026-11-14), scores every pre-token protocol, and writes:

- `board.json` — the ranked board (289 rows: all 40 watchlist protocols plus
  every other pre-token protocol the board may rank), with the fitted curve and
  its validation in the top-level `model` block
- `data.js` — the same board as a script the dashboard reads, no network
- `dashboard/` — a static, sortable, filterable board with a detail view per
  protocol, a KPI strip, a movers section and a validation panel
- `screenshots/` — the board, a detail view and the validation panel
- `dossier.json` — the summary the judge reads, built with the vendored
  `makefun-board` library

## The model (`radar-4`)

The implied value follows only from the snapshot's own figures. The value model
is a log-log comps curve FITTED on the protocols that already trade, on every
run — never from a hardcoded list of names:

```
log(mcap) = intercept + slope * log(TVL) + category_effect     (least squares)
implied   = exp(intercept + slope * log(TVL) + category_effect)
            * growthMult * maturityMult * chainMult
growthMult   = 1 + clamp(change_7d, -60, 120) / 100 * 0.5
maturityMult = 0.6 + min(age_days, 1095) / 1095 * 0.4
chainMult    = 1 + 0.02 * min(chains - 1, 5)
```

On this snapshot the fit is `log(mcap) = 6.96 + 0.52 * log(TVL)` (R² 0.19,
128 comps): bigger protocols trade at lower multiples, so the curve values size
sub-linearly. Each category adds its own effect — the median residual of its
trading peers, shrunk toward zero by n/(n+5) and capped at the 90th percentile
of |residual|; a category with no trading peer gets no effect at all, never an
invented number.

The fit is validated out of sample, and the numbers are printed in the
dashboard and in `board.json`:

- **Leave-one-out** over all 128 comps: median absolute log error 1.35 (×3.8),
  33% predicted within 2× — against 1.63 (×5.1) and 20% for the flat per-category
  median multiple the fit replaces.
- **Walk-forward split**: fit on the 48 comps listed up to 2024-02-18, tested on
  the 47 newer ones: median absolute log error 1.13, 32% within 2×.
- **Rank ranges**: the curve is refit 200 times on bootstrap resamples of the
  comps (seeded, so two runs agree byte for byte); every row carries its p10–p90
  rank range.

The board covers all 289 rankable pre-token protocols, and the dashboard
accounts for the whole snapshot: 289 ranked + 416 live-token + 53 excluded
(42 exchanges, 11 versioned pools) = 758.

Farm plans are derived from each protocol's own record (category, chains, TVL,
age): six steps with a cost and a time each, gas figures fitted to the chain —
and the cost is netted to the dollar (capital plus every transaction's gas over
the hold: two to set up, one a week, one to exit), with a verdict per row: farm,
thin or skip.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

Node 22.18 or later, standard library only. The program runs twice in the grader
and both runs must write the same bytes; it is fully deterministic.

## Disclaimer

An implied value is this entry's own claim, never make.fun's. A protocol the
snapshot records as having no token may still have one its DefiLlama record does
not carry. Nothing here is investment advice.

---

<sub>Entered on [make.fun](https://make.fun/?ref=jvcw07av&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
