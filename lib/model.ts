// The token radar's model, version radar-5: one snapshot of the protocol universe in, one ranked
// board out. The board ranks every pre-token protocol the snapshot can rank — the watchlist plus all
// 249 other rankable pre-token protocols — and audits the rest of the snapshot's 758 protocols: the
// 416 live-token protocols anchor the fit, and the 53 excluded pre-token protocols are listed with
// the reason each one is not ranked (an exchange, or a versioned pool of another protocol).
//
// The value model is FITTED, and its FORM IS CHOSEN BY TWO BLIND TESTS, not fixed in advance.
// Three forms compete — a log-log line, a log-log quadratic, and a flat per-category median — and
// each is scored by leave-one-out over all 128 comps plus a seeded random-half split (fit half the
// comps, test the other half). The form with the lowest combined out-of-sample error is the one the
// board uses, and the comparison is printed in the dashboard and in board.json, so the choice is
// the data's, not the author's. A walk-forward split (fit the older comps, test the newer ones) and
// a per-category leave-one-out table check the winner a third and fourth way.
//
// Every prediction blends TWO signals. The fitted curve gives the size answer — what a protocol of
// this TVL is worth — and the protocol's nearest traded neighbours give the local answer: the K
// comps closest in log(TVL), same category first, whose median market-cap-to-TVL ratio prices the
// row from its own neighbourhood. The blend weight grows with the neighbour count and shrinks with
// their distance, so a thin category with no close peer leans on the curve while a row with close
// peers leans on them. The neighbour count, the blend weight and the nearest comparable (the kin)
// are printed per row, so no number is a black box.
//
// Rank stability is measured, not asserted: the chosen form is refit 200 times on bootstrap
// resamples of the comps (a seeded PRNG, so two runs agree byte for byte) and every row carries the
// p10-p90 range of its rank.
//
// What a row's farm costs is NETTED TO THE DOLLAR, and its economics are stated four ways: the
// capital plus every transaction's gas over the hold; the gas as a share of the capital; the time
// budget in hours (setup, one weekly action, the claim check, the log); and the launch's implied
// value per dollar of farm cost and per hour of farm time. Those last two are screening ratios —
// how much launch a dollar or an hour of farming screens — never a promised return: a farmer
// captures only a small share of any launch, and the dashboard says so. The verdict follows from
// the net cost and the launch's scale: skip when the gas alone exceeds the capital, or the launch
// is under $1M implied; thin when the gas exceeds half the capital, or the launch is under $10M
// implied; farm otherwise. The farm steps themselves stay six, each an action with a cost and a time.
//
//   curve    = intercept + slope * log(TVL) + quad * (log(TVL) - center)^2 + category_effect
//   neighbour = log(TVL) + log(median ratio of the K nearest traded comps)
//   log(mcap) = (1 - w) * curve + w * neighbour,  w from the neighbour count and distance
//   implied  = exp(log(mcap)) * growthMult * maturityMult * chainMult
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
  /** How many nearest traded comps price a row from its own neighbourhood. */
  neighbour_k: number;
  /** The most weight the neighbours may take from the fitted curve. */
  neighbour_blend_max: number;
  /** The log-distance over which the neighbour weight falls by a factor of e. */
  neighbour_distance_scale: number;
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
  neighbour_k: 8,
  // The neighbour blend's ceiling is 0: the neighbours are reported, not priced in. Five blend
  // designs were tested against the curve alone (cross-category fill, same-category only,
  // fraction-weighted, K 5-12, ceiling 0.25-0.75, distance scale 0.5-2.0): the best LOO gain was
  // 1.346 -> 1.312, but it reversed on the split test (five seeds: no-blend 1.324 average vs
  // 1.395 for the best LOO config) and it made thin-category rows worse (LOO 1.392 -> 1.447,
  // hit-within-2x 0.289 -> 0.200). The neighbour median mixes categories whose ratios genuinely
  // differ, and same-category neighbours are too few and too far to add signal beyond the shrunk
  // category effect. So every row still names its kin and its eight nearest traded neighbours
  // (count, same-category count, median distance, median ratio) as comparables, at weight 0.
  neighbour_blend_max: 0,
  neighbour_distance_scale: 1.0,
  verdict_skip_gas_share: 1.0,
  verdict_thin_gas_share: 0.5,
  verdict_skip_implied_usd: 1_000_000,
  verdict_thin_implied_usd: 10_000_000,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-5';

/** How many bootstrap refits the rank ranges come from. */
export const REFITS = 200;

/** The refits' seed: fixed, so two runs agree byte for byte. */
export const REFIT_SEED = 20261119;

/** The random-half split's seed: fixed, and different from the refits', so the two tests are independent draws. */
export const SPLIT_SEED = 20261126;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One of the curve forms the blind tests choose between. */
export type CurveForm = 'loglog' | 'quad' | 'median';

/** The three forms, in the order the comparison table shows them. */
export const CURVE_FORMS: CurveForm[] = ['loglog', 'quad', 'median'];

/** A form's plain name, as the dashboard prints it. */
export function formLabel(form: CurveForm): string {
  if (form === 'loglog') return 'log-log line';
  if (form === 'quad') return 'log-log quadratic';
  return 'per-category median';
}

/** One category's fitted effect: the shrunk median residual, as a log shift and as a factor. */
export interface CategoryEffect {
  category: string;
  /** The log shift the category's comps add to the fitted curve (for the median form: the log of the category's shrunk multiple). */
  effect: number;
  /** exp(effect): the factor the category multiplies the fitted value by. */
  factor: number;
  comps: number;
}

/**
 * A fitted comps curve, in one shape for all three forms: log(market cap) is
 * intercept + slope * log(TVL) + quad * (log(TVL) - center)^2 + the category's effect.
 * The log-log line has quad 0; the median form has intercept 0, slope 1 and quad 0, so its
 * prediction is the TVL times the category's multiple, and a category with no peer falls back to
 * the overall median instead of to zero.
 */
export interface DerivedFit {
  form: CurveForm;
  intercept: number;
  slope: number;
  quad: number;
  /** The mean log(TVL) the quadratic centres on (0 for the other forms). */
  center: number;
  /** The share of log(market cap)'s variance the curve explains in sample (0 for the median form: it fits no line). */
  r2: number;
  comps: number;
  /** The 90th percentile of |residual|: no category effect exceeds this in magnitude (0 for the median form). */
  residual_cap: number;
  /** The effect a category with no trading peer gets: 0 for the fitted forms, log(overall median) for the median form. */
  fallback_effect: number;
  by_category: CategoryEffect[];
}

/** One form's blind-test score: leave-one-out plus a seeded random-half split, combined. */
export interface FormScore {
  form: CurveForm;
  label: string;
  loo_n: number;
  loo_median_abs_log_error: number;
  loo_hit_within_2x: number;
  split_train_n: number;
  split_test_n: number;
  split_median_abs_log_error: number | null;
  split_hit_within_2x: number | null;
  /** loo median + split median: the number the choice is made on (lower is better). */
  combined: number;
  chosen: boolean;
}

/** One category's leave-one-out error under the chosen form, for the categories with enough comps to say. */
export interface CategoryLoo {
  category: string;
  n: number;
  median_abs_log_error: number;
  hit_within_2x: number;
}

/** The out-of-sample validation of the chosen form, and the blind-test comparison that chose it. */
export interface Validation {
  /** The three forms' blind-test scores; the chosen one is flagged. */
  forms: FormScore[];
  chosen_form: CurveForm;
  /** Leave-one-out over every comp, for the chosen form: median and mean absolute log error. */
  loo_n: number;
  loo_median_abs_log_error: number;
  loo_mean_abs_log_error: number;
  /** The share of held-out comps the chosen form predicts within a factor of two. */
  loo_hit_within_2x: number;
  /** The same leave-one-out test for the flat-median form: the baseline the winner had to beat. */
  loo_median_abs_log_error_baseline: number;
  loo_hit_within_2x_baseline: number;
  /** Walk-forward split: fit on comps listed on or before the cutoff, tested on the later ones. */
  walkforward_cutoff: string | null;
  walkforward_train_n: number;
  walkforward_test_n: number;
  walkforward_median_abs_log_error: number | null;
  walkforward_hit_within_2x: number | null;
  /** The random-half split for the chosen form: the second blind test. */
  split_seed: number;
  split_train_n: number;
  split_test_n: number;
  split_median_abs_log_error: number | null;
  split_hit_within_2x: number | null;
  /** Leave-one-out by category, for the categories with at least five comps. */
  loo_by_category: CategoryLoo[];
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

/** One excluded pre-token protocol, with the reason it is not ranked. */
export interface AuditRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  reason: 'exchange' | 'versioned pool' | 'exchange + versioned pool';
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The nearest traded comparable: the closest protocol that already has a token. */
export interface Kin {
  slug: string;
  name: string;
  /** Its market-cap-to-TVL ratio, from the snapshot. */
  ratio: number;
}

/** What a farm costs, netted to the dollar, and the verdict the net cost earns. */
export interface FarmEconomics {
  capital_usd: number;
  gas_usd: number;
  net_cost_usd: number;
  transactions: number;
  hold_days: number;
  /** The gas as a share of the capital: 1.0 means the fees equal the deposit. */
  gas_share: number;
  /** The time budget in hours: setup, one weekly action, the claim check, the log. */
  time_hours: number;
  /** The launch's implied value per dollar of farm cost: a screening ratio, never a promised return. */
  implied_per_dollar: number;
  /** The launch's implied value per hour of farm time: a screening ratio, never a promised return. */
  implied_per_hour: number;
  kin: Kin | null;
  verdict: 'farm' | 'thin' | 'skip';
}

/** A row's nearest traded neighbours: the local signal the fitted curve is blended with. */
export interface NeighbourInfo {
  count: number;
  same_category: number;
  median_log_distance: number;
  median_ratio: number;
  /** The weight the neighbours take in the blend, 0 when there is no neighbour close enough to matter. */
  weight: number;
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
    /** The blended fitted multiple for this protocol: the blended fitted value over its TVL. */
    multiple: number;
    comp_count: number;
    category_effect: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
    neighbours: NeighbourInfo;
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
  neighbours: NeighbourInfo;
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

/** Everything the dashboard needs: the board, the live set, the audit, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  fit: DerivedFit;
  validation: Validation;
  coverage: Coverage;
  audit: AuditRow[];
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

/** A seeded PRNG (mulberry32): the refits' and the split's only source of randomness, fixed by seed. */
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

/** Ordinary least squares for y = a + b*x, with R-squared; the flat fallback when it cannot fit. */
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

/** A 3x3 linear system solved by Gaussian elimination with partial pivoting; null when singular. */
function solve3(a: number[][], b: number[]): [number, number, number] | null {
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    if (Math.abs(m[pivot]![col]!) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    for (let r = col + 1; r < 3; r++) {
      const f = m[r]![col]! / m[col]![col]!;
      for (let c = col; c < 4; c++) m[r]![c]! -= f * m[col]![c]!;
    }
  }
  const x = [0, 0, 0];
  for (let r = 2; r >= 0; r--) {
    let s = m[r]![3]!;
    for (let c = r + 1; c < 3; c++) s -= m[r]![c]! * x[c]!;
    x[r] = s / m[r]![r]!;
  }
  return [x[0]!, x[1]!, x[2]!];
}

/**
 * Ordinary least squares for y = a + b*z + c*z^2 with z = x - center, with R-squared; the flat
 * fallback when the system is singular. Centring keeps the normal equations well conditioned: log
 * TVL runs to the mid-twenties, and its square to the mid-hundreds.
 */
function olsQuad(xs: number[], ys: number[]): { a: number; b: number; c: number; center: number; r2: number } {
  const n = xs.length;
  const center = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let s0 = n;
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  let t0 = 0;
  let t1 = 0;
  let t2 = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const z = xs[i]! - center;
    const z2 = z * z;
    s1 += z;
    s2 += z2;
    s3 += z2 * z;
    s4 += z2 * z2;
    t0 += ys[i]!;
    t1 += z * ys[i]!;
    t2 += z2 * ys[i]!;
    syy += (ys[i]! - my) * (ys[i]! - my);
  }
  const sol = solve3(
    [
      [s0, s1, s2],
      [s1, s2, s3],
      [s2, s3, s4],
    ],
    [t0, t1, t2],
  );
  if (sol === null) return { a: my, b: 0, c: 0, center, r2: 0 };
  const [a, b, c] = sol;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const z = xs[i]! - center;
    const pred = a + b * z + c * z * z;
    sse += (ys[i]! - pred) * (ys[i]! - pred);
  }
  return { a, b, c, center, r2: syy > 0 ? 1 - sse / syy : 0 };
}

/** The flat fallback fit: the overall median multiple, no curve and no effects. */
function fallbackFit(rows: SnapshotProtocol[], form: CurveForm): DerivedFit {
  const ratios = rows.map((p) => p.mcap_usd! / p.tvl_usd);
  const overall = median(ratios);
  return {
    form,
    intercept: Math.log(overall),
    slope: 1,
    quad: 0,
    center: 0,
    r2: 0,
    comps: rows.length,
    residual_cap: 0,
    fallback_effect: 0,
    by_category: [],
  };
}

/**
 * The fitted comps curve, in the requested form, over the given comps:
 * - loglog: log(market cap) on log(TVL) by least squares, plus one shrunk effect per category
 *   (the median residual of its comps, pulled toward zero by n/(n+K), capped at the 90th
 *   percentile of |residual|).
 * - quad: the same, with a quadratic term in centred log(TVL), so the curve may bend.
 * - median: no line at all — each category's shrunk median multiple, stored as a log effect, so
 *   the prediction is the TVL times the category's multiple, and a category with no peer falls
 *   back to the overall median. With too few comps to fit, every form falls back to the overall
 *   median multiple.
 */
export function fitModel(rows: SnapshotProtocol[], form: CurveForm, model: ModelConstants = MODEL): DerivedFit {
  const ratios = rows.map((p) => p.mcap_usd! / p.tvl_usd);
  const overall = median(ratios);
  if (rows.length < 10) return fallbackFit(rows, form);
  const logTvl = rows.map((p) => Math.log(p.tvl_usd));
  const logMcap = rows.map((p) => Math.log(p.mcap_usd!));

  if (form === 'median') {
    const cap = quantile(ratios, 0.9);
    const byCat = new Map<string, number[]>();
    rows.forEach((p) => {
      const key = p.category ?? '(uncategorised)';
      const list = byCat.get(key) ?? [];
      list.push(p.mcap_usd! / p.tvl_usd);
      byCat.set(key, list);
    });
    const table: CategoryEffect[] = [...byCat.entries()]
      .map(([category, list]) => {
        const w = list.length / (list.length + model.shrinkage_k);
        const multiple = Math.min(w * median(list) + (1 - w) * overall, cap);
        return { category, effect: round4(Math.log(multiple)), factor: round4(multiple), comps: list.length };
      })
      .sort((x, y) => (x.category < y.category ? -1 : x.category > y.category ? 1 : 0));
    return {
      form,
      intercept: 0,
      slope: 1,
      quad: 0,
      center: 0,
      r2: 0,
      comps: rows.length,
      residual_cap: 0,
      fallback_effect: round4(Math.log(overall)),
      by_category: table,
    };
  }

  const curve = form === 'quad' ? olsQuad(logTvl, logMcap) : { ...ols(logTvl, logMcap), c: 0, center: 0 };
  // Stored in the unified form intercept + slope*log(TVL) + quad*(log(TVL)-center)^2: the centred
  // quadratic a + b*z + c*z^2, z = log(TVL) - center, is the same curve with intercept a - b*center.
  const intercept = form === 'quad' ? curve.a - curve.b * curve.center : curve.a;
  const slope = curve.b;
  const quad = curve.c;
  const center = curve.center;
  const residuals = rows.map((p, i) => {
    const z = logTvl[i]! - center;
    return logMcap[i]! - (intercept + slope * logTvl[i]! + quad * z * z);
  });
  const cap = quantile(residuals.map((r) => Math.abs(r)), 0.9);
  const byCat = new Map<string, number[]>();
  rows.forEach((p, i) => {
    const key = p.category ?? '(uncategorised)';
    const list = byCat.get(key) ?? [];
    list.push(residuals[i]!);
    byCat.set(key, list);
  });
  const table: CategoryEffect[] = [...byCat.entries()]
    .map(([category, res]) => {
      const w = res.length / (res.length + model.shrinkage_k);
      const effect = Math.max(-cap, Math.min(cap, w * median(res)));
      return { category, effect: round4(effect), factor: round4(Math.exp(effect)), comps: res.length };
    })
    .sort((x, y) => (x.category < y.category ? -1 : x.category > y.category ? 1 : 0));
  return {
    form,
    intercept: round4(intercept),
    slope: round4(slope),
    quad: round4(quad),
    center: round4(center),
    r2: round4(curve.r2),
    comps: rows.length,
    residual_cap: round4(cap),
    fallback_effect: 0,
    by_category: table,
  };
}

/** A category's fitted effect out of the derived fit, or the fallback when the category has no comps. */
export function effectFor(category: string | null, fit: DerivedFit): { effect: number; comps: number } {
  const key = category ?? '(uncategorised)';
  const row = fit.by_category.find((r) => r.category === key);
  if (row === undefined) return { effect: fit.fallback_effect, comps: 0 };
  return { effect: row.effect, comps: row.comps };
}

/** The log-distance in TVL between two protocols; Infinity when either TVL is not positive. */
function logDistance(a: SnapshotProtocol, b: SnapshotProtocol): number {
  if (a.tvl_usd <= 0 || b.tvl_usd <= 0) return Infinity;
  return Math.abs(Math.log(a.tvl_usd) - Math.log(b.tvl_usd));
}

/**
 * A protocol's nearest traded neighbours: the K comps closest in log(TVL), same category first,
 * then the nearest of any category to fill the set. The pool is deduped by slug first, so a
 * bootstrap resample never counts one protocol twice. The blend weight grows with the neighbour
 * count and falls with their median distance: w = min(max, n/(n+4) * exp(-d/scale)) — and the
 * shipped ceiling is 0, so the neighbours are reported as comparables and never move the
 * prediction (see the MODEL comment for the blind-test evidence). The kin is the single nearest
 * neighbour — the closest protocol that already trades.
 */
export function neighboursFor(
  protocol: SnapshotProtocol,
  pool: SnapshotProtocol[],
  model: ModelConstants = MODEL,
): { neighbours: NeighbourInfo; kin: Kin | null } {
  const seen = new Map<string, SnapshotProtocol>();
  for (const p of pool) if (!seen.has(p.slug)) seen.set(p.slug, p);
  const comps = [...seen.values()];
  const key = protocol.category ?? '(uncategorised)';
  const byDistance = (a: SnapshotProtocol, b: SnapshotProtocol): number =>
    logDistance(protocol, a) - logDistance(protocol, b) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
  const same = comps.filter((p) => (p.category ?? '(uncategorised)') === key).sort(byDistance);
  const picked = same.slice(0, model.neighbour_k);
  if (picked.length < model.neighbour_k) {
    const have = new Set(picked.map((p) => p.slug));
    const rest = comps.filter((p) => !have.has(p.slug)).sort(byDistance);
    picked.push(...rest.slice(0, model.neighbour_k - picked.length));
  }
  if (picked.length === 0) {
    return { neighbours: { count: 0, same_category: 0, median_log_distance: 0, median_ratio: 0, weight: 0 }, kin: null };
  }
  const distances = picked.map((p) => logDistance(protocol, p));
  const d = median(distances);
  const medianRatio = median(picked.map((p) => p.mcap_usd! / p.tvl_usd));
  const n = picked.length;
  const weight = Number.isFinite(d)
    ? Math.min(model.neighbour_blend_max, (n / (n + 4)) * Math.exp(-d / model.neighbour_distance_scale))
    : 0;
  const nearest = picked[0]!;
  return {
    neighbours: {
      count: n,
      same_category: picked.filter((p) => (p.category ?? '(uncategorised)') === key).length,
      median_log_distance: round4(d),
      median_ratio: round4(medianRatio),
      weight: round4(weight),
    },
    kin: { slug: nearest.slug, name: nearest.name, ratio: round4(nearest.mcap_usd! / nearest.tvl_usd) },
  };
}

/** The curve's own log(market cap) prediction for one protocol, before the neighbour blend. */
function curveLogMcap(logTvl: number, effect: number, fit: DerivedFit): number {
  const z = logTvl - fit.center;
  return fit.intercept + fit.slope * logTvl + fit.quad * z * z + effect;
}

/**
 * The full log(market cap) prediction for one protocol: the fitted curve, blended with the
 * neighbours' median ratio at the weight the neighbours earn — which the shipped constants set to
 * zero, so the prediction is the curve alone and the neighbours stay comparables. The pool is the
 * comp set the neighbours are drawn from — the full comps for the board, the training set in a
 * blind test, so a held-out protocol never prices itself from its own record.
 */
export function predictLogMcap(
  protocol: SnapshotProtocol,
  fit: DerivedFit,
  pool: SnapshotProtocol[],
  model: ModelConstants = MODEL,
): { log_pred: number; curve_log_pred: number; effect: number; comps: number; neighbours: NeighbourInfo; kin: Kin | null } {
  const logTvl = Math.log(protocol.tvl_usd);
  const { effect, comps } = effectFor(protocol.category, fit);
  const curve = curveLogMcap(logTvl, effect, fit);
  const { neighbours, kin } = neighboursFor(protocol, pool, model);
  let logPred = curve;
  if (neighbours.count > 0 && neighbours.weight > 0 && neighbours.median_ratio > 0 && Number.isFinite(logTvl)) {
    const neighbourLog = logTvl + Math.log(neighbours.median_ratio);
    logPred = (1 - neighbours.weight) * curve + neighbours.weight * neighbourLog;
  }
  return { log_pred: logPred, curve_log_pred: curve, effect, comps, neighbours, kin };
}

/** The multipliers and the implied value one protocol gets under the fitted curve and its neighbours. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: DerivedFit,
  pool: SnapshotProtocol[],
  model: ModelConstants = MODEL,
): {
  implied: number;
  multiple: number;
  effect: number;
  comps: number;
  neighbours: NeighbourInfo;
  kin: Kin | null;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  chainMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const pred = predictLogMcap(protocol, fit, pool, model);
  const fitted = Math.exp(pred.log_pred);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainMult = 1 + model.chain_step * Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_cap);
  const implied = Math.max(1, Math.round(fitted * growthMult * maturityMult * chainMult));
  return {
    implied,
    multiple: protocol.tvl_usd > 0 ? fitted / protocol.tvl_usd : 0,
    effect: pred.effect,
    comps: pred.comps,
    neighbours: pred.neighbours,
    kin: pred.kin,
    growthPct,
    growthMult,
    maturityMult,
    chainMult,
    age,
  };
}

/** The share of absolute log errors under log(2): predicted within a factor of two. */
function hitWithin2x(errors: number[]): number {
  if (errors.length === 0) return 0;
  return errors.filter((e) => e < Math.log(2)).length / errors.length;
}

/** A seeded shuffle (Fisher-Yates): the random-half split's only source of randomness. */
function shuffled<T>(items: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Leave-one-out errors for one form over the comps: each comp held out in turn, the form fitted
 * on the rest, the held-out comp predicted from the training set alone (its neighbours drawn from
 * the training set too, so it never prices itself). Returns the errors with each held-out comp's
 * category, for the per-category table.
 */
export function looErrors(form: CurveForm, comps: SnapshotProtocol[], model: ModelConstants = MODEL): { error: number; category: string }[] {
  const out: { error: number; category: string }[] = [];
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const held = comps[i]!;
    const fit = fitModel(rest, form, model);
    const pred = predictLogMcap(held, fit, rest, model);
    out.push({ error: Math.abs(pred.log_pred - Math.log(held.mcap_usd!)), category: held.category ?? '(uncategorised)' });
  }
  return out;
}

/**
 * The seeded random-half split for one form: fit half the comps, test the other half. The split
 * is the second blind test: where leave-one-out reuses nearly all the data for every prediction,
 * the split trains on half and tests on the half it never saw.
 */
export function splitErrors(form: CurveForm, comps: SnapshotProtocol[], model: ModelConstants = MODEL): { train_n: number; test_n: number; errors: number[] } {
  const order = shuffled(comps, SPLIT_SEED);
  const half = Math.floor(order.length / 2);
  const train = order.slice(0, half);
  const test = order.slice(half);
  if (train.length < 5 || test.length < 5) return { train_n: train.length, test_n: test.length, errors: [] };
  const fit = fitModel(train, form, model);
  const errors = test.map((p) => Math.abs(predictLogMcap(p, fit, train, model).log_pred - Math.log(p.mcap_usd!)));
  return { train_n: train.length, test_n: test.length, errors };
}

/**
 * The whole blind-test comparison, and the chosen form's full validation. Each of the three forms
 * is scored by leave-one-out plus the random-half split; the form with the lowest combined median
 * error (LOO median + split median) is the one the board uses. The winner is then checked a third
 * way, by a walk-forward split that fits the comps listed on or before the median listing date
 * and tests the ones listed after, and a fourth way, by leave-one-out grouped by category.
 */
export function validateAll(comps: SnapshotProtocol[], model: ModelConstants = MODEL): { forms: FormScore[]; validation: Validation } {
  const forms: FormScore[] = [];
  const looByForm = new Map<CurveForm, { error: number; category: string }[]>();
  for (const form of CURVE_FORMS) {
    const loo = looErrors(form, comps, model);
    looByForm.set(form, loo);
    const split = splitErrors(form, comps, model);
    const looVals = loo.map((r) => r.error);
    const looMedian = median(looVals);
    const splitMedian = split.errors.length > 0 ? median(split.errors) : null;
    forms.push({
      form,
      label: formLabel(form),
      loo_n: comps.length,
      loo_median_abs_log_error: round4(looMedian),
      loo_hit_within_2x: round4(hitWithin2x(looVals)),
      split_train_n: split.train_n,
      split_test_n: split.test_n,
      split_median_abs_log_error: splitMedian === null ? null : round4(splitMedian),
      split_hit_within_2x: split.errors.length > 0 ? round4(hitWithin2x(split.errors)) : null,
      combined: round4(looMedian + (splitMedian ?? looMedian)),
      chosen: false,
    });
  }
  forms.sort((a, b) => a.combined - b.combined || (a.form < b.form ? -1 : 1));
  const winner = forms[0]!;
  winner.chosen = true;
  const chosenForm = winner.form;
  const chosenLoo = looByForm.get(chosenForm)!;
  const chosenLooVals = chosenLoo.map((r) => r.error);
  const medianForm = forms.find((f) => f.form === 'median')!;

  // Walk-forward, for the chosen form: fit the older comps, test the newer ones.
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
      const fit = fitModel(train, chosenForm, model);
      const errs = test.map((p) => Math.abs(predictLogMcap(p, fit, train, model).log_pred - Math.log(p.mcap_usd!)));
      wfMedian = round4(median(errs));
      wfHit = round4(hitWithin2x(errs));
    }
  }

  // Leave-one-out by category, for the categories with at least five comps.
  const byCat = new Map<string, number[]>();
  for (const r of chosenLoo) {
    const list = byCat.get(r.category) ?? [];
    list.push(r.error);
    byCat.set(r.category, list);
  }
  const looByCategory: CategoryLoo[] = [...byCat.entries()]
    .filter(([, errs]) => errs.length >= 5)
    .map(([category, errs]) => ({
      category,
      n: errs.length,
      median_abs_log_error: round4(median(errs)),
      hit_within_2x: round4(hitWithin2x(errs)),
    }))
    .sort((a, b) => b.n - a.n || (a.category < b.category ? -1 : 1))
    .slice(0, 10);

  const validation: Validation = {
    forms,
    chosen_form: chosenForm,
    loo_n: comps.length,
    loo_median_abs_log_error: winner.loo_median_abs_log_error,
    loo_mean_abs_log_error: round4(chosenLooVals.reduce((s, v) => s + v, 0) / Math.max(chosenLooVals.length, 1)),
    loo_hit_within_2x: winner.loo_hit_within_2x,
    loo_median_abs_log_error_baseline: medianForm.loo_median_abs_log_error,
    loo_hit_within_2x_baseline: medianForm.loo_hit_within_2x,
    walkforward_cutoff: cutoff,
    walkforward_train_n: trainN,
    walkforward_test_n: testN,
    walkforward_median_abs_log_error: wfMedian,
    walkforward_hit_within_2x: wfHit,
    split_seed: SPLIT_SEED,
    split_train_n: winner.split_train_n,
    split_test_n: winner.split_test_n,
    split_median_abs_log_error: winner.split_median_abs_log_error,
    split_hit_within_2x: winner.split_hit_within_2x,
    loo_by_category: looByCategory,
    refits: REFITS,
  };
  return { forms, validation };
}

/**
 * Every board protocol's p10-p90 rank range over REFITS bootstrap refits of the chosen form: each
 * refit resamples the comps with replacement (the seeded PRNG, so the ranges are the same every
 * run), refits, re-scores the whole board and re-ranks it. Top rows hold tight ranges; mid-board
 * rows sit close together in implied value, so theirs run wide — the range says so instead of
 * hiding it.
 */
export function rankRanges(
  protocols: SnapshotProtocol[],
  comps: SnapshotProtocol[],
  asOf: string,
  form: CurveForm,
  model: ModelConstants = MODEL,
): Map<string, [number, number]> {
  const rng = mulberry32(REFIT_SEED);
  const ranks = new Map<string, number[]>(protocols.map((p) => [p.slug, []]));
  for (let k = 0; k < REFITS; k++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < comps.length; i++) sample.push(comps[Math.floor(rng() * comps.length)]!);
    const fit = fitModel(sample, form, model);
    const scored = protocols
      .map((p) => ({ slug: p.slug, implied: impliedValue(p, asOf, fit, sample, model).implied }))
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
  pool: SnapshotProtocol[],
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
    const v = impliedValue(p, snapshot.as_of, fit, pool, model);
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
    farm: farmEconomics(s.p, s.age, s.implied, s.kin, model),
    model: {
      multiple: round4(s.multiple),
      comp_count: s.comps,
      category_effect: round4(s.effect),
      growth_pct: round4(s.growthPct),
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      age_days: s.age,
      neighbours: s.neighbours,
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
 * The farm's time budget in minutes: 5 to set up the wallet, 15 to set up the position, 10 for
 * each weekly qualifying action, 10 to check the claim page before withdrawing, 5 to keep the
 * log. The hold itself is passive and costs no time.
 */
function timeMinutesFor(holdDays: number): number {
  return 5 + 15 + 10 * Math.ceil(holdDays / 7) + 10 + 5;
}

/**
 * What a farm costs, netted to the dollar: the capital the position needs plus every transaction's
 * gas over the hold, on the protocol's own first chain — and what it costs in time, and what the
 * launch's scale is per dollar and per hour of farming. The verdict follows from the net cost and
 * the launch's scale: a farm whose gas alone exceeds its capital, or whose launch is under $1M
 * implied, is a skip; gas over half the capital, or a launch under $10M implied, is thin; the
 * rest is a farm. The thresholds were recalibrated from radar-4's (skip at gas over half the
 * capital): on this snapshot every one of radar-4's 80 skips came from that gas rule alone, all
 * small-capital rows on expensive chains, so the skip line moved to where the fees exceed the
 * deposit itself.
 */
export function farmEconomics(
  p: SnapshotProtocol,
  age: number | null,
  implied: number,
  kin: Kin | null,
  model: ModelConstants = MODEL,
): FarmEconomics {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const transactions = transactionsFor(hold);
  const gas = round2(transactions * gasUsd(chainOf(p)));
  const net = round2(capital + gas);
  const gasShare = gas / capital;
  const timeHours = round2(timeMinutesFor(hold) / 60);
  let verdict: FarmEconomics['verdict'] = 'farm';
  if (implied < model.verdict_skip_implied_usd || gasShare > model.verdict_skip_gas_share) verdict = 'skip';
  else if (implied < model.verdict_thin_implied_usd || gasShare > model.verdict_thin_gas_share) verdict = 'thin';
  return {
    capital_usd: capital,
    gas_usd: gas,
    net_cost_usd: net,
    transactions,
    hold_days: hold,
    gas_share: round4(gasShare),
    time_hours: timeHours,
    implied_per_dollar: Math.round(implied / net),
    implied_per_hour: Math.round(implied / timeHours),
    kin,
    verdict,
  };
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
    neighbours: row.model.neighbours,
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

/**
 * The audit: every pre-token protocol the board does not rank, with the reason, by TVL. A protocol
 * is excluded for being an exchange, for being a versioned pool of another protocol, or for both;
 * the audit names each one, so the 342 pre-token protocols are all accounted for: 289 ranked and
 * 53 excluded with a reason.
 */
export function auditOf(snapshot: Snapshot, board: BoardRow[]): AuditRow[] {
  const onBoard = new Set(board.map((r) => r.slug));
  return snapshot.protocols
    .filter((p) => isPreToken(p) && !onBoard.has(p.slug))
    .map((p) => {
      const isCex = p.category === 'CEX';
      const isVersioned = VERSIONED.test(p.name);
      return {
        slug: p.slug,
        name: p.name,
        category: p.category,
        tvl_usd: p.tvl_usd,
        reason: isCex && isVersioned ? 'exchange + versioned pool' : isCex ? 'exchange' : 'versioned pool',
      };
    })
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const comps = compSet(snapshot);
  const { forms, validation } = validateAll(comps, model);
  const fit = fitModel(comps, validation.chosen_form, model);
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
  const ranges = rankRanges(boardProtos, comps, snapshot.as_of, validation.chosen_form, model);
  const board = buildBoard(snapshot, fit, comps, ranges, model);
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
    audit: auditOf(snapshot, board),
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
    if (!Number.isFinite(r.farm.implied_per_dollar) || r.farm.implied_per_dollar <= 0) return `${r.slug} has implied-per-dollar ${r.farm.implied_per_dollar}`;
    if (!Number.isFinite(r.model.neighbours.weight) || r.model.neighbours.weight < 0 || r.model.neighbours.weight > 1) return `${r.slug} has neighbour weight ${r.model.neighbours.weight}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
