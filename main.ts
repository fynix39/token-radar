// A token-radar-01 entry (Node 22, standard library only).
//
// The program reads the sealed snapshot from /input/snapshot.json (or --input <file|dir>), scores
// every pre-token protocol with the model in lib/model.ts, writes the ranked board to
// /output/board.json, and copies this repository's dashboard/ and screenshots/ to /output. Last, it
// writes /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// The dashboard is a static page, no framework and no network: dashboard/index.html, dashboard/app.css
// and dashboard/app.js read /output/data.js, which this program writes from the same board.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps (reference/gate.json): the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
// board.json's rows are the gate's shape; the extra top-level model block (allowed by the rules)
// carries the fitted curve and its validation, so the board file states how it was valued.
writeFileSync(
  join(out, 'board.json'),
  `${JSON.stringify({ rows: board, model: { version: radar.model_version, fit: radar.fit, validation: radar.validation, coverage: radar.coverage } })}\n`,
);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

const dash = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 4, the board, a detail view, the validation panel and the audit\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

const effects = radar.fit.by_category
  .filter((m) => m.comps > 0)
  .sort((a, b) => b.comps - a.comps)
  .slice(0, 5)
  .map((m) => `${m.category} x${m.factor.toFixed(2)} (n=${m.comps})`)
  .join(', ');
const v = radar.validation;
const c = radar.coverage;
const verdicts = { farm: 0, thin: 0, skip: 0 };
for (const r of board) verdicts[r.farm.verdict]++;
const formLine = v.forms.map((f) => `${f.form} ${f.combined}${f.chosen ? ' *' : ''}`).join(', ');
process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: curve form picked by two blind tests (LOO median + split median, lower wins): ${formLine}; winner ${v.chosen_form}\n` +
    `token radar: fitted curve log(mcap) = ${radar.fit.intercept.toFixed(2)} + ${radar.fit.slope.toFixed(2)} log(TVL), R2 ${radar.fit.r2.toFixed(2)}, from ${radar.fit.comps} live-token comps; largest effects: ${effects}\n` +
    `token radar: leave-one-out median |log error| ${v.loo_median_abs_log_error} (flat-median baseline ${v.loo_median_abs_log_error_baseline}), hit within 2x ${(v.loo_hit_within_2x * 100).toFixed(0)}% vs ${(v.loo_hit_within_2x_baseline * 100).toFixed(0)}%; split ${v.split_median_abs_log_error ?? 'n/a'} on ${v.split_test_n} held-out comps; walk-forward ${v.walkforward_median_abs_log_error ?? 'n/a'} on ${v.walkforward_test_n} newer comps; ranks from ${v.refits} refits\n` +
    `token radar: neighbours reported as comparables (kin + 8 nearest traded comps per row), blend weight 0 — five blend designs failed the split test, so the curve alone prices the board\n` +
    `token radar: farm verdicts farm ${verdicts.farm} / thin ${verdicts.thin} / skip ${verdicts.skip} (skip: gas over the capital, or implied under $1M)\n` +
    `token radar: coverage ${c.ranked} ranked + ${c.live} live + ${c.excluded} excluded (${c.excluded_cex} CEX, ${c.excluded_versioned} versioned) = ${c.total}; audit lists all ${radar.audit.length} excluded protocols with a reason\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${dash.length} files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
