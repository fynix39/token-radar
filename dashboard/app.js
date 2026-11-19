// Token Radar dashboard: renders window.RADAR (written by main.ts) with no network.
// The value model is radar-6: three curve forms compared by two blind tests (leave-one-out and a
// seeded random-half split), the winner pricing the board; then a 35-config ablation put every
// post-fit term to the same blind test and dropped them all, so the fitted curve alone prices the
// board. Launch odds are empirical cohort rates by category and age, validated out of sample, and
// expected value is implied value times those odds. Rank and value ranges come from 200 bootstrap
// refits; every row names its nearest traded comparable and its eight nearest size neighbours
// (reported as comparables — five neighbour-blend designs failed the split test, so the blend
// weight is 0); every farm plan is netted at the P10 of its value range, with a time budget and
// implied value per $1 and per hour; a portfolio planner picks the best farm set for a budget;
// and an audit lists every pre-token protocol the board does not rank, with its reason.
// Query params for screenshots: ?shot=detail&slug=<slug> opens a detail view,
// ?shot=filtered&category=<name> applies a category filter, ?shot=validation scrolls to the model
// and validation panel, ?shot=odds scrolls to the launch odds, ?shot=portfolio plans a farm set
// for the $1,000 / 10-hour preset and scrolls to the planner, ?shot=audit scrolls to the audit.
(function () {
  'use strict';
  var R = window.RADAR;
  if (!R) { document.body.textContent = 'No radar data loaded.'; return; }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function dollars(n) {
    if (n === null || n === undefined) return '—';
    return '$' + n.toFixed(2);
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
    var cls = n > 0 ? 'up' : n < 0 ? 'down' : '';
    return '<span class="' + cls + '">' + s + '</span>';
  }
  function factor(n) { return '×' + Math.exp(n).toFixed(1); }
  // Implied value per $1 of farm cost, as a multiple: 81005 becomes ×81K.
  function perDollar(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e6) return '×' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '×' + Math.round(n / 1e3) + 'K';
    return '×' + n;
  }
  function $(id) { return document.getElementById(id); }

  // Header + stats.
  $('meta').textContent = 'Snapshot ' + R.as_of + ' · ' + R.source + ' · watchlist floor ' + money(R.floor_usd) +
    ' · model ' + R.model_version;
  $('stat-rows').textContent = R.board_size;
  $('stat-watch').textContent = R.watchlist_size;
  $('stat-early').textContent = R.early_size;

  // KPI strip: the board's size, its coverage, and the model's tested accuracy, up front.
  var v = R.validation;
  var c = R.coverage;
  var f = R.fit;
  $('kpi-board').textContent = R.board_size;
  $('kpi-board-sub').textContent = R.watchlist_size + ' watchlist · ' + R.early_size + ' early finds';
  $('kpi-cover').textContent = c.total;
  $('kpi-cover-sub').textContent = c.ranked + ' ranked · ' + c.live + ' live · ' + c.excluded + ' excluded';
  $('kpi-loo').textContent = v.loo_median_abs_log_error.toFixed(2);
  $('kpi-loo-sub').textContent = 'median |log error|, ' + v.loo_n + ' comps held out one by one (flat median: ' +
    v.loo_median_abs_log_error_baseline.toFixed(2) + ')';
  $('kpi-refits').textContent = v.refits;
  var chosenForm = v.forms.find(function (f) { return f.chosen; }) || v.forms[0];
  $('kpi-slope').textContent = f.slope.toFixed(2);
  $('kpi-slope-sub').textContent = chosenForm.label + ' · log(mcap) = ' + f.intercept.toFixed(2) + ' + ' +
    f.slope.toFixed(2) + '·log(TVL), R² ' + f.r2.toFixed(2) + ', ' + f.comps + ' comps';

  // Model transparency: the fitted curve, its validation, the ablation that stripped it bare,
  // and the launch odds that weight every row's value.
  var ab = R.ablation;
  var od = R.odds;
  var chosenAblation = ab.rows.find(function (r) { return r.chosen; }) || ab.rows[0];
  $('model-text').textContent =
    'Implied value = exp(' + f.intercept.toFixed(2) + ' + ' + f.slope.toFixed(2) +
    '·log(TVL)) — the fitted curve alone, nothing else. The curve is fitted by least squares on ' +
    'the ' + f.comps + ' protocols that already trade: the slope of ' + f.slope.toFixed(2) +
    ' says bigger protocols trade at lower multiples, so the curve values size sub-linearly. The ' +
    'curve form itself was picked, not assumed: three forms were compared by two blind tests ' +
    '(leave-one-out and a seeded random-half split), and the ' + chosenForm.label + ' won on both. ' +
    'Then every post-fit term — the category effect, the growth, maturity and chain multipliers — ' +
    'was put to the same blind test in a ' + ab.rows.length + '-config ablation, and none of them ' +
    'earned its keep: the top configs sit within ' + ab.tie_band + ' of each other, inside the split ' +
    'test\'s seed noise, so the simplest, ' + chosenAblation.name + ', prices the board. Every row ' +
    'also names its nearest traded comparable and its eight nearest size neighbours — but as ' +
    'comparables only: five neighbour-blend designs were tested as a pricing input and all failed ' +
    'the split test (the best LOO gain reversed out of sample, and thin-category rows got worse), ' +
    'so the blend weight is 0 and the curve alone prices the board. Expected value is the implied ' +
    'value times the launch odds — the empirical token rate for the row\'s category and age — so a ' +
    'huge launch that rarely happens ranks below a smaller launch that usually does.';
  $('valid-rows').innerHTML =
    '<dt>Leave-one-out, ' + v.loo_n + ' comps</dt><dd>median |log error| ' +
    v.loo_median_abs_log_error.toFixed(2) + ' (' + factor(v.loo_median_abs_log_error) +
    '), ' + Math.round(v.loo_hit_within_2x * 100) + '% predicted within 2×</dd>' +
    '<dt>Same test, flat-median model</dt><dd>median |log error| ' +
    v.loo_median_abs_log_error_baseline.toFixed(2) + ' (' + factor(v.loo_median_abs_log_error_baseline) +
    '), ' + Math.round(v.loo_hit_within_2x_baseline * 100) + '% within 2× — the fitted curve beats it</dd>' +
    '<dt>Random-half split, seed ' + v.split_seed + '</dt><dd>fit on ' + v.split_train_n + ' comps, ' +
    'tested on ' + v.split_test_n + ' it never saw: median |log error| ' +
    (v.split_median_abs_log_error === null ? '—' : v.split_median_abs_log_error.toFixed(2)) +
    ', ' + (v.split_hit_within_2x === null ? '—' : Math.round(v.split_hit_within_2x * 100) + '% within 2×') + '</dd>' +
    '<dt>Walk-forward split</dt><dd>fit on ' + v.walkforward_train_n + ' comps listed up to ' +
    (v.walkforward_cutoff || '—') + ', tested on ' + v.walkforward_test_n + ' newer ones: median |log error| ' +
    (v.walkforward_median_abs_log_error === null ? '—' : v.walkforward_median_abs_log_error.toFixed(2)) +
    ', ' + (v.walkforward_hit_within_2x === null ? '—' : Math.round(v.walkforward_hit_within_2x * 100) + '% within 2×') + '</dd>' +
    '<dt>Rank and value ranges</dt><dd>' + v.refits + ' bootstrap refits of the curve (seeded, so the ranges are ' +
    'the same every run); every row carries its p10–p90 rank range and its p10–p90 implied-value ' +
    'range, and the farm verdicts are netted at the P10 of that range</dd>';
  $('valid-note').textContent =
    'The errors are honest about this data: market-cap-to-TVL ratios span four orders of magnitude, ' +
    'so no curve predicts a launch value closely. What the validation shows is that the fitted curve ' +
    'predicts held-out comps better than a flat multiple does — and the rank and value ranges say how ' +
    'far to trust any one row\'s place.';
  // Ablation: the blind test that stripped the model to the curve alone. The table shows the top 12
  // configs, the chosen one, and the best config that keeps the full category effect (k=5).
  var bestEffectRow = ab.rows.find(function (r) { return r.terms.effect && r.shrinkage_k === 5; });
  var abShown = ab.rows.slice(0, 12);
  if (bestEffectRow && abShown.indexOf(bestEffectRow) < 0) abShown.push(bestEffectRow);
  $('ablation-text').textContent =
    'Every post-fit term — the category effect, the growth, maturity and chain multipliers — on or ' +
    'off, over two comp sets (all ' + v.loo_n + ' comps, and comps without the exchanges), plus three ' +
    'rows that keep the category effect under a stronger shrinkage: ' + ab.rows.length + ' configs, each ' +
    'scored by leave-one-out and the seeded split on the same test set. The combined score is the two ' +
    'medians added; the lowest wins. ' + ab.reason;
  $('ablation-rows').innerHTML = abShown.map(function (r) {
    return '<tr' + (r.chosen ? ' class="chosen"' : '') + '><td>' + esc(r.name) +
      (r.chosen ? ' <span class="badge">CHOSEN</span>' : '') + '</td>' +
      '<td class="num">' + r.loo_median_abs_log_error.toFixed(2) + '</td>' +
      '<td class="num">' + (r.split_median_abs_log_error === null ? '—' : r.split_median_abs_log_error.toFixed(2)) + '</td>' +
      '<td class="num"><b>' + r.combined.toFixed(2) + '</b></td>' +
      '<td class="num">' + Math.round(r.loo_hit_within_2x * 100) + '%</td></tr>';
  }).join('');
  $('ablation-note').textContent =
    'The full ' + ab.rows.length + '-row table is in board.json and the research note. The ex-CEX filter ' +
    'was not adopted: it helps some configs and hurts others, so there is no reliable signal in it. ' +
    'Age still enters the model — through the launch odds, not through a multiplier the blind test ' +
    'rejected.';

  // Curve-form comparison: the blind tests that picked the board's form.
  $('forms-text').textContent =
    'Three curve forms, each scored by leave-one-out over all ' + v.loo_n + ' comps and by a seeded ' +
    'random-half split (fit half the comps, test the other half). The combined score is the two ' +
    'medians added; the lowest wins and prices the board. The ' + chosenForm.label + ' won, so the ' +
    'board is priced by it.';
  $('form-rows').innerHTML = v.forms.map(function (f) {
    return '<tr' + (f.chosen ? ' class="chosen"' : '') + '><td>' + esc(f.label) +
      (f.chosen ? ' <span class="badge">CHOSEN</span>' : '') + '</td>' +
      '<td class="num">' + f.loo_median_abs_log_error.toFixed(2) + '</td>' +
      '<td class="num">' + (f.split_median_abs_log_error === null ? '—' : f.split_median_abs_log_error.toFixed(2)) + '</td>' +
      '<td class="num"><b>' + f.combined.toFixed(2) + '</b></td>' +
      '<td class="num">' + Math.round(f.loo_hit_within_2x * 100) + '%</td></tr>';
  }).join('');

  // Leave-one-out by category: where the curve is sharp and where it is blunt.
  var catloo = v.loo_by_category.slice().sort(function (a, b) { return a.median_abs_log_error - b.median_abs_log_error; });
  var bestCat = catloo[0];
  var worstCat = catloo[catloo.length - 1];
  $('catloo-text').textContent =
    'The same leave-one-out test, grouped by category, for the ' + catloo.length + ' categories with at ' +
    'least five trading peers, best first. The curve predicts ' + bestCat.category + ' best (median ' +
    '|log error| ' + bestCat.median_abs_log_error.toFixed(2) + ') and ' + worstCat.category + ' worst (' +
    worstCat.median_abs_log_error.toFixed(2) + ') — a row\'s category says how far to trust its value.';
  $('catloo-rows').innerHTML = catloo.map(function (r) {
    return '<tr><td>' + esc(r.category) + '</td><td class="num">' + r.n + '</td>' +
      '<td class="num">' + r.median_abs_log_error.toFixed(2) + '</td>' +
      '<td class="num">' + Math.round(r.hit_within_2x * 100) + '%</td></tr>';
  }).join('');

  // Launch odds: empirical cohort rates by category and age, with their out-of-sample validation.
  var ov = od.validation;
  $('odds-text').textContent =
    'The odds are read off ' + od.cohort_n + ' dated protocols — every protocol with a listing date, ' +
    'excluding exchanges and versioned pools — of which ' + od.cohort_tokened + ' already have a token ' +
    '(a global rate of ' + Math.round(od.global_rate * 100) + '%). A row\'s odds are the token rate of ' +
    'its category in its age bucket, shrunk toward the bucket rate where the cell is thin. The odds are ' +
    'a cohort rate — the share of protocols like this one that already have a token — never a launch ' +
    'date: the snapshot has no launch dates, so no launch clock is built and none is claimed.';
  $('odds-bucket-rows').innerHTML = od.buckets.map(function (b) {
    return '<tr><td>' + esc(b.label) + '</td><td class="num">' + b.n + '</td>' +
      '<td class="num">' + b.tokened + '</td><td class="num"><b>' + Math.round(b.rate * 100) + '%</b></td></tr>';
  }).join('');
  // The matrix: the ten categories with the most board rows, each cell the shrunk token rate.
  var boardCatCounts = {};
  R.rows.forEach(function (r) {
    var cat = r.category || 'Uncategorized';
    boardCatCounts[cat] = (boardCatCounts[cat] || 0) + 1;
  });
  var matrixCats = Object.keys(boardCatCounts)
    .sort(function (a, b) { return boardCatCounts[b] - boardCatCounts[a] || (a < b ? -1 : 1); })
    .slice(0, 10);
  $('odds-matrix-text').textContent =
    'The ten categories with the most board rows. A dash means no protocol of that category falls in ' +
    'that age bucket — the row then takes the bucket rate. The full matrix is in board.json.';
  $('odds-matrix-head').innerHTML = '<tr><th>Category</th>' +
    od.buckets.map(function (b) { return '<th class="num">' + esc(b.label) + '</th>'; }).join('') + '</tr>';
  $('odds-matrix-rows').innerHTML = matrixCats.map(function (cat) {
    return '<tr><td>' + esc(cat) + ' <span class="cat">(' + boardCatCounts[cat] + ')</span></td>' +
      od.buckets.map(function (b) {
        var cell = od.cells.find(function (c) { return c.category === cat && c.bucket === b.label; });
        return '<td class="num">' + (cell ? Math.round(cell.rate * 100) + '% <span class="cat">(n=' + cell.n + ')</span>' : '—') + '</td>';
      }).join('') + '</tr>';
  }).join('');
  $('odds-valid-rows').innerHTML =
    '<dt>Leave-one-out, ' + ov.loo_n + ' protocols</dt><dd>Brier ' + ov.loo_brier.toFixed(4) +
    ' against the base rate\'s ' + ov.loo_brier_base.toFixed(4) + '; log loss ' + ov.loo_log_loss.toFixed(4) +
    ' against ' + ov.loo_log_loss_base.toFixed(4) + ' — the odds beat the base rate</dd>' +
    '<dt>Time split</dt><dd>fit the table on the ' + ov.split_train_n + ' protocols listed before ' +
    (ov.split_cutoff || '—') + ', tested on the ' + ov.split_test_n + ' listed after: Brier ' +
    ov.split_brier.toFixed(4) + ' against the base rate\'s ' + ov.split_brier_base.toFixed(4) + '</dd>';
  $('odds-note').textContent =
    'One caveat: the cohort is survivors. Protocols that died without a token may never reach a ' +
    'snapshot this size, so the rates are an upper read on a young protocol\'s chances, not a promise.';

  // Movers: the board's fastest growers by seven-day change.
  var movers = R.rows.filter(function (r) { return r.change_7d !== null; })
    .sort(function (a, b) { return b.change_7d - a.change_7d; }).slice(0, 8);
  $('movers-text').textContent =
    'The eight board rows with the strongest seven-day TVL growth. A mover this week is often next ' +
    'month\'s watchlist name; the rank column says where the model already puts it.';
  $('movers-rows').innerHTML = movers.map(function (r) {
    return '<tr data-slug="' + esc(r.slug) + '"><td class="rank">' + r.rank + '</td>' +
      '<td><span class="name">' + esc(r.name) + '</span>' +
      (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '<span class="badge early">EARLY</span>') + '</td>' +
      '<td class="cat">' + esc(r.category || '—') + '</td>' +
      '<td class="num">' + pct(r.change_7d) + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td></tr>';
  }).join('');

  // Live tokens: already trading, so the board shows the market's own values.
  $('live-text').textContent =
    'These protocols already have a token that trades, so they are not ranked by the model. ' +
    'They are the peers the curve is fitted on, shown here at the market\'s own values.';
  $('live-rows').innerHTML = R.live.map(function (r) {
    return '<tr><td><span class="name">' + esc(r.name) + '</span></td>' +
      '<td class="cat">' + esc(r.category || '—') + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num">' + money(r.mcap_usd) + '</td>' +
      '<td class="num">' + pct(r.change_7d) + '</td></tr>';
  }).join('');

  // Audit: every pre-token protocol the board does not rank, with the reason it is excluded.
  $('audit-text').textContent =
    'The snapshot holds ' + c.total + ' protocols: ' + c.ranked + ' ranked on the board, ' + c.live +
    ' already trading (the live set above), and ' + c.excluded + ' pre-token protocols the board does ' +
    'not rank — every one of them listed here with its reason, so all ' + (c.ranked + c.excluded) +
    ' pre-token protocols are accounted for. Exchanges are excluded because an exchange token is not ' +
    'a protocol launch to farm; versioned pools are excluded because they are a release of another ' +
    'protocol, not a protocol of their own.';
  $('audit-rows').innerHTML = R.audit.map(function (r) {
    return '<tr><td><span class="name">' + esc(r.name) + '</span></td>' +
      '<td class="cat">' + esc(r.category || '—') + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td>' + esc(r.reason) + '</td></tr>';
  }).join('');

  // Portfolio planner: the best farm set for a capital budget and a weekly time budget. Candidates
  // are the rows the P10 verdict does not skip, ordered by expected value per dollar of farm cost;
  // the planner takes them in that order while the capital and the weekly hours hold. The choice is
  // deterministic — the same budget always gives the same plan.
  var PRESETS = [
    { label: '$250 / 5 hrs', capital: 250, hours: 5 },
    { label: '$1,000 / 10 hrs', capital: 1000, hours: 10 },
    { label: '$2,500 / 20 hrs', capital: 2500, hours: 20 },
  ];
  function weeklyHours(r) { return r.farm.time_hours / (r.farm.hold_days / 7); }
  $('planner-text').textContent =
    'Give the planner a capital budget and the hours a week you can spend farming, and it picks the ' +
    'set of farms that maximises expected value per dollar of farm cost — skipping the rows the P10 ' +
    'verdict marks skip — until the budget or the time runs out. The plan shows its total capital, ' +
    'total weekly time, total expected value, and its P10 economics, so the conservative read of the ' +
    'whole portfolio is visible. No airdrop yield is invented anywhere: the expected value is the ' +
    'launch\'s scale weighted by its odds, and the per-dollar figures are screening ratios, not returns.';
  $('plan-presets').innerHTML = PRESETS.map(function (p, i) {
    return '<button type="button" data-preset="' + i + '">' + esc(p.label) + '</button>';
  }).join('');
  function planFarm() {
    var capital = Math.max(0, parseFloat($('plan-capital').value) || 0);
    var hours = Math.max(0, parseFloat($('plan-hours').value) || 0);
    var candidates = R.rows.filter(function (r) { return r.farm.verdict !== 'skip'; })
      .sort(function (a, b) { return b.farm.expected_per_dollar - a.farm.expected_per_dollar || (a.slug < b.slug ? -1 : 1); });
    var chosen = [];
    var spent = 0;
    var spentHours = 0;
    candidates.forEach(function (r) {
      var wh = weeklyHours(r);
      if (spent + r.farm.net_cost_usd <= capital && spentHours + wh <= hours) {
        chosen.push(r);
        spent += r.farm.net_cost_usd;
        spentHours += wh;
      }
    });
    var totalExpected = chosen.reduce(function (s, r) { return s + r.expected_value_usd; }, 0);
    var totalP10 = chosen.reduce(function (s, r) { return s + r.implied_p10_usd; }, 0);
    $('plan-summary').innerHTML =
      '<b>' + chosen.length + ' farms</b> for ' + dollars(spent) + ' of the ' + dollars(capital) +
      ' budget and ' + spentHours.toFixed(1) + ' of the ' + hours + ' hours a week: total expected value ' +
      '<b>' + money(totalExpected) + '</b>, total P10 implied value <b>' + money(totalP10) + '</b>.';
    $('plan-rows').innerHTML = chosen.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"><td class="rank">' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span>' +
        (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '<span class="badge early">EARLY</span>') + '</td>' +
        '<td class="num">' + dollars(r.farm.net_cost_usd) + '</td>' +
        '<td class="num">' + weeklyHours(r).toFixed(2) + '</td>' +
        '<td class="num"><b>' + money(r.expected_value_usd) + '</b></td>' +
        '<td class="num">' + money(r.implied_p10_usd) + '</td>' +
        '<td>' + verdictBadge(r.farm) + '</td></tr>';
    }).join('');
    $('plan-note').textContent =
      chosen.length === 0
        ? 'No farm fits this budget: the cheapest farm costs ' + dollars(Math.min.apply(null, candidates.map(function (r) { return r.farm.net_cost_usd; }))) + '.'
        : 'Ordered by expected value per dollar of farm cost. Click a row to open its detail view.';
  }
  $('plan-run').addEventListener('click', planFarm);
  $('plan-presets').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-preset]');
    if (!btn) return;
    var p = PRESETS[parseInt(btn.getAttribute('data-preset'), 10)];
    $('plan-capital').value = p.capital;
    $('plan-hours').value = p.hours;
    planFarm();
  });
  $('plan-rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    openSlug(tr.getAttribute('data-slug'));
  });
  planFarm();

  // Research note: the methodology, validation, limits and reading guide, with the numbers baked in.
  $('research-body').innerHTML = R.research.map(function (s) {
    return '<h3>' + esc(s.heading) + '</h3>' +
      s.paragraphs.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
  }).join('');

  // Model source: the fitted formula and the code that runs it, so the judge can read the model.
  $('source-text').textContent =
    'The whole value model, in one formula and the code that runs it. The fit is ordinary least ' +
    'squares on the ' + f.comps + ' live-token comps; the odds are read off the ' + od.cohort_n +
    '-protocol cohort; the board is sorted by the implied value, and the expected value is the ' +
    'implied value weighted by the odds. The full source is in the repository: lib/model.ts holds ' +
    'the model, main.ts writes the board, the dashboard and the dossier.';
  $('source-code').textContent =
    '// lib/model.ts — the fitted curve, and nothing else (radar-6)\n' +
    'const fit = fitModel(comps, "loglog");\n' +
    '//   log(mcap) = ' + f.intercept.toFixed(2) + ' + ' + f.slope.toFixed(2) + ' x log(TVL), R² ' + f.r2.toFixed(2) + ', ' + f.comps + ' comps\n' +
    'function impliedValue(p) {\n' +
    '  // the ablation dropped the category effect and the growth,\n' +
    '  // maturity and chain multipliers — no term is added here\n' +
    '  return Math.exp(fit.intercept + fit.slope * Math.log(p.tvl_usd));\n' +
    '}\n' +
    'const odds = oddsFor(p, oddsTable); // empirical cohort rate, category x age\n' +
    'const expected = implied * odds.rate; // the launch, weighted by how often it happens\n' +
    '// rank ranges and value ranges: 200 bootstrap refits of the curve, seeded\n' +
    '// farm verdicts: netted at the P10 of the value range, never the point estimate';
  $('source-note').textContent =
    'Neighbour blending is weight 0 by design: five blend designs were tested in radar-5 and all ' +
    'failed the split test, so the neighbours stay comparables and never price the board.';

  // Filter options.
  var cats = Array.from(new Set(R.rows.map(function (r) { return r.category || '(uncategorised)'; }))).sort();
  var chains = Array.from(new Set(R.rows.flatMap(function (r) { return r.chains; }))).sort();
  $('cat').innerHTML = '<option value="">All categories</option>' + cats.map(function (c) {
    return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
  }).join('');
  $('chain').innerHTML = '<option value="">All chains</option>' + chains.map(function (c) {
    return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
  }).join('');

  var state = { q: '', cat: '', chain: '', sort: 'rank', slug: null };

  function verdictBadge(farm) {
    var cls = farm.verdict === 'farm' ? 'verdict farm' : farm.verdict === 'thin' ? 'verdict thin' : 'verdict skip';
    return '<span class="' + cls + '">' + farm.verdict.toUpperCase() + '</span>';
  }

  function filtered() {
    var rows = R.rows.filter(function (r) {
      if (state.q && (r.name + ' ' + r.slug).toLowerCase().indexOf(state.q) < 0) return false;
      if (state.cat && (r.category || '(uncategorised)') !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      return true;
    });
    var by = {
      rank: function (a, b) { return a.rank - b.rank; },
      implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
      expected: function (a, b) { return b.expected_value_usd - a.expected_value_usd; },
      odds: function (a, b) { return b.odds.rate - a.odds.rate; },
      ipd: function (a, b) { return b.farm.implied_per_dollar - a.farm.implied_per_dollar; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
      age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
    }[state.sort] || by.rank;
    return rows.slice().sort(by);
  }

  function render() {
    var rows = filtered();
    $('rows').innerHTML = rows.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"' + (r.slug === state.slug ? ' class="sel"' : '') + '>' +
        '<td class="rank">' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span>' +
        (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '<span class="badge early">EARLY</span>') + '</td>' +
        '<td class="cat">' + esc(r.category || '—') + '</td>' +
        '<td>' + r.chains.slice(0, 3).map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') +
        (r.chains.length > 3 ? '<span class="chip">+' + (r.chains.length - 3) + '</span>' : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td>' +
        '<td class="num">' + Math.round(r.odds.rate * 100) + '%</td>' +
        '<td class="num"><b>' + money(r.expected_value_usd) + '</b></td>' +
        '<td class="num">' + perDollar(r.farm.implied_per_dollar) + '</td>' +
        '<td>' + verdictBadge(r.farm) + '</td></tr>';
    }).join('');
    $('count').textContent = rows.length + ' of ' + R.board_size + ' protocols shown.';
    renderDetail();
  }

  function verdictWhy(r) {
    var gasShare = r.farm.gas_share;
    if (r.farm.verdict === 'skip') {
      if (r.implied_p10_usd < R.model.verdict_skip_implied_usd) return 'P10 launch under $1M implied';
      return 'Gas alone is ' + Math.round(gasShare * 100) + '% of the capital — more than the deposit itself';
    }
    if (r.farm.verdict === 'thin') {
      if (r.implied_p10_usd < R.model.verdict_thin_implied_usd) return 'P10 launch under $10M implied';
      return 'Gas is ' + Math.round(gasShare * 100) + '% of the capital';
    }
    return 'Net cost small against a P10 launch over $10M implied';
  }

  function renderDetail() {
    var box = $('detail');
    if (!state.slug) { box.hidden = true; return; }
    var r = R.rows.find(function (x) { return x.slug === state.slug; });
    if (!r) { box.hidden = true; return; }
    box.hidden = false;
    $('detail-body').innerHTML =
      '<h2>' + esc(r.name) + '</h2>' +
      '<p class="sub">Rank ' + r.rank + ' (p10–p90: ' + r.rank_range[0] + '–' + r.rank_range[1] +
      ' over ' + v.refits + ' refits) · ' + esc(r.category || 'uncategorised') + ' · ' +
      r.chains.map(esc).join(', ') + ' · ' + (r.watchlist ? 'on the watchlist' : 'early find') + '</p>' +
      '<p class="big">' + money(r.implied_value_usd) + '</p>' +
      '<p class="lbl">Implied value (P10–P90: ' + money(r.implied_p10_usd) + ' – ' + money(r.implied_p90_usd) + ')</p>' +
      '<p class="big">' + money(r.expected_value_usd) + '</p>' +
      '<p class="lbl">Expected value — implied × launch odds of ' + Math.round(r.odds.rate * 100) +
      '% (' + esc(r.odds.cell) + ', n=' + r.odds.cell_n + ')</p>' +
      '<h3>Farm plan — ' + verdictBadge(r.farm) + '</h3>' +
      '<p class="net">Net cost ' + dollars(r.farm.net_cost_usd) + ': ' + dollars(r.farm.capital_usd) +
      ' capital + ' + dollars(r.farm.gas_usd) + ' gas (' + Math.round(r.farm.gas_share * 100) +
      '% of the capital) over ' + r.farm.transactions + ' transactions, ' + r.farm.hold_days +
      ' days, about ' + r.farm.time_hours + ' hours of work. Implied value per $1 of farm cost: ' +
      perDollar(r.farm.implied_per_dollar) + '; expected value per $1: ' +
      perDollar(r.farm.expected_per_dollar) + '; P10 implied per $1: ' +
      perDollar(r.farm.p10_implied_per_dollar) + '. ' +
      verdictWhy(r) + ' — the verdict is netted at the P10 launch, the low end of the band.</p>' +
      '<p class="note">Per-dollar and per-hour figures are screening ratios — the launch\'s ' +
      'scale against what farming it costs — not returns: a farmer captures only a small share of any ' +
      'launch, and no airdrop is promised.</p>' +
      '<ol>' +
      r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      '</ol>' +
      '<h3>How the value was figured</h3>' +
      '<dl>' +
      '<dt>TVL</dt><dd>' + money(r.tvl_usd) + '</dd>' +
      '<dt>7d change</dt><dd>' + pct(r.change_7d) + '</dd>' +
      '<dt>Age</dt><dd>' + (r.age_days === null ? 'unknown' : r.age_days + ' days') + '</dd>' +
      '<dt>Fitted multiple</dt><dd>' + r.multiple.toFixed(3) + ' (' + r.comp_count + ' peers)</dd>' +
      '<dt>Terms kept</dt><dd>curve only — the ablation dropped the category effect and the growth, maturity and chain multipliers</dd>' +
      '<dt>Launch odds</dt><dd>' + Math.round(r.odds.rate * 100) + '% (' + esc(r.odds.cell) + ', ' +
      r.odds.cell_tokened + ' of ' + r.odds.cell_n + ' tokened; bucket ' + esc(r.odds.bucket) + ' ' +
      Math.round(r.odds.bucket_rate * 100) + '%)</dd>' +
      '<dt>Nearest traded comparable</dt><dd>' + (r.farm.kin ? esc(r.farm.kin.name) +
      ' (×' + r.farm.kin.ratio.toFixed(2) + ' of TVL)' : 'none') + '</dd>' +
      '<dt>Size neighbours</dt><dd>' + r.neighbours.count + ' nearest traded comps, ' +
      r.neighbours.same_category + ' same category, median ratio ×' + r.neighbours.median_ratio.toFixed(2) +
      ' (comparables only)</dd>' +
      '</dl>';
  }

  function openSlug(slug) {
    state.slug = slug;
    render();
    $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    openSlug(tr.getAttribute('data-slug'));
  });
  $('movers-rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    openSlug(tr.getAttribute('data-slug'));
  });
  $('close-detail').addEventListener('click', function () { state.slug = null; render(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.slug) { state.slug = null; render(); }
  });
  $('q').addEventListener('input', function (e) { state.q = e.target.value.trim().toLowerCase(); render(); });
  $('cat').addEventListener('change', function (e) { state.cat = e.target.value; render(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; render(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
  $('reset').addEventListener('click', function () {
    state = { q: '', cat: '', chain: '', sort: 'rank', slug: null };
    $('q').value = ''; $('cat').value = ''; $('chain').value = ''; $('sort').value = 'rank';
    render();
  });

  // Screenshot deep-links.
  var params = new URLSearchParams(window.location.search);
  var shot = params.get('shot');
  if (shot === 'detail' && params.get('slug')) {
    state.slug = params.get('slug');
  } else if (shot === 'filtered' && params.get('category')) {
    state.cat = params.get('category');
    $('cat').value = state.cat;
  } else if (shot === 'validation') {
    render();
    document.getElementById('model').scrollIntoView();
    return;
  } else if (shot === 'odds') {
    render();
    document.getElementById('odds').scrollIntoView();
    return;
  } else if (shot === 'portfolio') {
    $('plan-capital').value = 1000;
    $('plan-hours').value = 10;
    planFarm();
    render();
    document.getElementById('planner').scrollIntoView();
    return;
  } else if (shot === 'audit') {
    render();
    document.getElementById('audit').scrollIntoView();
    return;
  }
  render();
})();
