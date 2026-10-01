/* =============================================================================
 * DevFactory · shared formatting helpers (used by all three versions)
 * ===========================================================================*/
(function () {
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function num(n) {
    return Number(n || 0).toLocaleString('en-US');
  }

  function compact(n) {
    n = Number(n || 0);
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 ? 1 : 0) + 'K';
    return String(n);
  }

  function money(n, currency) {
    var v = Number(n || 0);
    var s = v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : v.toFixed(0);
    return (currency || '$') + s;
  }

  function date(iso) {
    if (!iso) return '—';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return String(iso);
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function shortDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return String(iso);
    return String(d.getDate()).padStart(2, '0') + ' ' + MONTHS[d.getMonth()];
  }

  function daysUntil(iso) {
    if (!iso) return null;
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((d - today) / 86400000);
  }

  function initials(name) {
    return String(name || '?').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/)
      .slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  /* Statuses used by the mock data -> stable, version-agnostic tone names. */
  var TONES = {
    'In Production': 'active',
    'Confirmed': 'info',
    'Shipped': 'ship',
    'Completed': 'done',
    'Delayed': 'danger',
    'On Hold': 'hold'
  };
  function tone(status) { return TONES[status] || 'info'; }

  window.Fmt = {
    esc: esc, num: num, compact: compact, money: money,
    date: date, shortDate: shortDate, daysUntil: daysUntil,
    initials: initials, slug: slug, tone: tone,
    STATUSES: ['In Production', 'Confirmed', 'Shipped', 'Completed', 'Delayed', 'On Hold']
  };
})();
