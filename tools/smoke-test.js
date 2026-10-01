/* End-to-end smoke test for all three DevFactory versions using jsdom.
 * Drives the real page scripts: login -> select factory -> PO lookup -> results.
 * Run: node /home/user/smoke.js
 */
/* Dev-only end-to-end check. Needs jsdom (npm i -D jsdom) and a static server:
 *     python3 -m http.server 5173      # from the repo root
 *     node tools/smoke-test.js         # mock mode (default)
 *     MODE=http node tools/smoke-test.js   # exercises the real HTTP adapter
 * Use tools/run-http-mode.sh to run the HTTP variant against tools/mock-api-server.js.
 */
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path').resolve(__dirname, '..');

const VERSIONS = ['aurora', 'graphite', 'paper'];
const MODE = process.env.MODE === 'http' ? 'http' : 'mock';
let failures = 0;

function check(label, cond, extra) {
  if (cond) { console.log('  ✓ ' + label); }
  else { failures++; console.log('  ✗ ' + label + (extra ? '  → ' + extra : '')); }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const waitFor = async (fn, ms = 4000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await sleep(40); }
  return false;
};

async function boot(version) {
  const url = 'http://localhost:5173/versions/' + version + '/index.html';
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e.message)));
  vc.on('error', (...a) => errors.push(a.join(' ')));

  const dom = await JSDOM.fromURL(url, {
    runScripts: 'dangerously', resources: 'usable',
    pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { if (typeof w.fetch === 'undefined') w.fetch = globalThis.fetch; }
  });
  const { window } = dom;

  // wait for external <script src> files to load
  await waitFor(() => window.APP_CONFIG && window.Api && window.createStore, 5000);
  return { dom, window, doc: window.document, errors };
}

function q(doc, id) { return doc.getElementById(id); }

async function run(version) {
  console.log('\n▶ ' + version.toUpperCase() + '  [' + MODE + ' mode]');
  const { window, doc, errors } = await boot(version);
  const d = doc;

  /* ---------- boot state ---------- */
  const cfg = window.APP_CONFIG || {};
  check('APP_CONFIG loaded (useMock=' + cfg.useMock + ', base=' + cfg.apiBaseUrl + ')',
        MODE === 'http' ? cfg.useMock === false : cfg.useMock === true);
  check('Api adapter present', !!(window.Api && window.Api.login && window.Api.lookupPo));
  check('store booted', !!window.Fmt);

  const $ = id => q(d, id);
  const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const type = (el, v) => { el.value = v; el.dispatchEvent(new window.Event('input', { bubbles: true })); };
  const submit = (el) => el.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

  /* ---------- login ---------- */
  check('login form rendered', await waitFor(() => $('loginForm')));
  type($('password'), 'wrongpass');
  submit($('loginForm'));
  await waitFor(() => $('loginError') && !$('loginError').hidden);
  check('wrong password shows error', $('loginError') && $('loginError').hidden === false,
        $('loginError') ? $('loginError').textContent : 'no element');

  type($('email'), 'planner@demo.com');
  type($('password'), 'demo1234');
  submit($('loginForm'));
  const loggedIn = await waitFor(() => window.localStorage.getItem('devfactory.session') && $('factoryGrid').innerHTML.trim().length > 0);
  check('login succeeds and lands on factory step', loggedIn);
  check('factory rows rendered', d.querySelectorAll('#factoryGrid [data-factory]').length === 6,
        d.querySelectorAll('#factoryGrid [data-factory]').length + ' rows');
  check('session persisted to localStorage', !!window.localStorage.getItem('devfactory.session'));

  /* ---------- select factory ---------- */
  const firstFac = d.querySelector('#factoryGrid [data-factory]');
  click(firstFac);
  await waitFor(() => $('view-lookup') && !$('view-lookup').hidden);
  check('selecting a factory opens the PO lookup step', $('view-lookup').hidden === false);
  check('selected factory context shown', $('selectedFactory').textContent.indexOf('FAC-1001') !== -1,
        $('selectedFactory').textContent.trim().slice(0, 60));

  /* ---------- PO lookup: mismatch case ---------- */
  type($('poInput'), 'PO-2026-0014');
  if (MODE === 'mock') {
    await waitFor(() => $('suggestions') && !$('suggestions').hidden);
    check('autocomplete suggests matching POs', $('suggestions').querySelectorAll('li').length > 0);
  } else {
    check('autocomplete stays off in http mode (no search endpoint)', $('suggestions').hidden === true);
  }
  submit($('poForm'));
  await waitFor(() => $('view-results') && !$('view-results').hidden);
  check('PO lookup navigates to results', $('view-results').hidden === false);
  check('factory_id FAC-1004 resolved from PO', $('poHero').textContent.indexOf('FAC-1004') !== -1,
        $('poHero').textContent.replace(/\s+/g, ' ').trim().slice(0, 80));
  check('mismatch warning shown (selected FAC-1001 vs PO FAC-1004)',
        $('poHero').textContent.indexOf('belongs to') !== -1 || $('poHero').textContent.indexOf('mismatch') !== -1);
  const rows = d.querySelectorAll('#recordsBody tr');
  check('records listed for resolved factory (4 rows)', rows.length === 4, rows.length + ' rows');
  check('resolved PO row highlighted', !!d.querySelector('#recordsBody tr.hit, #recordsBody tr.is-hit'));

  /* ---------- KPIs + filters ---------- */
  const kpiRoot = version === 'paper' ? $('kpis') : $('kpis');
  check('KPI tiles rendered', kpiRoot.children.length >= 4, kpiRoot.children.length + ' tiles');
  const firstChip = d.querySelector('#statusChips [data-status="Confirmed"]');
  check('status chips rendered with counts', !!firstChip);
  if (firstChip) {
    click(firstChip);
    await waitFor(() => d.querySelectorAll('#recordsBody tr').length === 1);
    check('status filter narrows the list', d.querySelectorAll('#recordsBody tr').length === 1,
          d.querySelectorAll('#recordsBody tr').length + ' rows');
    click(d.querySelector('#statusChips [data-status="ALL"]'));
    await waitFor(() => d.querySelectorAll('#recordsBody tr').length === 4);
    check('“All” chip restores the list', d.querySelectorAll('#recordsBody tr').length === 4);
  }
  type($('listSearch'), 'wrangler');
  await waitFor(() => d.querySelectorAll('#recordsBody tr').length === 1);
  check('search box filters records', d.querySelectorAll('#recordsBody tr').length === 1,
        d.querySelectorAll('#recordsBody tr').length + ' rows');
  type($('listSearch'), '');

  /* ---------- record detail ---------- */
  click(d.querySelector('#recordsBody tr'));
  await waitFor(() => $('modal') && !$('modal').hidden);
  check('clicking a row opens the detail panel', $('modal') && $('modal').hidden === false);
  check('detail shows factory_id', $('modalBody').textContent.indexOf('FAC-1004') !== -1);
  click(d.querySelector('#modal [data-close]'));
  await waitFor(() => $('modal').hidden);
  check('detail closes', $('modal').hidden === true);

  /* ---------- switch to the PO's real factory ---------- */
  const sw = $('switchFactory');
  check('switch-factory button present on mismatch', !!sw);
  if (sw) {
    click(sw);                           // let this one complete normally
    await waitFor(() => $('poHero').textContent.indexOf('belongs to') === -1 && $('crumbs').textContent.indexOf('FAC-1004') !== -1, 5000);
    check('“switch factory” moves the context to FAC-1004',
          $('crumbs').textContent.indexOf('FAC-1004') !== -1, $('crumbs').textContent.trim());
    check('mismatch warning cleared after switching', $('poHero').textContent.indexOf('belongs to') === -1);
    const pos = Array.from(d.querySelectorAll('#recordsBody tr')).map(t => t.dataset.po);
    check('records now belong to FAC-1004',
          pos.length === 4 && pos.every(p => ['PO-2026-0014','PO-2026-0015','PO-2026-0016','PO-2026-0017'].includes(p)), pos.join(','));
    click($('backToLookup'));
    await waitFor(() => $('view-lookup').hidden === false);
    check('lookup view now shows the switched factory',
          $('selectedFactory').textContent.indexOf('FAC-1004') !== -1, $('selectedFactory').textContent.trim().slice(0, 60));

    /* ---------- navigation race: leave mid-switch ---------- */
    type($('poInput'), 'PO-2026-0001');   // belongs to FAC-1001 -> fresh mismatch
    submit($('poForm'));
    await waitFor(() => !$('view-results').hidden && !!$('switchFactory'), 5000);
    check('second mismatch detected for PO-2026-0001', !!$('switchFactory'));
    if ($('switchFactory')) {
      click($('switchFactory'));
      click($('backToLookup'));          // navigate away while the switch is still in flight
      await sleep(1500);                 // let the in-flight request finish
      check('in-flight switch does not yank the user back to results',
            $('view-lookup').hidden === false,
            'lookupHidden=' + $('view-lookup').hidden + ' resultsHidden=' + $('view-results').hidden);
    }
  }

  /* ---------- back + not-found case ---------- */
  click($('backToLookup'));
  await waitFor(() => $('view-lookup').hidden === false);
  check('back to lookup works', $('view-lookup').hidden === false);

  const po = $('poInput');
  po.value = 'PO-2026-9999';
  po.dispatchEvent(new window.Event('input', { bubbles: true }));
  submit($('poForm'));
  await waitFor(() => $('poError') && !$('poError').hidden, 3000);
  check('unknown PO shows a not-found error', $('poError') && $('poError').hidden === false,
        $('poError') ? $('poError').textContent : 'no element');
  check('still on the lookup step after error', $('view-lookup').hidden === false,
        'lookupHidden=' + $('view-lookup').hidden + ' resultsHidden=' + $('view-results').hidden +
        ' activeStep=' + (d.querySelector('#steps .is-active') ? d.querySelector('#steps .is-active').dataset.step : '?') +
        ' navActive=' + (d.querySelector('.nav-item.active') ? d.querySelector('.nav-item.active').dataset.step : '-') +
        ' err=' + JSON.stringify($('poError').textContent));

  /* ---------- logout ---------- */
  click($('logoutBtn'));
  await waitFor(() => !window.localStorage.getItem('devfactory.session'), 2000);
  const loginVisible = version === 'graphite'
    ? d.getElementById('screen-login').hidden === false
    : $('view-login').hidden === false;
  check('logout returns to the login screen', loginVisible);
  check('session cleared from localStorage', !window.localStorage.getItem('devfactory.session'));

  /* ---------- console errors ---------- */
  const real = errors.filter(e => !/Could not load|css|stylesheet/i.test(e));
  check('no uncaught JS errors', real.length === 0, real.slice(0, 3).join(' | '));

  window.close();
}

(async () => {
  for (const v of VERSIONS) {
    try { await run(v); }
    catch (e) { failures++; console.log('  ✗ EXCEPTION in ' + v + ': ' + e.message + '\n' + String(e.stack).split('\n')[1]); }
  }
  console.log('\n' + (failures ? '❌ ' + failures + ' check(s) failed' : '✅ all checks passed'));
  process.exit(failures ? 1 : 0);
})();
