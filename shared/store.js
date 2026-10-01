/* =============================================================================
 * DevFactory · application state + actions  (shared by all three versions)
 * -----------------------------------------------------------------------------
 * Tiny observable store. The three UI versions differ only in markup/CSS and in
 * how they render `store.state` — the flow logic below is identical everywhere.
 *
 * Steps:  login  ->  factory  ->  lookup  ->  results
 * ===========================================================================*/
(function () {
  var cfg = window.APP_CONFIG;

  function createStore() {
    var listeners = [];
    var toastTimer = null;

    /* Navigation epoch. Every user action that changes where the user is (or that
     * supersedes an earlier request) bumps it. Async work captures the epoch it
     * started under and discards its result if the user has moved on since —
     * otherwise a slow response could yank the user back to a previous screen. */
    var epoch = 0;
    function newEpoch() { return ++epoch; }
    function stale(mine) { return mine !== epoch; }

    var state = {
      /* flow */
      step: 'login',            // login | factory | lookup | results
      busy: null,               // 'login' | 'factories' | 'lookup' | 'records' | null
      error: null,              // { message, field? }
      toast: null,              // { type, message }

      /* session */
      token: null,
      user: null,

      /* factories */
      factories: [],
      factoryQuery: '',
      selectedFactory: null,

      /* PO lookup */
      poInput: '',
      suggestions: [],
      showSuggestions: false,
      resolved: null,           // { factory_id, po }
      mismatch: false,          // PO belongs to a different factory than selected

      /* results */
      records: [],
      listQuery: '',
      statusFilter: 'ALL',
      highlightPo: null,
      detail: null              // record opened in the detail panel/modal
    };

    function emit() { listeners.forEach(function (fn) { fn(state); }); }

    function set(patch) {
      Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
      emit();
    }

    function subscribe(fn) { listeners.push(fn); fn(state); }

    /* ---------------------------------------------------------------- utils */
    function fail(err) {
      /* A 401 while logged in means the token is no longer valid. */
      if (err && err.status === 401 && state.token) {
        store.logout();
        flash('Session expired — please sign in again.', 'warn');
        return;
      }
      set({ error: { message: err && err.message ? err.message : 'Something went wrong.', field: err && err.field } });
    }

    function flash(message, type) {
      set({ toast: { message: message, type: type || 'success' } });
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { set({ toast: null }); }, 3200);
    }

    /* Session persistence (survives a page reload) */
    function persist() {
      try {
        if (state.token) {
          localStorage.setItem(cfg.session.storageKey, JSON.stringify({ token: state.token, user: state.user }));
        } else {
          localStorage.removeItem(cfg.session.storageKey);
        }
      } catch (e) { /* private mode - ignore */ }
    }

    /* --------------------------------------------------------------- actions */
    var store = {
      state: state,
      set: set,
      subscribe: subscribe,
      flash: flash,

      /* Restore a previous session and jump straight to factory select. */
      async bootstrap() {
        var saved = null;
        try { saved = JSON.parse(localStorage.getItem(cfg.session.storageKey) || 'null'); } catch (e) {}
        if (saved && saved.token) {
          set({ token: saved.token, user: saved.user });
          await store.loadFactories(true);
        }
      },

      async login(email, password) {
        var mine = newEpoch();
        set({ busy: 'login', error: null });
        try {
          var res = await window.Api.login(email, password);
          if (stale(mine)) return;
          set({ token: res.token, user: res.user, busy: null });
          persist();
          flash('Welcome back, ' + (res.user.name || '').split(' ')[0] + '.');
          await store.loadFactories();
        } catch (err) {
          if (stale(mine)) return;
          set({ busy: null });
          fail(err);
        }
      },

      logout() {
        newEpoch();
        persist();
        try { localStorage.removeItem(cfg.session.storageKey); } catch (e) {}
        set({
          step: 'login', token: null, user: null, factories: [], selectedFactory: null,
          poInput: '', suggestions: [], resolved: null, records: [], error: null,
          listQuery: '', statusFilter: 'ALL', detail: null, highlightPo: null, mismatch: false
        });
        flash('Signed out.', 'info');
      },

      async loadFactories(silent) {
        var mine = newEpoch();
        set({ busy: silent ? null : 'factories', error: null });
        try {
          var res = await window.Api.getFactories(state.token);
          if (stale(mine)) return;
          set({ factories: res.factories, busy: null, step: 'factory' });
        } catch (err) {
          if (stale(mine)) return;
          set({ busy: null });
          fail(err);
        }
      },

      setFactoryQuery(v) { set({ factoryQuery: v }); },

      selectFactory(factory) {
        newEpoch();
        set({ selectedFactory: factory, step: 'lookup', error: null, poInput: '', suggestions: [], resolved: null, records: [] });
        flash('Factory selected: ' + factory.id, 'info');
      },

      backToFactories() { newEpoch(); set({ step: 'factory', error: null, detail: null }); },
      backToLookup() {
        newEpoch();
        set({ step: 'lookup', error: null, records: [], resolved: null, mismatch: false, detail: null, highlightPo: null });
      },

      /* --- PO input + suggestions -------------------------------------
       * Suggestions are a mock-mode convenience (there is no "search POs"
       * endpoint in the current contract). Point this at your own search
       * endpoint when the backend exposes one. */
      setPoInput(v) {
        var q = String(v || '').toUpperCase();
        var list = (cfg.useMock && window.MOCK_DATA) ? window.MOCK_DATA.pos : [];
        var matches = q.length >= 2
          ? list.filter(function (p) { return p.po.toUpperCase().indexOf(q) !== -1; })
                .slice(0, 6)
                .map(function (p) { return { po: p.po, buyer: p.buyer, style: p.style, factoryId: p.factoryId }; })
          : [];
        set({ poInput: v, suggestions: matches, showSuggestions: matches.length > 0, error: null });
      },
      hideSuggestions() { set({ showSuggestions: false }); },

      /* --- the PO -> factory_id lookup --------------------------------- */
      async lookupPo(poNumber) {
        var po = String(poNumber !== undefined ? poNumber : state.poInput || '').trim();
        if (!po) { set({ error: { message: 'Enter a PO number to continue.', field: 'po' } }); return; }

        var mine = newEpoch();
        set({ busy: 'lookup', error: null, showSuggestions: false, poInput: po });
        try {
          var res = await window.Api.lookupPo(po, state.token);
          if (stale(mine)) return;
          var mismatch = !!(state.selectedFactory && state.selectedFactory.id !== res.factory_id);

          set({ resolved: res, mismatch: mismatch, highlightPo: res.po ? res.po.po : po.toUpperCase() });

          /* The PO tells us the factory - load that factory's records. */
          await store.loadRecords(res.factory_id, mine);
          if (stale(mine)) return;
          set({ step: 'results' });

          flash(
            mismatch
              ? 'PO belongs to ' + res.factory_id + ', not ' + state.selectedFactory.id + '.'
              : 'PO found in ' + res.factory_id + '.',
            mismatch ? 'warn' : 'success'
          );
        } catch (err) {
          if (stale(mine)) return;
          set({ busy: null });
          fail(err);
        }
      },

      pickSuggestion(s) { store.lookupPo(s.po); },

      /* --- results list ------------------------------------------------ */
      /* `mine` lets callers that already own an epoch (lookup, switch) reuse it
       * instead of starting a new one - otherwise they would cancel themselves. */
      async loadRecords(factoryId, mine) {
        if (mine === undefined) mine = newEpoch();
        set({ busy: 'records', error: null });
        try {
          var res = await window.Api.getPoList(factoryId || (state.selectedFactory && state.selectedFactory.id), '', state.token);
          if (stale(mine)) return;
          set({ records: res.records, busy: null });
        } catch (err) {
          if (stale(mine)) return;
          set({ busy: null });
          fail(err);
        }
      },

      setListQuery(v) { set({ listQuery: v }); },
      setStatusFilter(v) { set({ statusFilter: v }); },
      openDetail(rec) { set({ detail: rec }); },
      closeDetail() { set({ detail: null }); },

      /* Re-run the lookup against the factory the PO actually belongs to. */
      async switchToPoFactory() {
        if (!state.resolved) return;
        var target = state.factories.filter(function (f) { return f.id === state.resolved.factory_id; })[0];
        if (!target) { flash('You do not have access to ' + state.resolved.factory_id + '.', 'warn'); return; }
        var mine = newEpoch();
        set({ selectedFactory: target, mismatch: false });
        await store.loadRecords(target.id, mine);
        if (stale(mine)) return;          // user navigated away while this loaded
        flash('Switched to ' + target.id + ' — ' + target.name + '.');
        set({ step: 'results' });
      },

      /* Derived: records after search + status filter. */
      visibleRecords() {
        var q = state.listQuery.trim().toLowerCase();
        return state.records.filter(function (r) {
          if (state.statusFilter !== 'ALL' && r.status !== state.statusFilter) return false;
          if (!q) return true;
          return [r.po, r.buyer, r.style, r.item, r.status, r.factoryId].join(' ').toLowerCase().indexOf(q) !== -1;
        });
      },

      /* Derived: KPI totals for the currently visible rows. */
      kpis(rows) {
        rows = rows || store.visibleRecords();
        var qty = 0, value = 0, late = 0, prog = 0;
        rows.forEach(function (r) {
          qty += r.qty;
          value += r.value || r.qty * r.unitPrice;
          prog += r.progress;
          if (r.status === 'Delayed') late++;
        });
        return {
          count: rows.length,
          qty: qty,
          value: value,
          delayed: late,
          avgProgress: rows.length ? Math.round(prog / rows.length) : 0
        };
      }
    };

    return store;
  }

  window.createStore = createStore;
})();
