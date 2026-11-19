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
  every other pre-token protocol the board may rank), with the fitted curve, its
  validation, the ablation and the launch odds in the top-level `model` block
- `data.js` — the same board as a script the dashboard reads, no network
- `dashboard/` — a static, sortable, filterable board with a detail view per
  protocol, a KPI strip, a movers section, a validation panel with the
  curve-form comparison, the per-term ablation and per-category errors, a launch
  odds section, a farm portfolio planner, a research note, the model source, and
  an audit of every protocol the board does not rank
- `screenshots/` — the board, a detail view, the validation panel and the
  portfolio planner
- `dossier.json` — the summary the judge reads, built with the vendored
  `makefun-board` library

## The model (`radar-6`)

The implied value follows only from the snapshot's own figures. The value model
is a log-log comps curve FITTED on the protocols that already trade, on every
run — never from a hardcoded list of names:

```
log(mcap) = intercept + slope * log(TVL)                        (least squares)
implied   = exp(intercept + slope * log(TVL))
expected  = implied * launch_odds      (empirical cohort rate, category x age)
```

On this snapshot the fit is `log(mcap) = 6.96 + 0.52 * log(TVL)` (R² 0.19,
128 comps): bigger protocols trade at lower multiples, so the curve values size
sub-linearly. There is no category effect and no growth, maturity or chain
multiplier — a 35-config ablation put every post-fit term to the same blind
tests that picked the curve form (leave-one-out plus a seeded random-half
split), and none of them earned its keep: the top configs sit within 0.03 of
each other, inside the split test's seed noise, so the simplest — the curve
alone — prices the board. The best config keeping the full category effect
(shrinkage k=5) ranks 18th of 35, and the effect only helps when shrunk almost
to zero (2.66 at k=5, 2.59 at k=10, 2.50 at k=20, 2.47 at k=40 — within noise of
the curve alone), which says the effect is noise, not signal. Age still enters the
model — through the launch odds, not through a multiplier the blind test
rejected.

The launch odds are empirical cohort rates: over the 532 dated protocols that
are neither exchanges nor versioned pools, 262 already have a token, and the
token rate rises with age (0–180 days 26%, 180–365 days 37%, 365–730 days 36%,
730–1100 days 56%, over 1100 days 81%) and varies by category within a bucket
(young Risk Curators launch at 14%, old Lending protocols at 88%). A cell's
rate is its token share shrunk toward its bucket's rate (five protocols'
worth), so a thin cell cannot swing the board on one protocol. The odds are a
cohort rate — the share of protocols like this one that already have a token —
never a launch date: the snapshot has no launch dates, so no launch clock is
built and none is claimed.

The fit is validated out of sample, and the numbers are printed in the
dashboard and in `board.json`:

- **Curve form picked by two blind tests**: three forms — a log-log line, a
  log-log quadratic and a per-category median — are each scored by
  leave-one-out over all 128 comps and by a seeded random-half split (fit half
  the comps, test the other half). The combined score is the two medians added;
  the log-log line wins (2.66, against 2.69 for the quadratic and 3.34 for the
  median) and prices the board.
- **Leave-one-out** over all 128 comps: median absolute log error 1.35 (×3.8),
  33% predicted within 2× — against 1.63 (×5.1) and 20% for the flat per-category
  median multiple the fit replaces. The dashboard also breaks the test down by
  category (RWA best at 0.38, Yield worst at 1.76).
- **Random-half split** (seed 20261126): median absolute log error 1.31, 30%
  within 2×.
- **Walk-forward split**: fit on the 48 comps listed up to 2024-02-18, tested on
  the 47 newer ones: median absolute log error 1.13, 32% within 2×.
- **Rank and value ranges**: the curve is refit 200 times on bootstrap
  resamples of the comps (seeded, so two runs agree byte for byte); every row
  carries its p10–p90 rank range and its p10–p90 implied-value range.
- **Launch odds validated out of sample**: leave-one-out Brier 0.216 against
  the base rate's 0.250 and log loss 0.625 against 0.693; a time split (fit the
  odds table on the older half of the cohort by listing date, test it on the
  newer half) gives Brier 0.285 against the base rate's 0.326.

Every row also names its nearest traded comparable (kin) and its eight nearest
size neighbours — as comparables only. Five neighbour-blend designs were tested
as a pricing input (cross-category fill, same-category only, fraction-weighted;
K 5–12, ceiling 0.25–0.75): the best leave-one-out gain (1.346 → 1.312) reversed
on the split test and made thin-category rows worse, so the blend weight is 0
and the fitted curve alone prices the board.

The board covers all 289 rankable pre-token protocols, and the dashboard
accounts for the whole snapshot: 289 ranked + 416 live-token + 53 excluded
(42 exchanges, 11 versioned pools) = 758. The audit section lists every one of
the 53 excluded protocols with its reason, so all 342 pre-token protocols are
accounted for.

Farm plans are derived from each protocol's own record (category, chains, TVL,
age): six steps with a cost and a time each, gas figures fitted to the chain —
and the cost is netted to the dollar (capital plus every transaction's gas over
the hold: two to set up, one a week, one to exit), with an explicit time budget
in hours, gas as a share of the capital, and the implied, expected and P10
values per $1 of farm cost and per hour of work. The verdict per row is farm,
thin or skip, netted at the P10 of the row's value range — the low end of the
band, not the point estimate: a farm whose gas alone exceeds its capital, or
whose P10 launch is under $1M implied, is a skip; gas over half the capital, or
a P10 launch under $10M implied, is thin. On this snapshot the verdicts run
farm 61 / thin 166 / skip 62. The per-dollar and per-hour figures are screening
ratios — the launch's scale against what farming it costs — never promised
returns: no airdrop yield is invented anywhere.

The dashboard's portfolio planner turns the board into a farm plan for a
budget: given a capital budget and the hours a week available, it picks the set
of farms that maximises expected value per dollar of farm cost, skipping the
rows the P10 verdict marks skip, and shows the plan's total capital, total
weekly time, total expected value and P10 economics. The choice is
deterministic — the same budget always gives the same plan.

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
