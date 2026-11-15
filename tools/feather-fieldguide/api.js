// Feather Field Guide API: a real bird field guide over 11,011 species (SQLite),
// plus a shared flock sighting log keyed to species ids.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'fieldguide.db'));
db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS sightings (
  id TEXT PRIMARY KEY,
  species TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  bird TEXT NOT NULL DEFAULT 'gurt',
  place TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 1,
  seen TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL
);`);
db.exec(`CREATE INDEX IF NOT EXISTS sig_species ON sightings(species);`);
try { db.exec(`ALTER TABLE sightings ADD COLUMN name TEXT NOT NULL DEFAULT ''`); } catch (e) {}

const stmt = {
  list: db.prepare('SELECT * FROM species ORDER BY en LIMIT ? OFFSET ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM species'),
  get: db.prepare('SELECT * FROM species WHERE id = ?'),
  search: db.prepare(`SELECT * FROM species
     WHERE (en LIKE ? OR sci LIKE ? OR family LIKE ? OR genus LIKE ?)
     ORDER BY en LIMIT ? OFFSET ?`),
  searchCount: db.prepare(`SELECT COUNT(*) AS n FROM species
     WHERE (en LIKE ? OR sci LIKE ? OR family LIKE ? OR genus LIKE ?)`),
  habitats: db.prepare("SELECT habitat, COUNT(*) AS n FROM species WHERE habitat != '' GROUP BY habitat ORDER BY n DESC"),
  families: db.prepare("SELECT family, COUNT(*) AS n FROM species WHERE family != '' GROUP BY family ORDER BY n DESC LIMIT 200"),
  filter: db.prepare(`SELECT * FROM species
     WHERE (? = '' OR habitat = ?) AND (? = '' OR family = ?) AND (? = '' OR iucn = ?)
     ORDER BY en LIMIT ? OFFSET ?`),
  filterCount: db.prepare(`SELECT COUNT(*) AS n FROM species
     WHERE (? = '' OR habitat = ?) AND (? = '' OR family = ?) AND (? = '' OR iucn = ?)`),
  sigList: db.prepare('SELECT * FROM sightings ORDER BY seen DESC, created DESC LIMIT 300'),
  sigFor: db.prepare('SELECT * FROM sightings WHERE species = ? ORDER BY seen DESC, created DESC LIMIT 100'),
  sigInsert: db.prepare('INSERT INTO sightings (id,species,name,bird,place,count,seen,note,created) VALUES (@id,@species,@name,@bird,@place,@count,@seen,@note,@created)'),
  sigGet: db.prepare('SELECT * FROM sightings WHERE id = ?'),
  sigRemove: db.prepare('DELETE FROM sightings WHERE id = ?'),
  sigStats: db.prepare(`SELECT COUNT(*) AS sightings, COALESCE(SUM(count),0) AS birds, COUNT(DISTINCT species) AS species FROM sightings`)
};

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

function readBody(req, cb) {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 100000) req.destroy(); });
  req.on('end', () => { try { cb(JSON.parse(raw || '{}')); } catch (e) { cb({}); } });
}

function ntfyPost(payload) {
  const hosts = ['https://ntfy.nerdvpn.de', 'https://ntfy.sh'];
  const topic = 'gurt-feather-fieldguide';
  const body = JSON.stringify(payload);
  let i = 0;
  const next = () => {
    if (i >= hosts.length) return;
    const host = hosts[i++];
    try {
      const u = new URL(host + '/' + topic);
      const req = require('https').request(u, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, res => res.resume());
      req.on('error', next);
      req.end(body);
    } catch (e) { next(); }
  };
  next();
}

function slim(s) {
  return {
    id: s.id, en: s.en, sci: s.sci, family: s.family, order: s.order_, genus: s.genus,
    habitat: s.habitat, trophic: s.trophic, niche: s.niche, lifestyle: s.lifestyle,
    migration: s.migration, mass: s.mass, wing: s.wing, tail: s.tail, tarsus: s.tarsus,
    beak: s.beak, range: s.range, iucn: s.iucn, ebird: s.ebird
  };
}

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'stats') {
    return json(res, 200, {
      species: stmt.count.get().n,
      habitats: stmt.habitats.all(),
      families: stmt.families.all(),
      sightings: stmt.sigStats.get()
    });
  }

  // species detail: /species/<id>
  if (req.method === 'GET' && route === 'species' && seg[1]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such species' });
    return json(res, 200, { species: slim(row), sightings: stmt.sigFor.all(seg[1]) });
  }

  // species list / search / filter: /species?q=&habitat=&family=&iucn=&limit=&offset=
  if (req.method === 'GET' && route === 'species') {
    const u = new URL(req.url, 'http://x');
    const q = (u.searchParams.get('q') || '').trim();
    const habitat = (u.searchParams.get('habitat') || '').trim();
    const family = (u.searchParams.get('family') || '').trim();
    const iucn = (u.searchParams.get('iucn') || '').trim();
    const limit = Math.min(200, Math.max(1, parseInt(u.searchParams.get('limit'), 10) || 50));
    const offset = Math.max(0, parseInt(u.searchParams.get('offset'), 10) || 0);
    let rows, total;
    if (q) {
      const like = '%' + q + '%';
      rows = stmt.search.all(like, like, like, like, limit, offset);
      total = stmt.searchCount.get(like, like, like, like).n;
    } else if (habitat || family || iucn) {
      rows = stmt.filter.all(habitat, habitat, family, family, iucn, iucn, limit, offset);
      total = stmt.filterCount.get(habitat, habitat, family, family, iucn, iucn).n;
    } else {
      rows = stmt.list.all(limit, offset);
      total = stmt.count.get().n;
    }
    return json(res, 200, { species: rows.map(slim), total, limit, offset });
  }

  if (req.method === 'GET' && route === 'sightings') {
    return json(res, 200, { sightings: stmt.sigList.all(), stats: stmt.sigStats.get() });
  }

  if (req.method === 'POST' && route === 'sightings' && seg[1] === 'new') {
    readBody(req, body => {
      const species = String(body.species || '').trim().slice(0, 120);
      if (!species) return json(res, 400, { error: 'species required' });
      const s = {
        id: 'sig' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        species,
        name: String(body.name || body.species || '').trim().slice(0, 120),
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        place: String(body.place || '').trim().slice(0, 120),
        count: Math.min(10000, Math.max(1, parseInt(body.count, 10) || 1)),
        seen: /^\d{4}-\d{2}-\d{2}$/.test(String(body.seen || '')) ? String(body.seen) : new Date().toISOString().slice(0, 10),
        note: String(body.note || '').trim().slice(0, 400),
        created: new Date().toISOString()
      };
      stmt.sigInsert.run(s);
      const saved = stmt.sigGet.get(s.id);
      ntfyPost({ type: 'sighting', sighting: saved });
      return json(res, 200, { ok: true, sighting: saved });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'sighting' && seg[2] === 'delete' && seg[1]) {
    if (!stmt.sigGet.get(seg[1])) return json(res, 404, { error: 'no such sighting' });
    stmt.sigRemove.run(seg[1]);
    ntfyPost({ type: 'delete', id: seg[1] });
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
