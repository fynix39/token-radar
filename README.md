# Token Radar

An entry for make.fun's `token-radar-01` bounty: a token launch radar that ranks
pre-token protocols by an implied value, and shows a reader how to farm each one.

## What it does

`main.ts` reads the sealed DefiLlama snapshot (`/input/snapshot.json`, 758
protocols as of 2026-11-14), scores every pre-token protocol, and writes:

- `board.json` — the ranked board (240 rows: all 40 watchlist protocols, the 160
  largest pre-token protocols below the floor, and the 40 fastest growers the size
  cut missed)
- `data.js` — the same board as a script the dashboard reads, no network
- `dashboard/` — a static, sortable, filterable board with a detail view per
  protocol
- `screenshots/` — the board, a detail view and a filtered view
- `dossier.json` — the summary the judge reads, built with the vendored
  `makefun-board` library

## The model (`radar-3`)

The implied value follows only from the snapshot's own figures. The multiple is
derived from the protocols that already trade, per category, on every run — never
from a hardcoded list of names:

```
compMultiple(category) = median(mcap_usd / tvl_usd) over live-token peers
multiple(category)     = min(w * compMultiple + (1 - w) * overallMedian, p90)
                         w = n / (n + 5), p90 the 90th percentile of all live ratios
growthMult             = 1 + clamp(change_7d, -60, 120) / 100 * 0.5
maturityMult           = 0.6 + min(age_days, 1095) / 1095 * 0.4
chainMult              = 1 + 0.02 * min(chains - 1, 5)
implied                = tvl_usd * multiple * growthMult * maturityMult * chainMult
```

The shrinkage weight pulls thin categories toward the overall median (0.214 on this
snapshot): a category with no trading peer at all is valued at the overall median
rather than at an invented number. The cap binds only extreme single-peer
categories: Rain, the Prediction Market peer, trades at 400x its $6.6M TVL, and
without the cap it would put a $10.7M protocol third on the whole board.
The full multiples table is printed in the dashboard.

Farm plans are derived from each protocol's own record (category, chains, TVL,
age): six steps with a cost and a time each, gas figures fitted to the chain.

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
