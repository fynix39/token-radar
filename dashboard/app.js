// Token Radar dashboard: renders window.RADAR (written by main.ts) with no network.
// The value model is radar-4: a log-log comps curve fitted on the snapshot's trading protocols,
// validated out of sample (leave-one-out + a walk-forward split), with rank ranges from 200
// bootstrap refits and every farm plan netted to the dollar. Query params for screenshots:
// ?shot=detail&slug=<slug> opens a detail view, ?shot=filtered&category=<name> applies a
// category filter, ?shot=validation scrolls to the model and validation panel.
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
  $('kpi-slope').textContent = f.slope.toFixed(2);
  $('kpi-slope-sub').textContent = 'log(mcap) = ' + f.intercept.toFixed(2) + ' + ' + f.slope.toFixed(2) +
    '·log(TVL), R² ' + f.r2.toFixed(2) + ', ' + f.comps + ' comps';

  // Model transparency: the fitted curve, its validation, and the category effects it derived.
  $('model-text').textContent =
    'Implied value = exp(' + f.intercept.toFixed(2) + ' + ' + f.slope.toFixed(2) +
    '·log(TVL) + category effect) × growth × maturity × chain breadth. The curve is fitted by least ' +
    'squares on the ' + f.comps + ' protocols that already trade: the slope of ' + f.slope.toFixed(2) +
    ' says bigger protocols trade at lower multiples, so the curve values size sub-linearly, and each ' +
    'category adds its own shrunk effect (the median residual of its trading peers, pulled toward zero ' +
    'where peers are thin, capped at ' + f.residual_cap.toFixed(2) + '). A category with no trading peer ' +
    'gets no effect at all, never an invented number.';
  $('valid-rows').innerHTML =
    '<dt>Leave-one-out, ' + v.loo_n + ' comps</dt><dd>median |log error| ' +
    v.loo_median_abs_log_error.toFixed(2) + ' (' + factor(v.loo_median_abs_log_error) +
    '), ' + Math.round(v.loo_hit_within_2x * 100) + '% predicted within 2×</dd>' +
    '<dt>Same test, flat-median model</dt><dd>median |log error| ' +
    v.loo_median_abs_log_error_baseline.toFixed(2) + ' (' + factor(v.loo_median_abs_log_error_baseline) +
    '), ' + Math.round(v.loo_hit_within_2x_baseline * 100) + '% within 2× — the fitted curve beats it</dd>' +
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
        '<td>' + verdictBadge(r.farm) + '</td></tr>';
    }).join('');
    $('count').textContent = rows.length + ' of ' + R.board_size + ' protocols shown.';
    renderDetail();
  }

  function verdictWhy(r) {
    var gasShare = r.farm.gas_usd / r.farm.capital_usd;
    if (r.farm.verdict === 'skip') {
      if (r.implied_value_usd < R.model.verdict_skip_implied_usd) return 'launch under $1M implied';
      return 'gas is ' + Math.round(gasShare * 100) + '% of the capital';
    }
    if (r.farm.verdict === 'thin') {
      if (r.implied_value_usd < R.model.verdict_thin_implied_usd) return 'launch under $10M implied';
      return 'gas is ' + Math.round(gasShare * 100) + '% of the capital';
    }
    return 'net cost small against a launch over $10M implied';
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
      '<dl>' +
      '<dt>TVL</dt><dd>' + money(r.tvl_usd) + '</dd>' +
      '<dt>7d change</dt><dd>' + pct(r.change_7d) + '</dd>' +
      '<dt>Age</dt><dd>' + (r.age_days === null ? 'unknown' : r.age_days + ' days') + '</dd>' +
      '<dt>Fitted multiple</dt><dd>' + r.multiple.toFixed(3) + ' (' + r.comp_count + ' peers, effect ' +
      (r.category_effect >= 0 ? '+' : '') + r.category_effect.toFixed(2) + ')</dd>' +
      '<dt>Growth ×</dt><dd>' + r.growth_multiplier.toFixed(2) + '</dd>' +
      '<dt>Maturity ×</dt><dd>' + r.maturity_multiplier.toFixed(2) + '</dd>' +
      '<dt>Chain breadth ×</dt><dd>' + r.chain_multiplier.toFixed(2) + '</dd>' +
      '</dl>' +
      '<h3>Farm plan — ' + verdictBadge(r.farm) + '</h3>' +
      '<p class="net">Net cost ' + dollars(r.farm.net_cost_usd) + ': ' + dollars(r.farm.capital_usd) +
      ' capital + ' + dollars(r.farm.gas_usd) + ' gas over ' + r.farm.transactions + ' transactions, ' +
      r.farm.hold_days + ' days. ' + verdictWhy(r) + '.</p>' +
      '<ol>' +
      r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      '</ol>';
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
  }
  render();
})();
