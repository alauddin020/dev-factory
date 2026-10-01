/* =============================================================================
 * DevFactory · Version 2 "Graphite" — view layer
 * Dark console rendering of the same shared store/API flow.
 * ===========================================================================*/
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var store = window.createStore();
  var F = window.Fmt;
  var sugIndex = -1;

  var PAGE = {
    factory: ['Select a factory', 'Pick the production unit you want to work with.'],
    lookup:  ['Find a purchase order', 'Enter a PO number — the API returns the factory_id it belongs to, then we list its records.'],
    results: ['Factory records', 'Purchase orders returned for the resolved factory_id.']
  };

  /* ----------------------------------------------------------- fragments */
  function st(s) { return '<span class="st t-' + F.tone(s) + '">' + F.esc(s) + '</span>'; }
  function bar(p) {
    return '<div class="bar"><div class="tr"><i style="width:' + Math.max(0, Math.min(100, p)) + '%"></i></div><span>' + p + '%</span></div>';
  }
  function busyBtn(btn, busy, idle, busyLabel) {
    var sp = btn.querySelector('.spin'), lb = btn.querySelector('.lbl');
    if (sp) sp.hidden = !busy;
    if (lb) lb.textContent = busy ? busyLabel : idle;
    btn.disabled = !!busy;
  }

  /* ================================================================ render */
  function render(s) {
    var loggedIn = !!s.token;
    $('screen-login').hidden = loggedIn;
    $('screen-app').hidden = !loggedIn;
    $('mockPill').hidden = !window.Api.isMock;

    if (!loggedIn) { renderLogin(s); return; }

    /* sidebar + header ------------------------------------------------- */
    var step = s.step === 'login' ? 'factory' : s.step;
    [].forEach.call($('sideNav').children, function (b) {
      var d = b.dataset.step;
      b.classList.toggle('active', d === step);
      b.classList.toggle('done', ['factory', 'lookup', 'results'].indexOf(d) < ['factory', 'lookup', 'results'].indexOf(step));
      b.disabled = (d === 'lookup' || d === 'results') && !s.selectedFactory;
      if (d === 'results' && !s.records.length) b.disabled = true;
    });
    $('pageTitle').textContent = PAGE[step][0];
    $('pageSub').textContent = PAGE[step][1];
    $('userAvatar').textContent = F.initials(s.user.name);
    $('userName').textContent = s.user.name;
    $('userRole').textContent = s.user.role;
    $('reloadBtn').hidden = step !== 'factory';

    /* alert ------------------------------------------------------------ */
    var al = $('alert');
    al.hidden = !(s.error && s.step === 'factory');
    if (!al.hidden) al.textContent = s.error.message;

    /* views ------------------------------------------------------------ */
    $('view-factory').hidden = s.step !== 'factory';
    $('view-lookup').hidden = s.step !== 'lookup';
    $('view-results').hidden = s.step !== 'results';

    if (s.step === 'factory') renderFactories(s);
    if (s.step === 'lookup') renderLookup(s);
    if (s.step === 'results') renderResults(s);

    renderToasts(s);
    renderDrawer(s);
  }

  function renderLogin(s) {
    busyBtn($('loginBtn'), s.busy === 'login', 'Sign in', 'Authenticating…');
    var fe = s.error && (s.error.field === 'email' || s.error.field === 'password' || !s.error.field);
    $('loginError').hidden = !fe;
    if (fe) $('loginError').textContent = s.error.message;
    $('email').classList.toggle('bad', !!(s.error && s.error.field === 'email'));
    $('password').classList.toggle('bad', !!(s.error && s.error.field === 'password'));
  }

  function renderFactories(s) {
    var q = s.factoryQuery.toLowerCase();
    var list = s.factories.filter(function (f) {
      return !q || [f.id, f.name, f.city, f.country].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    $('factoryCount').textContent = list.length + ' / ' + s.factories.length + ' factories';
    $('factoryEmpty').hidden = list.length > 0;

    $('factoryGrid').innerHTML = list.map(function (f) {
      return '<button class="fac" type="button" data-factory="' + F.esc(f.id) + '">' +
        '<span class="fac-ic">' + F.esc(F.initials(f.name)) + '</span>' +
        '<span class="fac-body">' +
          '<span class="fac-name">' + F.esc(f.name) + '</span>' +
          '<span class="fac-sub"><span>' + F.esc(f.city) + ', ' + F.esc(f.country) + '</span>' +
          '<span>· ' + f.units + ' units</span><span>· ' + F.compact(f.capacity) + '/day</span></span>' +
        '</span>' +
        '<span class="fac-id' + (f.status !== 'Active' ? ' watch' : '') + '">' + F.esc(f.status !== 'Active' ? f.status : f.id) + '</span>' +
        '<span class="arrow">→</span>' +
      '</button>';
    }).join('');

    var inp = $('factorySearch');
    if (document.activeElement !== inp && inp.value !== s.factoryQuery) inp.value = s.factoryQuery;
  }

  function renderLookup(s) {
    var f = s.selectedFactory;
    $('selectedFactory').innerHTML = f
      ? '<span class="ic">' + F.esc(F.initials(f.name)) + '</span>' +
        '<span class="who"><strong>' + F.esc(f.name) + '</strong><small>' + F.esc(f.city) + ' · ' + f.units + ' units · ' + F.esc(f.contact) + '</small></span>' +
        '<span class="fac-id" style="margin-left:auto">' + F.esc(f.id) + '</span>'
      : '';

    var inp = $('poInput');
    if (document.activeElement !== inp && inp.value !== s.poInput) inp.value = s.poInput;

    var box = $('suggestions');
    box.hidden = !(s.showSuggestions && s.suggestions.length);
    box.innerHTML = s.suggestions.map(function (x, i) {
      return '<li data-i="' + i + '" class="' + (i === sugIndex ? 'on' : '') + '">' +
        '<span><div class="p">' + F.esc(x.po) + '</div><div class="s">' + F.esc(x.buyer) + ' · ' + F.esc(x.style) + '</div></span>' +
        '<span class="f">' + F.esc(x.factoryId) + '</span></li>';
    }).join('');

    busyBtn($('lookupBtn'), s.busy === 'lookup', 'Resolve', 'Resolving…');
    var pe = s.error && (s.error.field === 'po' || !s.error.field);
    $('poError').hidden = !pe;
    if (pe) $('poError').textContent = s.error.message;
    inp.classList.toggle('bad', !!pe);
  }

  function renderResults(s) {
    var f = s.selectedFactory, r = s.resolved, po = r && r.po;

    $('crumbs').textContent = (s.user ? s.user.name : '') + '  ›  ' + (f ? f.name : '') + '  ›  ' + (r ? r.factory_id : '');

    $('poHero').innerHTML = po ? (
      '<div>' +
        '<div class="eyebrow">resolved po</div>' +
        '<h2>' + F.esc(po.po) + '</h2>' +
        '<div class="sub">' + F.esc(po.item) + '</div>' +
      '</div>' +
      '<div class="facts">' +
        '<div><div class="k">factory_id</div><div class="v mono">' + F.esc(r.factory_id) + '</div></div>' +
        '<div><div class="k">Buyer</div><div class="v">' + F.esc(po.buyer) + '</div></div>' +
        '<div><div class="k">Style</div><div class="v mono">' + F.esc(po.style) + '</div></div>' +
        '<div><div class="k">Quantity</div><div class="v">' + F.num(po.qty) + ' ' + F.esc(po.unit) + '</div></div>' +
        '<div><div class="k">Order date</div><div class="v">' + F.date(po.orderDate) + '</div></div>' +
        '<div><div class="k">Ship date</div><div class="v">' + F.date(po.shipDate) + '</div></div>' +
      '</div>' +
      '<div class="prog">' +
        '<div class="track"><i style="width:' + po.progress + '%"></i></div>' +
        '<div class="prog-meta"><span>' + st(po.status) + '</span><span>' + po.progress + '% complete</span></div>' +
      '</div>' +
      (s.mismatch
        ? '<div class="mismatch">⚠ factory_id mismatch — this PO belongs to <b>' + F.esc(r.factory_id) + '</b> but you selected <b>' +
          F.esc(f ? f.id : '') + '</b>. Records below are for <b>' + F.esc(r.factory_id) + '</b>.' +
          '<button type="button" id="switchFactory">Switch factory</button></div>'
        : '')
    ) : '';

    var sw = $('switchFactory');
    if (sw) sw.addEventListener('click', function () { store.switchToPoFactory(); });

    var rows = store.visibleRecords(), k = store.kpis(rows);
    $('kpis').innerHTML = [
      ['records', k.count, 'rows after filters', false],
      ['quantity', F.num(k.qty), 'pcs total', false],
      ['order value', '$' + F.compact(k.value), 'at unit price', false],
      ['avg progress', k.avgProgress + '%', k.delayed + ' delayed PO(s)', k.delayed > 0]
    ].map(function (x) {
      return '<div class="kpi' + (x[3] ? ' warn' : '') + '"><div class="k">' + x[0] + '</div><div class="v">' + x[1] + '</div><div class="k" style="margin-top:6px">' + x[2] + '</div></div>';
    }).join('');

    var q = s.listQuery.trim().toLowerCase();
    var inSearch = s.records.filter(function (r2) {
      return !q || [r2.po, r2.buyer, r2.style, r2.item, r2.factoryId].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    var chips = [{ v: 'ALL', label: 'all', n: inSearch.length }].concat(
      F.STATUSES.map(function (status) {
        return { v: status, label: status.toLowerCase(), n: inSearch.filter(function (r2) { return r2.status === status; }).length };
      }).filter(function (c) { return c.n; })
    );
    $('statusChips').innerHTML = chips.map(function (c) {
      return '<button class="chip' + (s.statusFilter === c.v ? ' on' : '') + '" type="button" data-status="' + F.esc(c.v) + '">' +
        F.esc(c.label) + '<span class="n">' + c.n + '</span></button>';
    }).join('');

    $('recordsTitle').textContent = 'records · ' + (r ? r.factory_id : '');
    $('recordsMeta').textContent = rows.length + ' of ' + s.records.length + ' shown';
    $('recordsBody').innerHTML = rows.map(function (r2) {
      return '<tr data-po="' + F.esc(r2.po) + '" class="' + (r2.po === s.highlightPo ? 'hit' : '') + '">' +
        '<td class="mono">' + F.esc(r2.po) + '</td>' +
        '<td>' + F.esc(r2.buyer) + '</td>' +
        '<td class="mono dim">' + F.esc(r2.style) + '</td>' +
        '<td class="wide"><span class="ell" title="' + F.esc(r2.item) + '">' + F.esc(r2.item) + '</span></td>' +
        '<td class="ta-r">' + F.num(r2.qty) + ' <span class="dim">' + F.esc(r2.unit) + '</span></td>' +
        '<td>' + st(r2.status) + '</td>' +
        '<td>' + bar(r2.progress) + '</td>' +
        '<td class="dim">' + F.shortDate(r2.shipDate) + '</td>' +
        '<td class="ta-r mono">' + F.money(r2.value || r2.qty * r2.unitPrice) + '</td>' +
      '</tr>';
    }).join('');
    $('recordsEmpty').hidden = rows.length > 0;

    var ls = $('listSearch');
    if (document.activeElement !== ls && ls.value !== s.listQuery) ls.value = s.listQuery;
  }

  function renderToasts(s) {
    var box = $('toasts');
    box.innerHTML = s.toast ? '<div class="toast ' + (s.toast.type || '') + '">' + F.esc(s.toast.message) + '</div>' : '';
  }

  function renderDrawer(s) {
    var d = s.detail;
    $('modal').hidden = !d;
    if (!d) return;
    $('modalTitle').textContent = d.po;
    $('modalBody').innerHTML =
      '<dl class="dl">' +
        '<dt>factory_id</dt><dd><span class="fac-id">' + F.esc(d.factoryId) + '</span></dd>' +
        '<dt>Buyer</dt><dd>' + F.esc(d.buyer) + '</dd>' +
        '<dt>Style</dt><dd class="mono">' + F.esc(d.style) + '</dd>' +
        '<dt>Item</dt><dd>' + F.esc(d.item) + '</dd>' +
        '<dt>Quantity</dt><dd>' + F.num(d.qty) + ' ' + F.esc(d.unit) + '</dd>' +
        '<dt>Status</dt><dd>' + st(d.status) + '</dd>' +
        '<dt>Progress</dt><dd>' + bar(d.progress) + '</dd>' +
        '<dt>Order date</dt><dd>' + F.date(d.orderDate) + '</dd>' +
        '<dt>Ship date</dt><dd>' + F.date(d.shipDate) + '</dd>' +
        '<dt>Unit price</dt><dd>$' + Number(d.unitPrice).toFixed(2) + '</dd>' +
        '<dt>Value</dt><dd><b>' + F.money(d.value || d.qty * d.unitPrice) + '</b></dd>' +
      '</dl>';
  }

  /* =============================================================== events */
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    store.login($('email').value.trim(), $('password').value);
  });
  $('logoutBtn').addEventListener('click', function () { store.logout(); });
  $('reloadBtn').addEventListener('click', function () { store.loadFactories(); });

  $('factorySearch').addEventListener('input', function (e) { store.setFactoryQuery(e.target.value); });
  $('factoryGrid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-factory]');
    if (!b) return;
    var f = store.state.factories.filter(function (x) { return x.id === b.dataset.factory; })[0];
    if (f) store.selectFactory(f);
  });

  $('sideNav').addEventListener('click', function (e) {
    var b = e.target.closest('[data-step]');
    if (!b || b.disabled) return;
    if (b.dataset.step === 'factory') store.backToFactories();
    if (b.dataset.step === 'lookup') store.backToLookup();
    if (b.dataset.step === 'results' && store.state.resolved) store.set({ step: 'results' });
  });

  $('poForm').addEventListener('submit', function (e) { e.preventDefault(); store.lookupPo(); });
  $('poInput').addEventListener('input', function (e) { sugIndex = -1; store.setPoInput(e.target.value); });
  $('poInput').addEventListener('focus', function () { if (store.state.suggestions.length) store.set({ showSuggestions: true }); });
  $('poInput').addEventListener('keydown', function (e) {
    var s = store.state;
    if (e.key === 'ArrowDown' && s.suggestions.length) { e.preventDefault(); sugIndex = (sugIndex + 1) % s.suggestions.length; store.set({ showSuggestions: true }); }
    else if (e.key === 'ArrowUp' && s.suggestions.length) { e.preventDefault(); sugIndex = (sugIndex - 1 + s.suggestions.length) % s.suggestions.length; store.set({}); }
    else if (e.key === 'Enter' && sugIndex > -1 && s.suggestions[sugIndex]) { e.preventDefault(); store.pickSuggestion(s.suggestions[sugIndex]); sugIndex = -1; }
    else if (e.key === 'Escape') store.hideSuggestions();
  });
  $('suggestions').addEventListener('mousedown', function (e) {
    var li = e.target.closest('[data-i]');
    if (!li) return;
    e.preventDefault();
    store.pickSuggestion(store.state.suggestions[Number(li.dataset.i)]);
    sugIndex = -1;
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.console-form')) store.hideSuggestions(); });
  [].forEach.call(document.querySelectorAll('[data-demo-po]'), function (b) {
    b.addEventListener('click', function () { store.lookupPo(b.dataset.demoPo); });
  });

  $('backToLookup').addEventListener('click', function () { store.backToLookup(); });
  $('listSearch').addEventListener('input', function (e) { store.setListQuery(e.target.value); });
  $('statusChips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-status]');
    if (b) store.setStatusFilter(b.dataset.status);
  });
  $('recordsBody').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-po]');
    if (!tr) return;
    var rec = store.state.records.filter(function (r) { return r.po === tr.dataset.po; })[0];
    if (rec) store.openDetail(rec);
  });

  $('modal').addEventListener('click', function (e) { if (e.target.closest('[data-close]')) store.closeDetail(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') store.closeDetail(); });

  /* ================================================================= boot */
  store.subscribe(render);
  store.bootstrap();
})();
