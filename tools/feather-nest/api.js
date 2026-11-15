// Feather Nest API: a shared registry of birds' nests.
// SQLite storage for nests and nest visits.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'nest.db'));
db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS nests (
  id TEXT PRIMARY KEY,
  bird TEXT NOT NULL,
  place TEXT NOT NULL,
  kind TEXT DEFAULT 'bowl',
  material TEXT DEFAULT '',
  height TEXT DEFAULT '',
  residents INTEGER DEFAULT 0,
  note TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  nest_id TEXT NOT NULL,
  by_bird TEXT NOT NULL,
  note TEXT DEFAULT '',
  created TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS visit_nest ON visits(nest_id);`);

const now = () => new Date().toISOString();
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 100000) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); } });
  });
}

function nestRow(r) {
  const visits = db.prepare('SELECT COUNT(*) AS n FROM visits WHERE nest_id = ?').get(r.id).n;
  return {
    id: r.id, bird: r.bird, place: r.place, kind: r.kind, material: r.material,
    height: r.height, residents: r.residents, note: r.note, status: r.status,
    created: r.created, visits
  };
}

module.exports = function handler(req, res, route) {
  route = Array.isArray(route) ? route.join('/') : String(route || '');
  const seg = route.split('/').filter(Boolean);

  if (req.method === 'GET' && (route === '' || route === 'nests')) {
    const u = new URL(req.url, 'http://x');
    const q = (u.searchParams.get('q') || '').trim().toLowerCase();
    const status = (u.searchParams.get('status') || '').trim().toLowerCase();
    let rows = db.prepare('SELECT * FROM nests ORDER BY created DESC').all();
    if (q) rows = rows.filter(r =>
      [r.bird, r.place, r.kind, r.material, r.note].join(' ').toLowerCase().includes(q));
    if (status) rows = rows.filter(r => String(r.status).toLowerCase() === status);
    return json(res, 200, { count: rows.length, nests: rows.map(nestRow) });
  }

  if (req.method === 'GET' && seg[0] === 'nest' && seg[1]) {
    const r = db.prepare('SELECT * FROM nests WHERE id = ?').get(seg[1]);
    if (!r) return json(res, 404, { error: 'no such nest' });
    const visits = db.prepare('SELECT * FROM visits WHERE nest_id = ? ORDER BY created DESC').all(seg[1]);
    return json(res, 200, { nest: nestRow(r), visits });
  }

  if (req.method === 'GET' && route === 'stats') {
    const kinds = db.prepare('SELECT kind, COUNT(*) AS n FROM nests GROUP BY kind ORDER BY n DESC').all();
    const total = db.prepare('SELECT COUNT(*) AS n FROM nests').get().n;
    const residents = db.prepare('SELECT COALESCE(SUM(residents),0) AS n FROM nests').get().n;
    const visits = db.prepare('SELECT COUNT(*) AS n FROM visits').get().n;
    return json(res, 200, { total, residents, visits, kinds });
  }

  if (req.method === 'POST' && route === 'nest') {
    return readBody(req).then(b => {
      const bird = String(b.bird || '').trim().slice(0, 40);
      const place = String(b.place || '').trim().slice(0, 80);
      if (!bird || !place) return json(res, 400, { error: 'a nest needs a bird and a place' });
      const id = rid();
      const resi = Math.max(0, Math.min(20, parseInt(b.residents, 10) || 0));
      db.prepare(`INSERT INTO nests (id,bird,place,kind,material,height,residents,note,status,created)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        id, bird, place,
        String(b.kind || 'bowl').slice(0, 40),
        String(b.material || '').slice(0, 120),
        String(b.height || '').slice(0, 40),
        resi,
        String(b.note || '').slice(0, 400),
        String(b.status || 'active').slice(0, 20),
        now());
      return json(res, 200, { ok: true, nest: nestRow(db.prepare('SELECT * FROM nests WHERE id = ?').get(id)) });
    });
  }

  if (req.method === 'POST' && route === 'visit') {
    return readBody(req).then(b => {
      const nestId = String(b.nest_id || '');
      const by = String(b.by_bird || '').trim().slice(0, 40);
      if (!db.prepare('SELECT id FROM nests WHERE id = ?').get(nestId)) return json(res, 404, { error: 'no such nest' });
      if (!by) return json(res, 400, { error: 'who is visiting?' });
      const id = rid();
      const note = String(b.note || '').slice(0, 240);
      db.prepare('INSERT INTO visits (id,nest_id,by_bird,note,created) VALUES (?,?,?,?,?)')
        .run(id, nestId, by, note, now());
      return json(res, 200, { ok: true, visit: { id, nest_id: nestId, by_bird: by, note, created: now() } });
    });
  }

  return json(res, 404, { error: 'not found' });
};
