# dev-factory

Purchase order tracker — sign in, pick a factory, enter a PO number, and the app resolves
the `factory_id` that PO belongs to and lists that factory's records.

Built with plain **HTML + CSS + JavaScript** (no build step, no dependencies).

## Run it

```bash
python3 -m http.server 5173
# then open http://localhost:5173
```

Open `index.html` (the version picker) or go straight to a version:

| Version | Look | Path |
|---|---|---|
| **v1 · Aurora** | Light, airy, gradient cards | `versions/aurora/index.html` |
| **v2 · Graphite** | Dark ops console, sidebar + drawer | `versions/graphite/index.html` |
| **v3 · Paper** | Editorial ledger, serif + ruled tables | `versions/paper/index.html` |

All three share the same flow logic, API layer and mock data — only the markup/CSS differs.

## Flow

```
Login  →  Select factory  →  Enter PO  →  GET factory_id for that PO  →  Records list
```

1. **Login** — `POST /auth/login`, returns `{ token, user }`. Session is kept in `localStorage`.
2. **Select factory** — `GET /factories`, searchable list/grid.
3. **PO lookup** — `GET /pos/lookup?po=PO-2026-0001` returns `{ factory_id, po }`.
4. **Records** — `GET /pos?factory_id=FAC-1001` returns `{ records: [...] }`, shown in a
   filterable table with status chips, KPIs and a per-record detail panel.

If the PO belongs to a different factory than the one selected, the app says so and offers a
one-click switch to the correct factory.

## Demo credentials

| Email | Password | Role |
|---|---|---|
| `planner@demo.com` | `demo1234` | Merchandise Planner |
| `admin@demo.com` | `demo1234` | Operations Admin |

Demo POs: `PO-2026-0001` (own factory), `PO-2026-0014` (different factory), `PO-2026-9999` (not found).

## Wiring the real API

1. Open `shared/config.js` and set:

```js
useMock: false,
apiBaseUrl: 'https://your-api.example.com/api/v1',
```

2. Adjust the paths in `config.endpoints` if they differ from the defaults
   (`/auth/login`, `/factories`, `/pos/lookup`, `/pos`).
3. If your payload uses different field names, extend the `mapPo()` / `mapFactory()`
   functions in `shared/api.js` — they already accept both `snake_case` and `camelCase`.

## Project layout

```
index.html                  version picker / overview
shared/
  config.js                 API base URL, endpoints, mock toggle
  mock-data.js              demo users, factories, purchase orders (mock only)
  api.js                    MockApi + HttpApi behind one interface
  store.js                  state + actions (login → factory → lookup → results)
  format.js                 date / number / currency / status helpers
versions/
  aurora/    index.html  styles.css  app.js
  graphite/  index.html  styles.css  app.js
  paper/     index.html  styles.css  app.js
tools/                      dev-only, not needed to run the app
  smoke-test.js             drives all 3 versions end-to-end in jsdom (33 checks each)
  mock-api-server.js        stand-in backend implementing the endpoint contract
  run-http-mode.sh          runs the suite against that server via the real fetch adapter
```

Each version follows the same file convention: `index.html` (markup), `styles.css`
(its design language), `app.js` (renders `store.state` into the DOM). Everything
flow-related lives in `shared/`, so a bug fix or new rule applies to all three.

## Verifying changes (optional)

```bash
npm i jsdom                                  # dev-only
python3 -m http.server 5173                  # from the repo root
node tools/smoke-test.js                     # mock mode

node tools/mock-api-server.js &              # stand-in API on :8787
tools/run-http-mode.sh                        # same suite through the real fetch adapter
```

The suite walks login → factory → PO lookup → records in each version and checks the
mismatch, not-found, filter, detail-panel, logout and session-expiry paths.

## Notes / things to confirm against your API

- **Field names** — the mappers accept `snake_case` and `camelCase`, but confirm the
  exact PO lookup response. Right now the app reads `factory_id` (or `po.factory_id`).
- **Unauthorized handling** — a `401` mid-session signs the user out with a message.
- **Autocomplete on the PO field** is a mock-mode convenience (no search endpoint is
  assumed). Wire it to your own search endpoint if you have one.
- **CORS** — if the frontend is served from a different origin than the API, your
  server must allow it.
