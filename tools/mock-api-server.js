/* A stand-in for the real backend, implementing the documented contract:
 *   POST /api/v1/auth/login         -> { token, user }
 *   GET  /api/v1/factories          -> { factories: [...] }        (Bearer auth)
 *   GET  /api/v1/pos/lookup?po=     -> { factory_id, po }          (Bearer auth, 404 if unknown)
 *   GET  /api/v1/pos?factory_id=    -> { records: [...] }          (Bearer auth)
 * Deliberately uses snake_case + different field names to prove the mappers cope.
 */
/* Dev-only stand-in for the real backend, used by tools/run-http-mode.sh.
 *   node tools/mock-api-server.js     ->  http://localhost:8787/api/v1
 */
const http = require('http');
const PORT = 8787;

global.window = {};
require(require('path').join(__dirname, '..', 'shared', 'mock-data.js'));
const MOCK = global.window.MOCK_DATA;

const TOKEN = 'test-jwt-abc123';
const log = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  const send = (code, body) => {
    res.writeHead(code, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*'
    });
    res.end(JSON.stringify(body));
  };
  log.push(req.method + ' ' + url.pathname + (url.search || ''));
  if (req.method === 'OPTIONS') return send(204, {});

  const auth = req.headers.authorization || '';
  const authed = auth === 'Bearer ' + TOKEN;

  /* login */
  if (url.pathname === '/api/v1/auth/login' && req.method === 'POST') {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch (e) {}
      const u = MOCK.users.find(x => x.email.toLowerCase() === String(body.email || '').toLowerCase());
      if (!u || u.password !== body.password) {
        return send(401, { code: 'INVALID_CREDENTIALS', message: u ? 'Incorrect password. Try again.' : 'No account found for that email.' });
      }
      send(200, { access_token: TOKEN, user: { id: u.id, name: u.name, email: u.email, role: u.role } });
    });
    return;
  }

  if (!authed) return send(401, { code: 'UNAUTHORIZED', message: 'Missing or invalid token.' });

  /* factories */
  if (url.pathname === '/api/v1/factories') {
    return send(200, {
      factories: MOCK.factories.map(f => ({
        factory_id: f.id, factory_name: f.name, city: f.city, country: f.country,
        unit_count: f.units, daily_capacity: f.capacity, contact_email: f.contact, status: f.status
      }))
    });
  }

  /* PO -> factory_id */
  if (url.pathname === '/api/v1/pos/lookup') {
    const po = String(url.searchParams.get('po') || '').toUpperCase();
    const hit = MOCK.pos.find(p => p.po.toUpperCase() === po);
    if (!hit) return send(404, { code: 'PO_NOT_FOUND', message: 'PO “' + url.searchParams.get('po') + '” was not found.' });
    return send(200, {
      factory_id: hit.factoryId,
      po: { po_number: hit.po, buyer_name: hit.buyer, style_no: hit.style, description: hit.item,
            quantity: hit.qty, uom: hit.unit, status: hit.status, progress_pct: hit.progress,
            order_date: hit.orderDate, delivery_date: hit.shipDate, unit_price: hit.unitPrice }
    });
  }

  /* records */
  if (url.pathname === '/api/v1/pos') {
    const fid = url.searchParams.get('factory_id');
    const rows = MOCK.pos.filter(p => !fid || p.factoryId === fid);
    return send(200, {
      records: rows.map(p => ({
        po_number: p.po, factory_id: p.factoryId, buyer_name: p.buyer, style_no: p.style,
        description: p.item, quantity: p.qty, uom: p.unit, status: p.status, progress_pct: p.progress,
        order_date: p.orderDate, delivery_date: p.shipDate, unit_price: p.unitPrice
      }))
    });
  }

  send(404, { code: 'NOT_FOUND', message: 'No such endpoint: ' + url.pathname });
});

server.listen(PORT, '0.0.0.0', () => console.log('mock API on http://localhost:' + PORT + '/api/v1'));
process.on('SIGTERM', () => { console.log('\nrequests served:\n' + log.join('\n')); server.close(() => process.exit(0)); });
