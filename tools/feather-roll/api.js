// Feather Flock API: a shared directory of the flock.
// SQLite storage for bird profiles, skills and endorsements.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'flock.db'));
db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS birds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  species TEXT DEFAULT 'round bluebird',
  colour TEXT DEFAULT '#5aa9e6',
  home TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  skills TEXT DEFAULT '[]',
  looking_for TEXT DEFAULT '',
  created TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS endorsements (
  id TEXT PRIMARY KEY,
  bird_id TEXT NOT NULL,
  by_bird TEXT NOT NULL,
  note TEXT DEFAULT '',
  created TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS end_bird ON endorsements(bird_id);`);

const now = () => new Date().toISOString();
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 100000) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); } });
  });
}

function birdRow(r) {
  const ends = db.prepare('SELECT COUNT(*) AS n FROM endorsements WHERE bird_id = ?').get(r.id).n;
  let skills = [];
  try { skills = JSON.parse(r.skills || '[]'); } catch (e) { skills = []; }
  return {
    id: r.id, name: r.name, species: r.species, colour: r.colour,
    home: r.home, bio: r.bio, skills, looking_for: r.looking_for,
    created: r.created, endorsements: ends
  };
}

module.exports = function handler(req, res, route) {
  route = Array.isArray(route) ? route.join('/') : String(route || '');
  const seg = route.split('/').filter(Boolean);

  if (req.method === 'GET' && (route === '' || route === 'birds')) {
    const u = new URL(req.url, 'http://x');
    const q = (u.searchParams.get('q') || '').trim().toLowerCase();
    const skill = (u.searchParams.get('skill') || '').trim().toLowerCase();
    let rows = db.prepare('SELECT * FROM birds ORDER BY created DESC').all();
    if (q) rows = rows.filter(r =>
      [r.name, r.species, r.home, r.bio, r.looking_for].join(' ').toLowerCase().includes(q));
    if (skill) rows = rows.filter(r => {
      let s = []; try { s = JSON.parse(r.skills || '[]'); } catch (e) {}
      return s.some(x => String(x).toLowerCase().includes(skill));
    });
    return json(res, 200, { count: rows.length, birds: rows.map(birdRow) });
  }

  if (req.method === 'GET' && seg[0] === 'bird' && seg[1]) {
    const r = db.prepare('SELECT * FROM birds WHERE id = ?').get(seg[1]);
    if (!r) return json(res, 404, { error: 'no such bird' });
    const ends = db.prepare('SELECT * FROM endorsements WHERE bird_id = ? ORDER BY created DESC').all(seg[1]);
    return json(res, 200, { bird: birdRow(r), endorsements: ends });
  }

  if (req.method === 'GET' && route === 'skills') {
    const rows = db.prepare('SELECT skills FROM birds').all();
    const counts = {};
    for (const r of rows) {
      let s = []; try { s = JSON.parse(r.skills || '[]'); } catch (e) {}
      for (const x of s) counts[x] = (counts[x] || 0) + 1;
    }
    const list = Object.entries(counts).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
    return json(res, 200, { skills: list });
  }

  if (req.method === 'POST' && route === 'bird') {
    return readBody(req).then(b => {
      const name = String(b.name || '').trim().slice(0, 40);
      if (!name) return json(res, 400, { error: 'a bird needs a name' });
      const id = rid();
      const skills = Array.isArray(b.skills)
        ? b.skills.map(s => String(s).trim().slice(0, 24)).filter(Boolean).slice(0, 8)
        : String(b.skills || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);
      db.prepare(`INSERT INTO birds (id,name,species,colour,home,bio,skills,looking_for,created)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(
        id, name,
        String(b.species || 'round bluebird').slice(0, 60),
        String(b.colour || '#5aa9e6').slice(0, 9),
        String(b.home || '').slice(0, 60),
        String(b.bio || '').slice(0, 400),
        JSON.stringify(skills),
        String(b.looking_for || '').slice(0, 120),
        now());
      return json(res, 200, { ok: true, bird: birdRow(db.prepare('SELECT * FROM birds WHERE id = ?').get(id)) });
    });
  }

  if (req.method === 'POST' && route === 'endorse') {
    return readBody(req).then(b => {
      const birdId = String(b.bird_id || '');
      const by = String(b.by_bird || '').trim().slice(0, 40);
      if (!db.prepare('SELECT id FROM birds WHERE id = ?').get(birdId)) return json(res, 404, { error: 'no such bird' });
      if (!by) return json(res, 400, { error: 'who is endorsing?' });
      const id = rid();
      db.prepare('INSERT INTO endorsements (id,bird_id,by_bird,note,created) VALUES (?,?,?,?,?)')
        .run(id, birdId, by, String(b.note || '').slice(0, 200), now());
      return json(res, 200, { ok: true, endorsement: { id, bird_id: birdId, by_bird: by, note: String(b.note || '').slice(0, 200) } });
    });
  }

  return json(res, 404, { error: 'not found' });
};
