/* =============================================================================
 * DevFactory · runtime configuration
 * -----------------------------------------------------------------------------
 * Everything you need to change in order to point the app at the real backend
 * lives in this file.
 *
 *   1. set  useMock: false
 *   2. set  apiBaseUrl: 'https://your-server.example.com/api/v1'
 *   3. (if your field names differ) adjust the mappers in shared/api.js
 * ===========================================================================*/
window.APP_CONFIG = {
  /* When true the app talks to the in-browser mock backend (shared/mock-data.js).
   * When false it talks to apiBaseUrl with fetch(). */
  useMock: true,

  /* Base URL of the real API. No trailing slash. */
  apiBaseUrl: 'https://your-api.example.com/api/v1',

  /* Endpoint contract used by shared/api.js */
  endpoints: {
    login:     { method: 'POST', path: '/auth/login' },   // { email, password }        -> { token, user }
    factories: { method: 'GET',  path: '/factories' },    //                            -> { factories: [...] }
    poLookup:  { method: 'GET',  path: '/pos/lookup' },   // ?po=PO-2026-0001           -> { po: {...}, factory_id: 'FAC-1001' }
    poList:    { method: 'GET',  path: '/pos' }           // ?factory_id=FAC-1001&q=    -> { records: [...] }
  },

  /* How long to wait for a real HTTP response before failing. */
  requestTimeout: 15000,

  /* Simulated network latency for the mock backend (ms). */
  mock: { minLatency: 260, maxLatency: 620 },

  /* Where the auth session is kept between page reloads. */
  session: { storageKey: 'devfactory.session' }
};
