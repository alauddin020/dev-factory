/* =============================================================================
 * DevFactory · Version 3 "Paper" — view layer
 * Ledger-style rendering of the same shared store / API flow.
 * ===========================================================================*/
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var store = window.createStore();
  var F = window.Fmt;
  var sugIndex = -1;

  function st(s) { return '<span class="st t-' + F.tone(s) + '">' + F.esc(s) + '</span>'; }
  function meter(p) {
    return '<div class="meter"><div class="t"><i style="width:' + Math.max(0, Math.min(100, p)) + '%"></i></div><span>' + p + '%</span></div>';
  }
  function busyBtn(btn, busy, idle, busyLabel) {
    var sp = btn.querySelector('.spin'), lb = btn.querySelector('.lbl');
    if (sp) sp.hidden = !busy;
    if (lb) lb.textContent = busy ? busyLabel : idle;
    btn.disabled = !!busy;
  }

  /* ================================================================ render */
  function render(s) {
    $('mockPill').hidden = !window.Api.isMock;
    $('srcLabel').textContent = window.Api.isMock ? 'mock backend (shared/mock-data.js)' : window.APP_CONFIG.apiBaseUrl;
    $('userChip').hidden = !s.user;
    $('logoutBtn').hidden = !s.user;
    if (s.user) {
      $('userName').textContent = s.user.name;
      $('userRole').textContent = s.user.role + ' · ' + s.user.email;
    }

    var order = ['login', 'factory', 'lookup', 'results'], cur = order.indexOf(s.step);
    [].forEach.call($('steps').children, function (li, i) {
      li.classList.toggle('on', i === cur);
      li.classList.toggle('done', i < cur);
    });

    var al = $('alert');
    al.hidden = !(s.error && s.step === 'factory');
    if (!al.hidden) al.textContent = s.error.message;

    $('view-login').hidden = s.step !== 'login';
    $('view-factory').hidden = s.step !== 'factory';
    $('view-lookup').hidden = s.step !== 'lookup';
    $('view-results').hidden = s.step !== 'results';

    if (s.step === 'login') renderLogin(s);
    if (s.step === 'factory') renderFactories(s);
    if (s.step === 'lookup') renderLookup(s);
    if (s.step === 'results') renderResults(s);

    renderToasts(s);
    renderModal(s);
  }

  function renderLogin(s) {
    busyBtn($('loginBtn'), s.busy === 'login', 'Sign in', 'Signing in…');
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
    $('factoryCount').textContent = s.factories.length
      ? 'Ledger of ' + s.factories.length + ' factories' + (s.factoryQuery ? ' · ' + list.length + ' matching “' + s.factoryQuery + '”' : '')
      : 'Loading ledger…';
    $('factoryEmpty').hidden = list.length > 0;

    $('factoryGrid').innerHTML = list.map(function (f, i) {
      return '<tr class="pick" data-factory="' + F.esc(f.id) + '">' +
        '<td class="mono dim">' + String(i + 1).padStart(2, '0') + '</td>' +
        '<td><span class="fac-cell"><b>' + F.esc(f.name) + '</b><small>' + F.esc(f.id) + ' · ' + F.esc(f.contact) + '</small></span></td>' +
        '<td>' + F.esc(f.city) + ', ' + F.esc(f.country) + '</td>' +
        '<td class="ta-r mono">' + f.units + '</td>' +
        '<td class="ta-r mono">' + F.num(f.capacity) + '</td>' +
        '<td><span class="tagbox' + (f.status !== 'Active' ? ' watch' : '') + '">' + F.esc(f.status) + '</span></td>' +
        '<td class="ta-r"><button class="pick-btn" type="button" tabindex="-1">Select</button></td>' +
      '</tr>';
    }).join('');

    var inp = $('factorySearch');
    if (document.activeElement !== inp && inp.value !== s.factoryQuery) inp.value = s.factoryQuery;
  }

  function renderLookup(s) {
    var f = s.selectedFactory;
    $('selectedFactory').innerHTML = f
      ? '<span class="ic">' + F.esc(F.initials(f.name)) + '</span>' +
        '<span><b>' + F.esc(f.name) + '</b><small>' + F.esc(f.city) + ' · ' + f.units + ' units · ' + F.compact(f.capacity) + ' pcs/day</small></span>' +
        '<span class="tagbox id">' + F.esc(f.id) + '</span>'
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

    busyBtn($('lookupBtn'), s.busy === 'lookup', 'Fetch records', 'Resolving…');
    var pe = s.error && (s.error.field === 'po' || !s.error.field);
    $('poError').hidden = !pe;
    if (pe) $('poError').textContent = s.error.message;
    inp.classList.toggle('bad', !!pe);
  }

  function renderResults(s) {
    var f = s.selectedFactory, r = s.resolved, po = r && r.po;

    $('crumbs').textContent = [s.user ? s.user.name : '', f ? f.name : '', r ? r.factory_id : ''].join('  /  ');
    $('recordsTitle').textContent = r ? r.factory_id : '—';

    $('poHero').innerHTML = po ? (
      '<div class="d-left">' +
        '<div class="eyebrow">Purchase order resolved</div>' +
        '<h2>' + F.esc(po.po) + '</h2>' +
        '<div class="sub">' + F.esc(po.item) + '</div>' +
        (s.mismatch
          ? '<div class="mismatch" style="margin-top:14px">This PO belongs to <b>' + F.esc(r.factory_id) + '</b>, not your selected factory <b>' +
            F.esc(f ? f.id : '') + '</b>.<button type="button" id="switchFactory">Switch to ' + F.esc(r.factory_id) + '</button></div>'
          : '') +
      '</div>' +
      '<div>' +
        '<dl>' +
          '<dt>factory_id</dt><dd><span class="tagbox">' + F.esc(r.factory_id) + '</span></dd>' +
          '<dt>Buyer</dt><dd>' + F.esc(po.buyer) + '</dd>' +
          '<dt>Style</dt><dd class="mono">' + F.esc(po.style) + '</dd>' +
          '<dt>Quantity</dt><dd>' + F.num(po.qty) + ' ' + F.esc(po.unit) + '</dd>' +
          '<dt>Order date</dt><dd>' + F.date(po.orderDate) + '</dd>' +
          '<dt>Ship date</dt><dd>' + F.date(po.shipDate) + '</dd>' +
          '<dt>Status</dt><dd>' + st(po.status) + '</dd>' +
          '<dt>Progress</dt><dd>' + meter(po.progress) + '</dd>' +
        '</dl>' +
      '</div>'
    ) : '';

    var sw = $('switchFactory');
    if (sw) sw.addEventListener('click', function () { store.switchToPoFactory(); });

    var rows = store.visibleRecords(), k = store.kpis(rows);
    $('kpis').innerHTML = [
      ['Records', k.count, false],
      ['Quantity (pcs)', F.num(k.qty), false],
      ['Value (USD)', F.money(k.value), false],
      ['Avg. progress', k.avgProgress + '%', false],
      ['Delayed POs', k.delayed, k.delayed > 0]
    ].map(function (x) {
      return '<div class="cell' + (x[2] ? ' alert' : '') + '"><div class="k">' + x[0] + '</div><div class="v">' + x[1] + '</div></div>';
    }).join('');

    var q = s.listQuery.trim().toLowerCase();
    var inSearch = s.records.filter(function (r2) {
      return !q || [r2.po, r2.buyer, r2.style, r2.item, r2.factoryId].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    var chips = [{ v: 'ALL', label: 'All', n: inSearch.length }].concat(
      F.STATUSES.map(function (status) {
        return { v: status, label: status, n: inSearch.filter(function (r2) { return r2.status === status; }).length };
      }).filter(function (c) { return c.n; })
    );
    $('statusChips').innerHTML = chips.map(function (c) {
      return '<button class="tab' + (s.statusFilter === c.v ? ' on' : '') + '" type="button" data-status="' + F.esc(c.v) + '">' +
        F.esc(c.label) + '<span class="n">' + c.n + '</span></button>';
    }).join('');

    $('recordsMeta').textContent = 'Showing ' + rows.length + ' of ' + s.records.length + ' records · click a row for the full sheet';
    $('recordsBody').innerHTML = rows.map(function (r2) {
      return '<tr class="pick' + (r2.po === s.highlightPo ? ' hit' : '') + '" data-po="' + F.esc(r2.po) + '">' +
        '<td class="mono"><b>' + F.esc(r2.po) + '</b></td>' +
        '<td>' + F.esc(r2.buyer) + '</td>' +
        '<td class="mono dim">' + F.esc(r2.style) + '</td>' +
        '<td><span class="ell" title="' + F.esc(r2.item) + '">' + F.esc(r2.item) + '</span></td>' +
        '<td class="ta-r mono">' + F.num(r2.qty) + ' <span class="dim">' + F.esc(r2.unit) + '</span></td>' +
        '<td>' + st(r2.status) + '</td>' +
        '<td>' + meter(r2.progress) + '</td>' +
        '<td class="dim">' + F.shortDate(r2.shipDate) + '</td>' +
        '<td class="ta-r mono">' + F.money(r2.value || r2.qty * r2.unitPrice) + '</td>' +
      '</tr>';
    }).join('');
    $('recordsEmpty').hidden = rows.length > 0;

    var ls = $('listSearch');
    if (document.activeElement !== ls && ls.value !== s.listQuery) ls.value = s.listQuery;
  }

  function renderToasts(s) {
    $('toasts').innerHTML = s.toast ? '<div class="toast ' + (s.toast.type || '') + '">' + F.esc(s.toast.message) + '</div>' : '';
  }

  function renderModal(s) {
    var d = s.detail;
    $('modal').hidden = !d;
    if (!d) return;
    $('modalTitle').textContent = d.po;
    $('modalBody').innerHTML =
      '<dl class="dl">' +
        '<dt>factory_id</dt><dd><span class="tagbox">' + F.esc(d.factoryId) + '</span></dd>' +
        '<dt>Buyer</dt><dd>' + F.esc(d.buyer) + '</dd>' +
        '<dt>Style</dt><dd class="mono">' + F.esc(d.style) + '</dd>' +
        '<dt>Item</dt><dd>' + F.esc(d.item) + '</dd>' +
        '<dt>Quantity</dt><dd>' + F.num(d.qty) + ' ' + F.esc(d.unit) + '</dd>' +
        '<dt>Status</dt><dd>' + st(d.status) + '</dd>' +
        '<dt>Progress</dt><dd>' + meter(d.progress) + '</dd>' +
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
  $('reloadFactories').addEventListener('click', function () { store.loadFactories(); });

  $('factorySearch').addEventListener('input', function (e) { store.setFactoryQuery(e.target.value); });
  $('factoryGrid').addEventListener('click', function (e) {
    var tr = e.target.closest('[data-factory]');
    if (!tr) return;
    var f = store.state.factories.filter(function (x) { return x.id === tr.dataset.factory; })[0];
    if (f) store.selectFactory(f);
  });

  $('backToFactories').addEventListener('click', function () { store.backToFactories(); });
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
  document.addEventListener('click', function (e) { if (!e.target.closest('.row-po')) store.hideSuggestions(); });
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
