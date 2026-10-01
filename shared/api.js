/* =============================================================================
 * DevFactory · API layer
 * -----------------------------------------------------------------------------
 * One interface, two backends:
 *
 *   window.APP_CONFIG.useMock === true   ->  MockApi   (in-browser, shared/mock-data.js)
 *   window.APP_CONFIG.useMock === false  ->  HttpApi   (fetch against apiBaseUrl)
 *
 * Every method returns a Promise and throws an ApiError with:
 *      { status: Number, code: String, message: String, field?: String }
 *
 * Response contract expected from the real backend (snake_case is normalised for
 * you in the mappers below, so keep this shape - or tweak the mappers):
 *
 *   POST /auth/login   { email, password }
 *        -> { token: "jwt...", user: { id, name, email, role } }
 *
 *   GET  /factories                       (Authorization: Bearer <token>)
 *        -> { factories: [ { id, name, city, country, units, capacity, contact, status } ] }
 *
 *   GET  /pos/lookup?po=PO-2026-0001
 *        -> { factory_id: "FAC-1001", po: { po, style, item, buyer, qty, ... } }
 *
 *   GET  /pos?factory_id=FAC-1001&q=
 *        -> { records: [ { po, factory_id, buyer, style, item, qty, unit, status, ... } ] }
 * ===========================================================================*/
(function () {
  var cfg = window.APP_CONFIG;

  /* ------------------------------------------------------------------ error */
  function ApiError(status, code, message, field) {
    var e = new Error(message);
    e.name = 'ApiError';
    e.status = status;
    e.code = code;
    if (field) e.field = field;
    return e;
  }

  /* --------------------------------------------------------------- utils --- */
  function latency() {
    var m = cfg.mock;
    return m.minLatency + Math.random() * (m.maxLatency - m.minLatency);
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  /* Normalise an incoming PO record so the UI always sees the same fields. */
  function mapPo(p) {
    if (!p) return null;
    return {
      po:        p.po || p.po_number || p.poNumber,
      factoryId: p.factoryId || p.factory_id || p.factoryIdCode || null,
      buyer:     p.buyer || p.buyer_name || '-',
      style:     p.style || p.style_no || p.styleNumber || '-',
      item:      p.item || p.description || p.item_name || '-',
      qty:       Number(p.qty || p.quantity || 0),
      unit:      p.unit || p.uom || 'pcs',
      status:    p.status || 'Confirmed',
      progress:  Number(p.progress != null ? p.progress : (p.progress_pct || 0)),
      orderDate: p.orderDate || p.order_date || null,
      shipDate:  p.shipDate || p.ship_date || p.delivery_date || null,
      unitPrice: Number(p.unitPrice || p.unit_price || 0),
      value:     Number(p.value || p.order_value || 0)
    };
  }

  function mapFactory(f) {
    if (!f) return null;
    return {
      id:       f.id || f.factory_id,
      name:     f.name || f.factory_name || '-',
      city:     f.city || f.location || '-',
      country:  f.country || '-',
      units:    Number(f.units || f.unit_count || 0),
      capacity: Number(f.capacity || f.daily_capacity || 0),
      contact:  f.contact || f.contact_email || '-',
      status:   f.status || 'Active'
    };
  }

  /* =========================================================================
   * MOCK BACKEND
   * =======================================================================*/
  var MockApi = {
    login: async function (creds) {
      await wait(latency());
      var email = String(creds.email || '').trim().toLowerCase();
      var user = window.MOCK_DATA.users.filter(function (u) { return u.email.toLowerCase() === email; })[0];
      if (!user) throw ApiError(401, 'INVALID_CREDENTIALS', 'No account found for that email.', 'email');
      if (user.password !== creds.password) throw ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect password. Try again.', 'password');
      return {
        token: 'mock-jwt.' + btoa(user.id + ':' + Date.now()).replace(/=/g, ''),
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      };
    },

    getFactories: async function () {
      await wait(latency());
      return { factories: clone(window.MOCK_DATA.factories).map(mapFactory) };
    },

    /* The important one: resolve which factory a PO belongs to. */
    lookupPo: async function (poNumber) {
      await wait(latency());
      var needle = String(poNumber || '').trim().toUpperCase();
      if (!needle) throw ApiError(400, 'PO_REQUIRED', 'Enter a PO number to continue.', 'po');
      var found = window.MOCK_DATA.pos.filter(function (p) { return p.po.toUpperCase() === needle; })[0];
      if (!found) throw ApiError(404, 'PO_NOT_FOUND', 'PO “' + poNumber + '” was not found in any factory.', 'po');
      return { factory_id: found.factoryId, po: mapPo(found) };
    },

    getPoList: async function (factoryId, q) {
      await wait(latency());
      var needle = String(q || '').trim().toLowerCase();
      var rows = window.MOCK_DATA.pos.filter(function (p) {
        if (factoryId && p.factoryId !== factoryId) return false;
        if (!needle) return true;
        return [p.po, p.buyer, p.style, p.item, p.status].join(' ').toLowerCase().indexOf(needle) !== -1;
      }).map(mapPo);
      return { records: rows };
    }
  };

  /* =========================================================================
   * REAL HTTP BACKEND
   * =======================================================================*/
  function buildUrl(path, query) {
    var url = cfg.apiBaseUrl.replace(/\/$/, '') + path;
    var qs = Object.keys(query || {})
      .filter(function (k) { return query[k] !== undefined && query[k] !== null && query[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]); })
      .join('&');
    return qs ? url + '?' + qs : url;
  }

  async function http(spec, opts) {
    opts = opts || {};
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, cfg.requestTimeout);

    var headers = { 'Content-Type': 'application/json' };
    if (opts.token) headers.Authorization = 'Bearer ' + opts.token;

    var res;
    try {
      res = await fetch(buildUrl(spec.path, opts.query), {
        method: spec.method,
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') throw ApiError(408, 'TIMEOUT', 'The server took too long to respond.');
      throw ApiError(0, 'NETWORK_ERROR', 'Could not reach the API. Check the connection and apiBaseUrl.');
    }
    clearTimeout(timer);

    var payload = null;
    try { payload = await res.json(); } catch (e) { payload = null; }

    if (!res.ok) {
      var msg = (payload && (payload.message || payload.error)) || ('Request failed with status ' + res.status + '.');
      throw ApiError(res.status, (payload && payload.code) || 'HTTP_' + res.status, msg);
    }
    return payload || {};
  }

  var HttpApi = {
    login: function (creds) {
      return http(cfg.endpoints.login, { body: creds }).then(function (r) {
        return { token: r.token || r.access_token, user: r.user || {} };
      }, function (err) {
        /* 401 on login is always about these two inputs - tell the UI which one. */
        if (err && err.status === 401) {
          var mentionsEmail = /email|account|user/i.test(err.message || '');
          throw ApiError(401, err.code || 'INVALID_CREDENTIALS', err.message, mentionsEmail ? 'email' : 'password');
        }
        throw err;
      });
    },
    getFactories: function (token) {
      return http(cfg.endpoints.factories, { token: token }).then(function (r) {
        return { factories: (r.factories || r.data || []).map(mapFactory) };
      });
    },
    lookupPo: function (poNumber, token) {
      return http(cfg.endpoints.poLookup, { token: token, query: { po: poNumber } }).then(function (r) {
        var f = r.factory_id || (r.po && (r.po.factory_id || r.po.factoryId));
        if (!f) throw ApiError(404, 'PO_NOT_FOUND', 'PO “' + poNumber + '” was not found.', 'po');
        return { factory_id: f, po: mapPo(r.po) };
      }, function (err) {
        if (err && !err.field && (err.status === 404 || err.status === 400 || err.status === 422)) err.field = 'po';
        throw err;
      });
    },
    getPoList: function (factoryId, q, token) {
      return http(cfg.endpoints.poList, { token: token, query: { factory_id: factoryId, q: q } })
        .then(function (r) { return { records: (r.records || r.data || []).map(mapPo) }; });
    }
  };

  /* =========================================================================
   * PUBLIC INTERFACE — call sites never know which backend is active.
   * =======================================================================*/
  var useMock = !!cfg.useMock;
  window.Api = {
    isMock: useMock,
    ApiError: ApiError,

    login: function (email, password) {
      return useMock ? MockApi.login({ email: email, password: password }) : HttpApi.login({ email: email, password: password });
    },
    getFactories: function (token) {
      return useMock ? MockApi.getFactories() : HttpApi.getFactories(token);
    },
    lookupPo: function (poNumber, token) {
      return useMock ? MockApi.lookupPo(poNumber) : HttpApi.lookupPo(poNumber, token);
    },
    getPoList: function (factoryId, q, token) {
      return useMock ? MockApi.getPoList(factoryId, q) : HttpApi.getPoList(factoryId, q, token);
    }
  };
})();
