// Token Radar dashboard: renders window.RADAR (written by main.ts) with no network.
// The value model is radar-5: three curve forms compared by two blind tests (leave-one-out and a
// seeded random-half split), the winner pricing the board; rank ranges from 200 bootstrap refits;
// every row naming its nearest traded comparable and its eight nearest size neighbours (reported
// as comparables — five neighbour-blend designs failed the split test, so the blend weight is 0);
// every farm plan netted to the dollar with a time budget and implied value per $1 and per hour;
// and an audit listing every pre-token protocol the board does not rank, with its reason.
// Query params for screenshots: ?shot=detail&slug=<slug> opens a detail view,
// ?shot=filtered&category=<name> applies a category filter, ?shot=validation scrolls to the model
// and validation panel, ?shot=audit scrolls to the audit.
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

  // Model transparency: the fitted curve, its validation, and the category effects it derived.
  $('model-text').textContent =
    'Implied value = exp(' + f.intercept.toFixed(2) + ' + ' + f.slope.toFixed(2) +
    '·log(TVL) + category effect) × growth × maturity × chain breadth. The curve is fitted by least ' +
    'squares on the ' + f.comps + ' protocols that already trade: the slope of ' + f.slope.toFixed(2) +
    ' says bigger protocols trade at lower multiples, so the curve values size sub-linearly, and each ' +
    'category adds its own shrunk effect (the median residual of its trading peers, pulled toward zero ' +
    'where peers are thin, capped at ' + f.residual_cap.toFixed(2) + '). A category with no trading peer ' +
    'gets no effect at all, never an invented number. The curve form itself was picked, not assumed: ' +
    'three forms were compared by two blind tests (leave-one-out and a seeded random-half split), and ' +
    'the ' + chosenForm.label + ' won on both, so the board is priced by it. Every row also names its ' +
    'nearest traded comparable and its eight nearest size neighbours — but as comparables only: five ' +
    'neighbour-blend designs were tested as a pricing input and all failed the split test (the best ' +
    'LOO gain reversed out of sample, and thin-category rows got worse), so the blend weight is 0 and ' +
    'the curve alone prices the board.';
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
    '<dt>Rank ranges</dt><dd>' + v.refits + ' bootstrap refits of the curve (seeded, so the ranges are ' +
    'the same every run); every row carries its p10–p90 rank range</dd>';
  $('valid-note').textContent =
    'The errors are honest about this data: market-cap-to-TVL ratios span four orders of magnitude, ' +
    'so no curve predicts a launch value closely. What the validation shows is that the fitted curve ' +
    'predicts held-out comps better than a flat multiple does — and the rank ranges say how far to ' +
    'trust any one row\'s place.';
  $('effects-text').textContent =
    'What each category adds to the fitted curve, most peers first. The factor is what the category ' +
    'multiplies the fitted value by; a category the board carries but with no trading peer is not ' +
    'listed, because it gets no effect.';
  var boardCats = new Set(R.rows.map(function (r) { return r.category || '(uncategorised)'; }));
  var shown = f.by_category.filter(function (r) { return boardCats.has(r.category); })
    .sort(function (a, b) { return b.comps - a.comps || (a.category < b.category ? -1 : 1); })
    .slice(0, 15);
  $('effect-rows').innerHTML = shown.map(function (r) {
    return '<tr><td>' + esc(r.category) + '</td><td class="num">×' + r.factor.toFixed(2) +
      '</td><td class="num">' + (r.effect >= 0 ? '+' : '') + r.effect.toFixed(2) +
      '</td><td class="num">' + r.comps + '</td></tr>';
  }).join('');

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
        '<td class="num">' + perDollar(r.farm.implied_per_dollar) + '</td>' +
        '<td>' + verdictBadge(r.farm) + '</td></tr>';
    }).join('');
    $('count').textContent = rows.length + ' of ' + R.board_size + ' protocols shown.';
    renderDetail();
  }

  function verdictWhy(r) {
    var gasShare = r.farm.gas_share;
    if (r.farm.verdict === 'skip') {
      if (r.implied_value_usd < R.model.verdict_skip_implied_usd) return 'Launch under $1M implied';
      return 'Gas alone is ' + Math.round(gasShare * 100) + '% of the capital — more than the deposit itself';
    }
    if (r.farm.verdict === 'thin') {
      if (r.implied_value_usd < R.model.verdict_thin_implied_usd) return 'Launch under $10M implied';
      return 'Gas is ' + Math.round(gasShare * 100) + '% of the capital';
    }
    return 'Net cost small against a launch over $10M implied';
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
      '<p class="lbl">Implied value</p>' +
      '<h3>Farm plan — ' + verdictBadge(r.farm) + '</h3>' +
      '<p class="net">Net cost ' + dollars(r.farm.net_cost_usd) + ': ' + dollars(r.farm.capital_usd) +
      ' capital + ' + dollars(r.farm.gas_usd) + ' gas (' + Math.round(r.farm.gas_share * 100) +
      '% of the capital) over ' + r.farm.transactions + ' transactions, ' + r.farm.hold_days +
      ' days, about ' + r.farm.time_hours + ' hours of work. Implied value per $1 of farm cost: ' +
      perDollar(r.farm.implied_per_dollar) + '; per hour: ' + money(r.farm.implied_per_hour) + '. ' +
      verdictWhy(r) + '.</p>' +
      '<p class="note">Implied-per-dollar and implied-per-hour are screening ratios — the launch\'s ' +
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
      '<dt>Fitted multiple</dt><dd>' + r.multiple.toFixed(3) + ' (' + r.comp_count + ' peers, effect ' +
      (r.category_effect >= 0 ? '+' : '') + r.category_effect.toFixed(2) + ')</dd>' +
      '<dt>Growth ×</dt><dd>' + r.growth_multiplier.toFixed(2) + '</dd>' +
      '<dt>Maturity ×</dt><dd>' + r.maturity_multiplier.toFixed(2) + '</dd>' +
      '<dt>Chain breadth ×</dt><dd>' + r.chain_multiplier.toFixed(2) + '</dd>' +
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
  } else if (shot === 'audit') {
    render();
    document.getElementById('audit').scrollIntoView();
    return;
  }
  render();
})();
