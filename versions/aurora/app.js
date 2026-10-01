/* =============================================================================
 * DevFactory · Version 1 "Aurora" — view layer
 * Reads store.state and paints the DOM. All flow logic lives in shared/store.js
 * ===========================================================================*/
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var store = window.createStore();
  var F = window.Fmt;
  var sugIndex = -1;

  /* ============================================================ small helpers */
  function statusPill(s) { return '<span class="status tone-' + F.tone(s) + '">' + F.esc(s) + '</span>'; }
  function progressBar(p) {
    return '<div class="bar"><div class="bar-track"><i style="width:' + Math.max(0, Math.min(100, p)) + '%"></i></div><span>' + p + '%</span></div>';
  }
  function btnBusy(btn, busy, label) {
    var sp = btn.querySelector('.spinner');
    var lb = btn.querySelector('.btn-label');
    if (sp) sp.hidden = !busy;
    if (lb && label) lb.textContent = busy ? label.busy : label.idle;
    btn.disabled = !!busy;
  }

  /* ================================================================== render */
  function render(s) {
    /* ---------- chrome ---------- */
    $('mockPill').hidden = !window.Api.isMock;
    $('userChip').hidden = !s.user;
    if (s.user) {
      $('userAvatar').textContent = F.initials(s.user.name);
      $('userName').textContent = s.user.name;
      $('userRole').textContent = s.user.role + ' · ' + s.user.email;
    }

    /* ---------- stepper ---------- */
    var order = ['login', 'factory', 'lookup', 'results'];
    var current = order.indexOf(s.step);
    [].forEach.call($('steps').children, function (li, i) {
      li.classList.toggle('is-active', i === current);
      li.classList.toggle('is-done', i < current);
    });

    /* ---------- alert ---------- */
    var alert = $('alert');
    if (s.error && s.step !== 'login' && s.step !== 'lookup') {
      alert.hidden = false; alert.textContent = s.error.message;
    } else { alert.hidden = true; }

    /* ---------- view visibility ---------- */
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

  /* ---------------------------------------------------------------- 1 · login */
  function renderLogin(s) {
    btnBusy($('loginBtn'), s.busy === 'login', { busy: 'Signing in…', idle: 'Sign in' });
    var err = $('loginError');
    var isFieldError = s.error && (s.error.field === 'email' || s.error.field === 'password' || !s.error.field);
    err.hidden = !isFieldError;
    if (isFieldError) err.textContent = s.error.message;
    $('email').classList.toggle('is-bad', !!(s.error && s.error.field === 'email'));
    $('password').classList.toggle('is-bad', !!(s.error && s.error.field === 'password'));
  }

  /* -------------------------------------------------------------- 2 · factory */
  function renderFactories(s) {
    var q = s.factoryQuery.toLowerCase();
    var list = s.factories.filter(function (f) {
      if (!q) return true;
      return [f.id, f.name, f.city, f.country].join(' ').toLowerCase().indexOf(q) !== -1;
    });

    $('factoryCount').textContent = s.factories.length
      ? s.factories.length + ' factories available to your account' + (s.factoryQuery ? ' · ' + list.length + ' shown' : '')
      : 'Loading…';
    $('factoryEmpty').hidden = list.length > 0;

    $('factoryGrid').innerHTML = list.map(function (f) {
      return '<button class="factory" type="button" data-factory="' + F.esc(f.id) + '">' +
        '<div class="factory-top">' +
          '<span class="factory-badge">' + F.esc(F.initials(f.name)) + '</span>' +
          '<span><div class="factory-name">' + F.esc(f.name) + '</div>' +
          '<div class="factory-loc">' + F.esc(f.city) + ', ' + F.esc(f.country) + '</div></span>' +
        '</div>' +
        '<div class="factory-meta">' +
          '<span class="tag id">' + F.esc(f.id) + '</span>' +
          '<span class="tag">' + f.units + ' units</span>' +
          '<span class="tag">' + F.compact(f.capacity) + '/day</span>' +
          (f.status !== 'Active' ? '<span class="tag watch">' + F.esc(f.status) + '</span>' : '') +
        '</div>' +
      '</button>';
    }).join('');

    if (document.activeElement !== $('factorySearch') && $('factorySearch').value !== s.factoryQuery) {
      $('factorySearch').value = s.factoryQuery;
    }
  }

  /* --------------------------------------------------------------- 3 · lookup */
  function renderLookup(s) {
    var f = s.selectedFactory;
    $('selectedFactory').innerHTML = f
      ? '<span class="badge">' + F.esc(F.initials(f.name)) + '</span>' +
        '<span class="who"><strong>' + F.esc(f.name) + '</strong><small>' + F.esc(f.city) + ' · ' + f.units + ' units</small></span>' +
        '<span class="tag id">' + F.esc(f.id) + '</span>'
      : '';

    var input = $('poInput');
    if (document.activeElement !== input && input.value !== s.poInput) input.value = s.poInput;

    var box = $('suggestions');
    box.hidden = !(s.showSuggestions && s.suggestions.length);
    input.setAttribute('aria-expanded', String(!box.hidden));
    box.innerHTML = s.suggestions.map(function (x, i) {
      return '<li role="option" data-i="' + i + '" class="' + (i === sugIndex ? 'is-active' : '') + '">' +
        '<span><div class="s-po">' + F.esc(x.po) + '</div><div class="s-sub">' + F.esc(x.buyer) + ' · ' + F.esc(x.style) + '</div></span>' +
        '<span class="s-fac">' + F.esc(x.factoryId) + '</span></li>';
    }).join('');

    btnBusy($('lookupBtn'), s.busy === 'lookup', { busy: 'Resolving factory_id…', idle: 'Fetch factory & records' });
    var isPoError = s.error && (s.error.field === 'po' || !s.error.field);
    $('poError').hidden = !isPoError;
    if (isPoError) $('poError').textContent = s.error.message;
    input.classList.toggle('is-bad', !!isPoError);
  }

  /* -------------------------------------------------------------- 6 · results */
  function renderResults(s) {
    var f = s.selectedFactory, r = s.resolved, po = r && r.po;

    $('crumbs').innerHTML =
      '<b>' + F.esc(s.user ? s.user.name : '') + '</b> › ' +
      '<b>' + F.esc(f ? f.name : '') + '</b> › <span class="tag id">' + F.esc(r ? r.factory_id : '') + '</span>';

    /* hero ------------------------------------------------------------- */
    $('poHero').innerHTML = po ? (
      '<div>' +
        '<div class="eyebrow">Purchase order ' + F.esc(po.po) + '</div>' +
        '<h2>' + F.esc(po.po) + '</h2>' +
        '<div class="sub">' + F.esc(po.item) + '</div>' +
      '</div>' +
      '<div class="hero-facts">' +
        '<span class="f"><span class="k">Factory ID</span><span class="v mono">' + F.esc(r.factory_id) + '</span></span>' +
        '<span class="f"><span class="k">Buyer</span><span class="v">' + F.esc(po.buyer) + '</span></span>' +
        '<span class="f"><span class="k">Style</span><span class="v mono">' + F.esc(po.style) + '</span></span>' +
        '<span class="f"><span class="k">Quantity</span><span class="v">' + F.num(po.qty) + ' ' + F.esc(po.unit) + '</span></span>' +
        '<span class="f"><span class="k">Order date</span><span class="v">' + F.date(po.orderDate) + '</span></span>' +
        '<span class="f"><span class="k">Ship date</span><span class="v">' + F.date(po.shipDate) + '</span></span>' +
      '</div>' +
      '<div class="progress">' +
        '<div class="progress-track"><i style="width:' + po.progress + '%"></i></div>' +
        '<div class="progress-meta"><span>' + statusPill(po.status) + '</span><span>' + po.progress + '% complete</span></div>' +
      '</div>' +
      (s.mismatch
        ? '<div class="match-note">⚠ This PO belongs to <b>' + F.esc(r.factory_id) + '</b>, ' +
          'not the factory you selected (' + F.esc(f ? f.id : '') + '). Showing records for ' + F.esc(r.factory_id) + '.' +
          '<button type="button" id="switchFactory">Switch to ' + F.esc(r.factory_id) + '</button></div>'
        : '')
    ) : '';

    var sw = $('switchFactory');
    if (sw) sw.addEventListener('click', function () { store.switchToPoFactory(); });

    /* KPIs -------------------------------------------------------------- */
    var rows = store.visibleRecords();
    var k = store.kpis(rows);
    $('kpis').innerHTML = [
      ['Records', k.count, 'after filters'],
      ['Total quantity', F.num(k.qty), 'pcs across rows'],
      ['Order value', F.money(k.value), 'at unit price'],
      ['Avg. progress', k.avgProgress + '%', k.delayed + ' delayed']
    ].map(function (x, i) {
      return '<div class="kpi' + (i === 3 && k.delayed ? ' warn' : '') + '"><div class="k">' + x[0] + '</div><div class="v">' + x[1] + '</div><div class="d">' + x[2] + '</div></div>';
    }).join('');

    /* status chips ------------------------------------------------------ */
    var inSearch = s.records.filter(function (r2) {
      var q = s.listQuery.trim().toLowerCase();
      return !q || [r2.po, r2.buyer, r2.style, r2.item, r2.factoryId].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    var chips = [{ v: 'ALL', label: 'All', n: inSearch.length }].concat(
      F.STATUSES.map(function (st) {
        return { v: st, label: st, n: inSearch.filter(function (r2) { return r2.status === st; }).length };
      }).filter(function (c) { return c.n > 0; })
    );
    $('statusChips').innerHTML = chips.map(function (c) {
      return '<button class="chip' + (s.statusFilter === c.v ? ' is-on' : '') + '" type="button" data-status="' + F.esc(c.v) + '">' +
        F.esc(c.label) + '<span class="n">' + c.n + '</span></button>';
    }).join('');

    /* table ------------------------------------------------------------- */
    $('recordsMeta').textContent = 'Showing ' + rows.length + ' of ' + s.records.length +
      ' records for ' + F.esc(r ? r.factory_id : '') + (f ? ' — ' + f.name : '');

    $('recordsBody').innerHTML = rows.map(function (r2) {
      return '<tr data-po="' + F.esc(r2.po) + '" class="' + (r2.po === s.highlightPo ? 'is-hit' : '') + '">' +
        '<td class="mono">' + F.esc(r2.po) + '</td>' +
        '<td>' + F.esc(r2.buyer) + '</td>' +
        '<td class="mono muted">' + F.esc(r2.style) + '</td>' +
        '<td class="clamp" title="' + F.esc(r2.item) + '">' + F.esc(r2.item) + '</td>' +
        '<td class="ta-r">' + F.num(r2.qty) + ' <span class="muted">' + F.esc(r2.unit) + '</span></td>' +
        '<td>' + statusPill(r2.status) + '</td>' +
        '<td>' + progressBar(r2.progress) + '</td>' +
        '<td class="muted">' + F.date(r2.shipDate) + '</td>' +
        '<td class="ta-r">' + F.money(r2.value || r2.qty * r2.unitPrice) + '</td>' +
      '</tr>';
    }).join('');
    $('recordsEmpty').hidden = rows.length > 0;

    if (document.activeElement !== $('listSearch') && $('listSearch').value !== s.listQuery) {
      $('listSearch').value = s.listQuery;
    }
  }

  /* ------------------------------------------------------------------ toasts */
  function renderToasts(s) {
    var box = $('toasts');
    if (!s.toast) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="toast ' + (s.toast.type || '') + '">' + F.esc(s.toast.message) + '</div>';
  }

  /* ------------------------------------------------------------------- modal */
  function renderModal(s) {
    var m = $('modal'), r = s.detail;
    m.hidden = !r;
    if (!r) return;
    $('modalTitle').textContent = r.po;
    $('modalBody').innerHTML =
      '<dl class="dl">' +
        '<dt>Factory ID</dt><dd><span class="tag id">' + F.esc(r.factoryId) + '</span></dd>' +
        '<dt>Buyer</dt><dd>' + F.esc(r.buyer) + '</dd>' +
        '<dt>Style</dt><dd><code>' + F.esc(r.style) + '</code></dd>' +
        '<dt>Item</dt><dd>' + F.esc(r.item) + '</dd>' +
        '<dt>Quantity</dt><dd>' + F.num(r.qty) + ' ' + F.esc(r.unit) + '</dd>' +
        '<dt>Status</dt><dd>' + statusPill(r.status) + '</dd>' +
        '<dt>Progress</dt><dd>' + progressBar(r.progress) + '</dd>' +
        '<dt>Order date</dt><dd>' + F.date(r.orderDate) + '</dd>' +
        '<dt>Ship date</dt><dd>' + F.date(r.shipDate) + '</dd>' +
        '<dt>Unit price</dt><dd>$' + Number(r.unitPrice).toFixed(2) + '</dd>' +
        '<dt>Order value</dt><dd><b>' + F.money(r.value || r.qty * r.unitPrice) + '</b></dd>' +
      '</dl>';
  }

  /* ================================================================== events */
  /* login */
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    store.login($('email').value.trim(), $('password').value);
  });

  /* factory */
  $('factorySearch').addEventListener('input', function (e) { store.setFactoryQuery(e.target.value); });
  $('reloadFactories').addEventListener('click', function () { store.loadFactories(); });
  $('factoryGrid').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-factory]');
    if (!btn) return;
    var f = store.state.factories.filter(function (x) { return x.id === btn.dataset.factory; })[0];
    if (f) store.selectFactory(f);
  });

  /* lookup */
  $('backToFactories').addEventListener('click', function () { store.backToFactories(); });
  $('poForm').addEventListener('submit', function (e) { e.preventDefault(); store.lookupPo(); });
  $('poInput').addEventListener('input', function (e) { sugIndex = -1; store.setPoInput(e.target.value); });
  $('poInput').addEventListener('focus', function () {
    if (store.state.suggestions.length) store.set({ showSuggestions: true });
  });
  $('poInput').addEventListener('keydown', function (e) {
    var s = store.state;
    if (e.key === 'ArrowDown' && s.suggestions.length) {
      e.preventDefault(); sugIndex = (sugIndex + 1) % s.suggestions.length; store.set({ showSuggestions: true });
    } else if (e.key === 'ArrowUp' && s.suggestions.length) {
      e.preventDefault(); sugIndex = (sugIndex - 1 + s.suggestions.length) % s.suggestions.length; store.set({});
    } else if (e.key === 'Enter' && sugIndex > -1 && s.suggestions[sugIndex]) {
      e.preventDefault(); store.pickSuggestion(s.suggestions[sugIndex]); sugIndex = -1;
    } else if (e.key === 'Escape') {
      store.hideSuggestions();
    }
  });
  $('suggestions').addEventListener('mousedown', function (e) {
    var li = e.target.closest('[data-i]');
    if (!li) return;
    e.preventDefault();
    store.pickSuggestion(store.state.suggestions[Number(li.dataset.i)]);
    sugIndex = -1;
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.po-wrap')) store.hideSuggestions();
  });
  [].forEach.call(document.querySelectorAll('[data-demo-po]'), function (b) {
    b.addEventListener('click', function () { store.lookupPo(b.dataset.demoPo); });
  });

  /* results */
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

  /* modal + logout */
  $('modal').addEventListener('click', function (e) { if (e.target.closest('[data-close]')) store.closeDetail(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') store.closeDetail(); });
  $('logoutBtn').addEventListener('click', function () { store.logout(); });

  /* =================================================================== boot */
  store.subscribe(render);
  store.bootstrap();
})();
