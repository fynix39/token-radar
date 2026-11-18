// Token Radar dashboard: renders window.RADAR (written by main.ts) with no network.
// Query params for screenshots: ?shot=detail&slug=<slug> opens a detail view,
// ?shot=filtered&category=<name> applies a category filter.
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
  function pct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
    var cls = n > 0 ? 'up' : n < 0 ? 'down' : '';
    return '<span class="' + cls + '">' + s + '</span>';
  }
  function $(id) { return document.getElementById(id); }

  // Header + stats.
  $('meta').textContent = 'Snapshot ' + R.as_of + ' · ' + R.source + ' · watchlist floor ' + money(R.floor_usd);
  $('stat-rows').textContent = R.board_size;
  $('stat-watch').textContent = R.watchlist_size;
  $('stat-early').textContent = R.early_size;

  // Model transparency: the multiples table the model derived, for the
  // categories on this board, most peers first.
  var m = R.multiples;
  $('model-text').textContent =
    'Implied value = TVL × category multiple × growth × maturity × chain breadth. The multiple comes ' +
    'from the ' + m.live_count + ' protocols that already trade: the median market-cap-to-TVL of each ' +
    'category, shrunk toward the overall median of ' + m.overall_median.toFixed(3) + ' where peers are ' +
    'thin, and capped at ' + m.multiple_cap.toFixed(3) + ', the 90th percentile of all live ratios, so ' +
    'one extreme peer cannot set a whole category\'s price. A category with no trading peer is valued ' +
    'at the overall median, never at an invented number.';
  var boardCats = new Set(R.rows.map(function (r) { return r.category || '(uncategorised)'; }));
  var shown = m.by_category.filter(function (r) { return boardCats.has(r.category); })
    .sort(function (a, b) { return b.comps - a.comps || (a.category < b.category ? -1 : 1); })
    .slice(0, 15);
  $('multiple-rows').innerHTML = shown.map(function (r) {
    return '<tr><td>' + esc(r.category) + '</td><td class="num">' + r.multiple.toFixed(3) +
      '</td><td class="num">' + r.comps + '</td></tr>';
  }).join('');

  // Live tokens: already trading, so the board shows the market's own values.
  $('live-text').textContent =
    'These protocols already have a token that trades, so they are not ranked by the model. ' +
    'They are the peers the multiples are measured from, shown here at the market\'s own values.';
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
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td></tr>';
    }).join('');
    $('count').textContent = rows.length + ' of ' + R.board_size + ' protocols shown.';
    renderDetail();
  }

  function renderDetail() {
    var box = $('detail');
    if (!state.slug) { box.hidden = true; return; }
    var r = R.rows.find(function (x) { return x.slug === state.slug; });
    if (!r) { box.hidden = true; return; }
    box.hidden = false;
    $('detail-body').innerHTML =
      '<h2>' + esc(r.name) + '</h2>' +
      '<p class="sub">Rank ' + r.rank + ' · ' + esc(r.category || 'uncategorised') + ' · ' +
      r.chains.map(esc).join(', ') + ' · ' + (r.watchlist ? 'on the watchlist' : 'early find') + '</p>' +
      '<p class="big">' + money(r.implied_value_usd) + '</p>' +
      '<p class="lbl">Implied value</p>' +
      '<dl>' +
      '<dt>TVL</dt><dd>' + money(r.tvl_usd) + '</dd>' +
      '<dt>7d change</dt><dd>' + pct(r.change_7d) + '</dd>' +
      '<dt>Age</dt><dd>' + (r.age_days === null ? 'unknown' : r.age_days + ' days') + '</dd>' +
      '<dt>Category multiple</dt><dd>' + r.multiple.toFixed(3) + ' (' + r.comp_count + ' peers)</dd>' +
      '<dt>Growth ×</dt><dd>' + r.growth_multiplier.toFixed(2) + '</dd>' +
      '<dt>Maturity ×</dt><dd>' + r.maturity_multiplier.toFixed(2) + '</dd>' +
      '<dt>Chain breadth ×</dt><dd>' + r.chain_multiplier.toFixed(2) + '</dd>' +
      '</dl>' +
      '<h3>Farm plan</h3><ol>' +
      r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      '</ol>';
  }

  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    state.slug = tr.getAttribute('data-slug');
    render();
    $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  }
  render();
})();
