// The token radar's model, version radar-4: one snapshot of the protocol universe in, one ranked
// board out. The board ranks every pre-token protocol the snapshot can rank — the watchlist plus all
// 249 other rankable pre-token protocols — and accounts for the rest of the snapshot's 758 protocols
// in its coverage strip (live-token protocols shown at the market's own values, pre-token protocols
// excluded as exchanges or versioned pools).
//
// The value model is FITTED, not a flat multiple. From the snapshot's own trading protocols (the
// comps: live-token protocols with a market cap and a TVL), the model fits a log-log comps curve:
//
//   log(mcap) = intercept + slope * log(TVL) + category_effect
//
// by ordinary least squares, with one shrunk effect per category (the median residual of its comps,
// pulled toward zero by n/(n+K), capped at the 90th percentile of |residual|). A category with no
// trading peer gets no effect at all rather than an invented number. The fitted curve answers what
// the data actually says: on this snapshot the slope is about 0.52, so bigger protocols trade at
// lower multiples and the curve values size sub-linearly. No protocol name is ever special-cased.
//
// The fit is VALIDATED out of sample, and the numbers are printed in the dashboard and in board.json:
// leave-one-out over all 128 comps (median absolute log error, and the share predicted within 2x,
// against the same test for the old flat-median model), and a walk-forward-style split (fit on the
// comps listed before the median listing date, tested on the ones listed after). Rank stability is
// measured, not asserted: the model is refit 200 times on bootstrap resamples of the comps (a seeded
// PRNG, so two runs agree byte for byte) and every row carries the p10-p90 range of its rank.
//
// What a row's farm costs is NETTED TO THE DOLLAR: the capital the position needs plus every
// transaction's gas over the hold (two to set up, one a week, one to exit), from the protocol's own
// first chain. The verdict follows from the net cost and the implied value: skip when the farm costs
// more than half the capital to run or the launch is under $1M implied, thin when gas is over 15% of
// the capital or the launch is under $10M implied, farm otherwise. The farm steps themselves stay
// six, each an action with a cost and a time.
//
//   implied = exp(intercept + slope * log(TVL) + category_effect)
//             * growthMult * maturityMult * chainMult
//   growthMult   = 1 + clamp(change_7d, -60, 120) / 100 * GROWTH_WEIGHT
//   maturityMult = 0.6 + min(age_days, 1095) / 1095 * 0.4   (age unknown: 365 days)
//   chainMult    = 1 + 0.02 * min(chains - 1, 5)

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  shrinkage_k: number;
  chain_step: number;
  chain_cap: number;
  /** Gas over this share of the capital makes a farm a skip; over the thin share, a thin. */
  verdict_skip_gas_share: number;
  verdict_thin_gas_share: number;
  /** Implied value under these makes a farm a skip / a thin. */
  verdict_skip_implied_usd: number;
  verdict_thin_implied_usd: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  shrinkage_k: 5,
  chain_step: 0.02,
  chain_cap: 5,
  verdict_skip_gas_share: 0.5,
  verdict_thin_gas_share: 0.15,
  verdict_skip_implied_usd: 1_000_000,
  verdict_thin_implied_usd: 10_000_000,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-4';

/** How many bootstrap refits the rank ranges come from. */
export const REFITS = 200;

/** The refits' seed: fixed, so two runs agree byte for byte. */
export const REFIT_SEED = 20261119;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One category's fitted effect: the shrunk median residual, as a log shift and as a factor. */
export interface CategoryEffect {
  category: string;
  /** The log shift the category's comps add to the fitted curve. */
  effect: number;
  /** exp(effect): the factor the category multiplies the fitted value by. */
  factor: number;
  comps: number;
}

/** The fitted comps curve, derived from the snapshot's own trading protocols. */
export interface DerivedFit {
  intercept: number;
  slope: number;
  /** The share of log(market cap)'s variance the curve explains in sample. */
  r2: number;
  comps: number;
  /** The 90th percentile of |residual|: no category effect exceeds this in magnitude. */
  residual_cap: number;
  by_category: CategoryEffect[];
}

/** The out-of-sample validation of the fitted curve, against the flat-median model it replaces. */
export interface Validation {
  /** Leave-one-out over every comp: the fitted curve's median and mean absolute log error. */
  loo_n: number;
  loo_median_abs_log_error: number;
  loo_mean_abs_log_error: number;
  /** The share of held-out comps the fitted curve predicts within a factor of two. */
  loo_hit_within_2x: number;
  /** The same leave-one-out test for the flat per-category median multiple model. */
  loo_median_abs_log_error_baseline: number;
  loo_hit_within_2x_baseline: number;
  /** Walk-forward split: fit on comps listed on or before the cutoff, tested on the later ones. */
  walkforward_cutoff: string | null;
  walkforward_train_n: number;
  walkforward_test_n: number;
  walkforward_median_abs_log_error: number | null;
  walkforward_hit_within_2x: number | null;
  /** How many bootstrap refits the rank ranges come from. */
  refits: number;
}

/** How the snapshot's 758 protocols are accounted for: ranked, live, or excluded with a reason. */
export interface Coverage {
  total: number;
  ranked: number;
  live: number;
  excluded: number;
  excluded_cex: number;
  excluded_versioned: number;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** What a farm costs, netted to the dollar, and the verdict the net cost earns. */
export interface FarmEconomics {
  capital_usd: number;
  gas_usd: number;
  net_cost_usd: number;
  transactions: number;
  hold_days: number;
  verdict: 'farm' | 'thin' | 'skip';
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  /** The p10-p90 range of this row's rank over the bootstrap refits. */
  rank_range: [number, number];
  farm: FarmEconomics;
  model: {
    /** The fitted multiple for this protocol: the fitted value over its TVL. */
    multiple: number;
    comp_count: number;
    category_effect: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's view of one row, with the farm plan baked in so page and board agree. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  rank_range: [number, number];
  farm: FarmEconomics;
  multiple: number;
  comp_count: number;
  category_effect: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  watchlist: boolean;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  fit: DerivedFit;
  validation: Validation;
  coverage: Coverage;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a list of numbers; NaN when the list is empty. */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** The value at the q-th quantile of a list of numbers (nearest-rank); NaN when empty. */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** A seeded PRNG (mulberry32): the refits' only source of randomness, fixed by REFIT_SEED. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** The live-token protocols a fit can learn from: a market cap and a TVL, both positive. */
export function compSet(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
}

/** Ordinary least squares for y = a + b*x, with R-squared; the flat-median fallback when it cannot fit. */
function ols(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    syy += (ys[i]! - my) * (ys[i]! - my);
  }
  if (sxx <= 0) return { a: my, b: 0, r2: 0 };
  const b = sxy / sxx;
  const a = my - b * mx;
  return { a, b, r2: syy > 0 ? (sxy * sxy) / (sxx * syy) : 0 };
}

/**
 * The fitted comps curve: log(market cap) on log(TVL) by least squares over the comps, plus one
 * shrunk effect per category (the median residual of its comps, pulled toward zero by n/(n+K) and
 * capped at the 90th percentile of |residual|). With too few comps to fit, the curve falls back to
 * the overall median multiple: intercept log(median), slope 1, no effects.
 */
export function fitModel(rows: SnapshotProtocol[], model: ModelConstants = MODEL): DerivedFit {
  const ratios = rows.map((p) => p.mcap_usd! / p.tvl_usd);
  const overall = median(ratios);
  if (rows.length < 10) {
    return { intercept: Math.log(overall), slope: 1, r2: 0, comps: rows.length, residual_cap: 0, by_category: [] };
  }
  const { a, b, r2 } = ols(
    rows.map((p) => Math.log(p.tvl_usd)),
    rows.map((p) => Math.log(p.mcap_usd!)),
  );
  const residuals = rows.map((p) => Math.log(p.mcap_usd!) - (a + b * Math.log(p.tvl_usd)));
  const cap = quantile(residuals.map((r) => Math.abs(r)), 0.9);
  const byCategory = new Map<string, number[]>();
  rows.forEach((p, i) => {
    const key = p.category ?? '(uncategorised)';
    const list = byCategory.get(key) ?? [];
    list.push(residuals[i]!);
    byCategory.set(key, list);
  });
  const table: CategoryEffect[] = [...byCategory.entries()]
    .map(([category, res]) => {
      const w = res.length / (res.length + model.shrinkage_k);
      const effect = Math.max(-cap, Math.min(cap, w * median(res)));
      return { category, effect: round4(effect), factor: round4(Math.exp(effect)), comps: res.length };
    })
    .sort((x, y) => (x.category < y.category ? -1 : x.category > y.category ? 1 : 0));
  return { intercept: round4(a), slope: round4(b), r2: round4(r2), comps: rows.length, residual_cap: round4(cap), by_category: table };
}

/** A category's fitted effect out of the derived fit, or zero when the category has no comps. */
function effectFor(category: string | null, fit: DerivedFit): { effect: number; comps: number } {
  const key = category ?? '(uncategorised)';
  const row = fit.by_category.find((r) => r.category === key);
  if (row === undefined) return { effect: 0, comps: 0 };
  return { effect: row.effect, comps: row.comps };
}

/** The multipliers and the implied value one protocol gets under the fitted curve. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: DerivedFit,
  model: ModelConstants = MODEL,
): { implied: number; multiple: number; effect: number; comps: number; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const { effect, comps } = effectFor(protocol.category, fit);
  const fitted = Math.exp(fit.intercept + fit.slope * Math.log(protocol.tvl_usd) + effect);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainMult = 1 + model.chain_step * Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_cap);
  const implied = Math.max(1, Math.round(fitted * growthMult * maturityMult * chainMult));
  return { implied, multiple: fitted / protocol.tvl_usd, effect, comps, growthPct, growthMult, maturityMult, chainMult, age };
}

/**
 * The flat per-category median multiple one protocol gets from a comp set: radar-3's model, kept as
 * the validation baseline so the fitted curve's out-of-sample gain is measured, not claimed.
 */
function medianMultipleFor(category: string | null, rows: SnapshotProtocol[], model: ModelConstants): number {
  const ratios = rows.map((p) => p.mcap_usd! / p.tvl_usd);
  const overall = median(ratios);
  const cap = quantile(ratios, 0.9);
  const key = category ?? '(uncategorised)';
  const cat = rows.filter((p) => (p.category ?? '(uncategorised)') === key).map((p) => p.mcap_usd! / p.tvl_usd);
  if (cat.length === 0) return overall;
  const w = cat.length / (cat.length + model.shrinkage_k);
  return Math.min(w * median(cat) + (1 - w) * overall, cap);
}

/** The share of absolute log errors under log(2): predicted within a factor of two. */
function hitWithin2x(errors: number[]): number {
  if (errors.length === 0) return 0;
  return errors.filter((e) => e < Math.log(2)).length / errors.length;
}

/**
 * The fitted curve's out-of-sample validation: leave-one-out over every comp (fitted curve and
 * flat-median baseline side by side), and a walk-forward-style split that fits on the comps listed
 * on or before the median listing date and tests on the ones listed after. Comps without a listing
 * date sit out of the split only; the leave-one-out test uses them all.
 */
export function validateModel(comps: SnapshotProtocol[], model: ModelConstants = MODEL): Validation {
  const looFit: number[] = [];
  const looBase: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const held = comps[i]!;
    const fit = fitModel(rest, model);
    const { effect } = effectFor(held.category, fit);
    const predFit = fit.intercept + fit.slope * Math.log(held.tvl_usd) + effect;
    looFit.push(Math.abs(predFit - Math.log(held.mcap_usd!)));
    const predBase = Math.log(held.tvl_usd * medianMultipleFor(held.category, rest, model));
    looBase.push(Math.abs(predBase - Math.log(held.mcap_usd!)));
  }
  const dated = comps.filter((p) => p.listed_at !== null && Number.isFinite(Date.parse(p.listed_at)));
  let cutoff: string | null = null;
  let trainN = 0;
  let testN = 0;
  let wfMedian: number | null = null;
  let wfHit: number | null = null;
  if (dated.length >= 10) {
    const times = dated.map((p) => Date.parse(p.listed_at!));
    const cut = median(times);
    cutoff = new Date(cut).toISOString().slice(0, 10);
    const train = dated.filter((p) => Date.parse(p.listed_at!) <= cut);
    const test = dated.filter((p) => Date.parse(p.listed_at!) > cut);
    trainN = train.length;
    testN = test.length;
    if (train.length >= 5 && test.length >= 5) {
      const fit = fitModel(train, model);
      const errs = test.map((p) => {
        const { effect } = effectFor(p.category, fit);
        return Math.abs(fit.intercept + fit.slope * Math.log(p.tvl_usd) + effect - Math.log(p.mcap_usd!));
      });
      wfMedian = round4(median(errs));
      wfHit = round4(hitWithin2x(errs));
    }
  }
  return {
    loo_n: comps.length,
    loo_median_abs_log_error: round4(median(looFit)),
    loo_mean_abs_log_error: round4(looFit.reduce((s, v) => s + v, 0) / Math.max(looFit.length, 1)),
    loo_hit_within_2x: round4(hitWithin2x(looFit)),
    loo_median_abs_log_error_baseline: round4(median(looBase)),
    loo_hit_within_2x_baseline: round4(hitWithin2x(looBase)),
    walkforward_cutoff: cutoff,
    walkforward_train_n: trainN,
    walkforward_test_n: testN,
    walkforward_median_abs_log_error: wfMedian,
    walkforward_hit_within_2x: wfHit,
    refits: REFITS,
  };
}

/**
 * Every board protocol's p10-p90 rank range over REFITS bootstrap refits of the curve: each refit
 * resamples the comps with replacement (the seeded PRNG, so the ranges are the same every run),
 * refits, re-scores the whole board and re-ranks it. Top rows hold tight ranges; mid-board rows sit
 * close together in implied value, so theirs run wide — the range says so instead of hiding it.
 */
export function rankRanges(
  protocols: SnapshotProtocol[],
  comps: SnapshotProtocol[],
  asOf: string,
  model: ModelConstants = MODEL,
): Map<string, [number, number]> {
  const rng = mulberry32(REFIT_SEED);
  const ranks = new Map<string, number[]>(protocols.map((p) => [p.slug, []]));
  for (let k = 0; k < REFITS; k++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < comps.length; i++) sample.push(comps[Math.floor(rng() * comps.length)]!);
    const fit = fitModel(sample, model);
    const scored = protocols
      .map((p) => ({ slug: p.slug, implied: impliedValue(p, asOf, fit, model).implied }))
      .sort((a, b) => b.implied - a.implied || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    scored.forEach((s, i) => ranks.get(s.slug)!.push(i + 1));
  }
  const out = new Map<string, [number, number]>();
  for (const [slug, list] of ranks) out.set(slug, [quantile(list, 0.1), quantile(list, 0.9)]);
  return out;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n: the watchlist, then every other rankable pre-token protocol. */
export function buildBoard(
  snapshot: Snapshot,
  fit: DerivedFit,
  ranges: Map<string, [number, number]>,
  model: ModelConstants = MODEL,
): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // Full coverage: every other pre-token protocol the board may rank, whatever its TVL.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, fit, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    rank_range: ranges.get(s.p.slug) ?? [i + 1, i + 1],
    farm: farmEconomics(s.p, s.age, s.implied, model),
    model: {
      multiple: round4(s.multiple),
      comp_count: s.comps,
      category_effect: round4(s.effect),
      growth_pct: round4(s.growthPct),
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** A typical gas cost for one transaction on the protocol's first chain, in dollars. */
function gasUsd(chain: string): number {
  const c = chain.toLowerCase();
  if (c.includes('ethereum')) return 8;
  if (c.includes('solana')) return 0.05;
  if (c.includes('bitcoin') || c.includes('babylon')) return 2;
  if (c.includes('bsc') || c.includes('binance') || c.includes('avalanche') || c.includes('polygon') || c.includes('fantom')) return 0.3;
  if (c.includes('arbitrum') || c.includes('optimism') || c.includes('base') || c.includes('zksync') || c.includes('linea') || c.includes('scroll') || c.includes('blast') || c.includes('mantle') || c.includes('mode') || c.includes('opbnb')) return 0.5;
  return 2;
}

/** A gas figure as words, so the plan reads the same on a cheap chain and a dear one. */
function gasWords(usd: number): string {
  if (usd < 0.1) return 'under $0.10 of gas';
  if (usd < 1) return 'about $0.50 of gas';
  if (usd < 5) return 'about $2 of gas';
  return 'about $8 of gas';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Transactions a farm runs: two to set up (approve, deposit), one a week, one to exit. */
function transactionsFor(holdDays: number): number {
  return 2 + Math.ceil(holdDays / 7) + 1;
}

/**
 * What a farm costs, netted to the dollar: the capital the position needs plus every transaction's
 * gas over the hold, on the protocol's own first chain. The verdict follows from the net cost and
 * the launch's scale: a farm that costs more than half its capital to run, or chases a launch under
 * $1M implied, is a skip; gas over 15% of the capital, or a launch under $10M implied, is thin;
 * the rest is a farm.
 */
export function farmEconomics(p: SnapshotProtocol, age: number | null, implied: number, model: ModelConstants = MODEL): FarmEconomics {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const transactions = transactionsFor(hold);
  const gas = round2(transactions * gasUsd(chainOf(p)));
  const net = round2(capital + gas);
  const gasShare = gas / capital;
  let verdict: FarmEconomics['verdict'] = 'farm';
  if (implied < model.verdict_skip_implied_usd || gasShare > model.verdict_skip_gas_share) verdict = 'skip';
  else if (implied < model.verdict_thin_implied_usd || gasShare > model.verdict_thin_gas_share) verdict = 'thin';
  return { capital_usd: capital, gas_usd: gas, net_cost_usd: net, transactions, hold_days: hold, verdict };
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('yield')) return `Deposit $${capital} into ${name}'s highest-TVL strategy on ${chain} and keep the receipt.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('restak')) return `Restake $${capital} of the staking asset through ${name} on ${chain} and keep the receipt.`;
  if (c.includes('staking') || c.includes('staking pool')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis vault on ${chain} and keep the position through one funding cycle.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('payment')) return `Route $${capital} through ${name} on ${chain} and keep the transaction receipt.`;
  if (c.includes('chain')) return `Bridge $${capital} to the chain and use ${name}'s core app once a week.`;
  if (c.includes('governance')) return `Lock $${capital} of the governance asset through ${name} and vote on one proposal.`;
  if (c.includes('cedefi')) return `Deposit $${capital} into ${name} on ${chain} and complete its account checks.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The weekly qualifying action, fitted to the category. */
function weeklyFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('curator') || c.includes('allocator') || c.includes('yield') || c.includes('rwa')) return 'add a small deposit or rebalance between vaults';
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'adjust the supply, borrow a small amount, or repay part of it';
  if (c.includes('dex')) return 'make one swap or adjust the liquidity range';
  if (c.includes('bridge')) return 'bridge a small amount or use the app once';
  if (c.includes('governance')) return 'vote on one proposal or join a forum thread';
  return 'make one deposit, swap, vote or other on-chain action';
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasUsd(chain);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyFor(p);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `${gasWords(gas)} for the first transaction`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gasWords(gas)}`,
      time: '15 minutes to set up',
    },
    {
      text: `Do one qualifying action each week, such as to ${weekly}.`,
      cost: `${gasWords(gas)} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan baked in so page and board agree. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    rank_range: row.rank_range,
    farm: row.farm,
    multiple: row.model.multiple,
    comp_count: row.model.comp_count,
    category_effect: row.model.category_effect,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    watchlist: watchlist.has(row.slug),
    farm_steps: row.farm_steps,
  };
}

/** How the snapshot's protocols are accounted for: ranked on the board, live, or excluded with a reason. */
export function coverageOf(snapshot: Snapshot, board: BoardRow[]): Coverage {
  const onBoard = new Set(board.map((r) => r.slug));
  let live = 0;
  let excluded = 0;
  let excludedCex = 0;
  let excludedVersioned = 0;
  for (const p of snapshot.protocols) {
    if (onBoard.has(p.slug)) continue;
    if (!isPreToken(p)) {
      live++;
    } else {
      excluded++;
      if (p.category === 'CEX') excludedCex++;
      if (VERSIONED.test(p.name)) excludedVersioned++;
    }
  }
  return { total: snapshot.protocols.length, ranked: board.length, live, excluded, excluded_cex: excludedCex, excluded_versioned: excludedVersioned };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const comps = compSet(snapshot);
  const fit = fitModel(comps, model);
  const validation = validateModel(comps, model);
  const boardProtos = (() => {
    const index = bySlug(snapshot.protocols);
    const chosen = new Map<string, SnapshotProtocol>();
    for (const slug of snapshot.watchlist) {
      const p = index.get(slug);
      if (p !== undefined) chosen.set(slug, p);
    }
    for (const p of snapshot.protocols) {
      if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
    }
    return [...chosen.values()];
  })();
  const ranges = rankRanges(boardProtos, comps, snapshot.as_of, model);
  const board = buildBoard(snapshot, fit, ranges, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    fit,
    validation,
    coverage: coverageOf(snapshot, board),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, new Set(snapshot.watchlist))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.implied_value_usd > 100_000_000_000_000) return `${r.slug} has implied value over the cap`;
    const [lo, hi] = r.rank_range;
    if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || lo < 1 || hi > board.length || lo > hi) return `${r.slug} has rank range ${lo}-${hi}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
