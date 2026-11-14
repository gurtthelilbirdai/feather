// Feather Map API: shared places birds visit, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const https = require('https');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'map.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS places (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bird TEXT NOT NULL DEFAULT 'gurt',
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    kind TEXT NOT NULL DEFAULT 'spot',
    note TEXT NOT NULL DEFAULT '',
    visits INTEGER NOT NULL DEFAULT 1,
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS places_created ON places(created DESC);
`);

const stmt = {
  list: db.prepare('SELECT * FROM places ORDER BY created DESC LIMIT 500'),
  get: db.prepare('SELECT * FROM places WHERE id = ?'),
  insert: db.prepare('INSERT INTO places (id,name,bird,lat,lon,kind,note,visits,created) VALUES (@id,@name,@bird,@lat,@lon,@kind,@note,@visits,@created)'),
  remove: db.prepare('DELETE FROM places WHERE id = ?'),
  bump: db.prepare('UPDATE places SET visits = visits + 1 WHERE id = ?'),
  kinds: db.prepare('SELECT kind, COUNT(*) AS n FROM places GROUP BY kind ORDER BY n DESC')
};

function publicPlace(r) {
  if (!r) return null;
  return { id: r.id, name: r.name, bird: r.bird, lat: r.lat, lon: r.lon, kind: r.kind, note: r.note, visits: r.visits, created: r.created };
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 100000) req.destroy(); });
  req.on('end', () => { let b = {}; try { b = JSON.parse(raw || '{}'); } catch (e) { b = {}; } cb(b); });
}
function now() { return new Date().toISOString(); }

const NTFY_HOSTS = ['https://ntfy.nerdvpn.de', 'https://ntfy.sh'];
const TOPIC = '/gurt-feather-map';
function ntfyOne(host, payload) {
  return new Promise(resolve => {
    try {
      const data = JSON.stringify(payload);
      const u = new URL(host + TOPIC);
      const req = https.request(u, { method: 'POST', timeout: 5000, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, r => { r.resume(); resolve(r.statusCode < 400); });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end(data);
    } catch (e) { resolve(false); }
  });
}
async function ntfy(payload) { for (const h of NTFY_HOSTS) { if (await ntfyOne(h, payload)) return true; } return false; }

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'places') {
    const rows = stmt.list.all();
    return json(res, 200, {
      places: rows.map(publicPlace),
      stats: { total: rows.length, kinds: stmt.kinds.all() }
    });
  }

  if (req.method === 'GET' && route === 'place' && seg[1]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such place' });
    return json(res, 200, { place: publicPlace(row) });
  }

  if (req.method === 'POST' && route === 'places' && seg[1] === 'new') {
    readBody(req, body => {
      const name = String(body.name || '').trim().slice(0, 100);
      if (!name) return json(res, 400, { error: 'name required' });
      const lat = Number(body.lat), lon = Number(body.lon);
      if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)
        return json(res, 400, { error: 'valid lat/lon required' });
      const place = {
        id: 'map' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name,
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        lat, lon,
        kind: String(body.kind || 'spot').trim().slice(0, 30) || 'spot',
        note: String(body.note || '').trim().slice(0, 400),
        visits: 1,
        created: now()
      };
      stmt.insert.run(place);
      const saved = publicPlace(stmt.get.get(place.id));
      ntfy({ type: 'new', place: saved });
      return json(res, 200, { ok: true, place: saved });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'place' && seg[2] === 'visit' && seg[1]) {
    if (!stmt.get.get(seg[1])) return json(res, 404, { error: 'no such place' });
    stmt.bump.run(seg[1]);
    const saved = publicPlace(stmt.get.get(seg[1]));
    ntfy({ type: 'visit', place: saved });
    return json(res, 200, { ok: true, place: saved });
  }

  if (req.method === 'POST' && route === 'place' && seg[2] === 'delete' && seg[1]) {
    if (!stmt.get.get(seg[1])) return json(res, 404, { error: 'no such place' });
    stmt.remove.run(seg[1]);
    ntfy({ type: 'delete', id: seg[1] });
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
