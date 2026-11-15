// Feather Songmaker API: shared song shelf, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'songs.db'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  bird TEXT NOT NULL,
  title TEXT NOT NULL,
  bpm INTEGER NOT NULL,
  pattern TEXT NOT NULL,
  plays INTEGER NOT NULL DEFAULT 0,
  created TEXT DEFAULT (datetime('now'))
)`);

const stmt = {
  list: db.prepare('SELECT id, bird, title, bpm, pattern, plays, created FROM songs ORDER BY created DESC LIMIT 40'),
  get: db.prepare('SELECT id, bird, title, bpm, pattern, plays, created FROM songs WHERE id = ?'),
  add: db.prepare('INSERT INTO songs (id, bird, title, bpm, pattern) VALUES (?, ?, ?, ?, ?)'),
  play: db.prepare('UPDATE songs SET plays = plays + 1 WHERE id = ?')
};

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } });
  });
}
function safePattern(p) {
  if (!p || typeof p !== 'object') return null;
  const lanes = ['kick', 'snare', 'hat', 'bass', 'lead'];
  const out = {};
  for (const l of lanes) {
    const row = Array.isArray(p[l]) ? p[l] : [];
    out[l] = Array.from({ length: 16 }, (_, i) => {
      const v = row[i];
      if (v === true || v === 1) return 1;
      if (typeof v === 'string' && /^[A-G]#?[0-5]$/.test(v)) return v;
      return 0;
    });
  }
  return out;
}

module.exports = async function handler(req, res, seg) {
  const route = seg.join('/');
  if (req.method === 'GET' && route === 'songs') {
    return json(res, 200, { songs: stmt.list.all() });
  }
  if (req.method === 'GET' && route.startsWith('song/')) {
    const s = stmt.get.get(seg[1]);
    if (!s) return json(res, 404, { error: 'no such song' });
    return json(res, 200, { song: s });
  }
  if (req.method === 'POST' && route === 'song') {
    const b = await readBody(req);
    const bird = String(b.bird || 'gurt').slice(0, 24);
    const title = String(b.title || 'untitled song').slice(0, 60);
    const bpm = Math.max(50, Math.min(220, Number(b.bpm) || 100));
    const pattern = safePattern(b.pattern);
    if (!pattern) return json(res, 400, { error: 'pattern must have 5 lanes of 16 steps' });
    const id = 'song' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    stmt.add.run(id, bird, title, bpm, JSON.stringify(pattern));
    return json(res, 200, { ok: true, song: stmt.get.get(id) });
  }
  if (req.method === 'POST' && route === 'play') {
    const b = await readBody(req);
    const id = String(b.id || '');
    const s = stmt.get.get(id);
    if (!s) return json(res, 404, { error: 'no such song' });
    stmt.play.run(id);
    return json(res, 200, { ok: true, plays: s.plays + 1 });
  }
  return false;
};
