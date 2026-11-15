// Feather Garden API: a shared garden the flock tends.
// SQLite storage for plots, plantings and waterings.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'garden.db'));
db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS plots (
  id TEXT PRIMARY KEY,
  bird TEXT NOT NULL,
  name TEXT NOT NULL,
  sun TEXT DEFAULT 'half',
  soil TEXT DEFAULT 'loam',
  note TEXT DEFAULT '',
  created TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS plantings (
  id TEXT PRIMARY KEY,
  plot_id TEXT NOT NULL,
  crop TEXT NOT NULL,
  planted TEXT DEFAULT '',
  watered INTEGER DEFAULT 0,
  harvested INTEGER DEFAULT 0,
  harvest_note TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS planting_plot ON plantings(plot_id);`);

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

// A planting grows one stage per watering, up to ripe.
function stageOf(p) {
  if (p.harvested) return 'harvested';
  const w = p.watered || 0;
  if (w <= 0) return 'seed';
  if (w === 1) return 'sprout';
  if (w === 2) return 'leafy';
  if (w === 3) return 'budding';
  return 'ripe';
}

function plantingRow(p) {
  return {
    id: p.id, plot_id: p.plot_id, crop: p.crop, planted: p.planted,
    watered: p.watered || 0, harvested: p.harvested || 0,
    harvest_note: p.harvest_note, stage: stageOf(p)
  };
}

function plotRow(r) {
  const plants = db.prepare('SELECT * FROM plantings WHERE plot_id = ? ORDER BY planted DESC').all(r.id);
  const rows = plants.map(plantingRow);
  return {
    id: r.id, bird: r.bird, name: r.name, sun: r.sun, soil: r.soil,
    note: r.note, created: r.created,
    plantings: rows,
    growing: rows.filter(p => !p.harvested).length,
    ripe: rows.filter(p => p.stage === 'ripe').length,
    harvested: rows.filter(p => p.harvested).length
  };
}

module.exports = function handler(req, res, route) {
  route = Array.isArray(route) ? route.join('/') : String(route || '');
  const seg = route.split('/').filter(Boolean);

  if (req.method === 'GET' && (route === '' || route === 'plots')) {
    const u = new URL(req.url, 'http://x');
    const q = (u.searchParams.get('q') || '').trim().toLowerCase();
    let rows = db.prepare('SELECT * FROM plots ORDER BY created DESC').all();
    if (q) rows = rows.filter(r =>
      [r.bird, r.name, r.sun, r.soil, r.note].join(' ').toLowerCase().includes(q));
    return json(res, 200, { count: rows.length, plots: rows.map(plotRow) });
  }

  if (req.method === 'GET' && seg[0] === 'plot' && seg[1]) {
    const r = db.prepare('SELECT * FROM plots WHERE id = ?').get(seg[1]);
    if (!r) return json(res, 404, { error: 'no such plot' });
    return json(res, 200, { plot: plotRow(r) });
  }

  if (req.method === 'GET' && route === 'stats') {
    const plots = db.prepare('SELECT COUNT(*) AS n FROM plots').get().n;
    const plants = db.prepare('SELECT COUNT(*) AS n FROM plantings').get().n;
    const ripe = db.prepare('SELECT COUNT(*) AS n FROM plantings WHERE watered >= 4 AND harvested = 0').get().n;
    const harvests = db.prepare('SELECT COUNT(*) AS n FROM plantings WHERE harvested = 1').get().n;
    const crops = db.prepare('SELECT crop, COUNT(*) AS n FROM plantings GROUP BY crop ORDER BY n DESC').all();
    return json(res, 200, { plots, plants, ripe, harvests, crops });
  }

  if (req.method === 'POST' && route === 'plot') {
    return readBody(req).then(b => {
      const bird = String(b.bird || '').trim().slice(0, 40);
      const name = String(b.name || '').trim().slice(0, 60);
      if (!bird || !name) return json(res, 400, { error: 'a plot needs a bird and a name' });
      const id = rid();
      db.prepare(`INSERT INTO plots (id,bird,name,sun,soil,note,created) VALUES (?,?,?,?,?,?,?)`).run(
        id, bird, name,
        String(b.sun || 'half').slice(0, 20),
        String(b.soil || 'loam').slice(0, 20),
        String(b.note || '').slice(0, 300),
        now());
      return json(res, 200, { ok: true, plot: plotRow(db.prepare('SELECT * FROM plots WHERE id = ?').get(id)) });
    });
  }

  if (req.method === 'POST' && route === 'plant') {
    return readBody(req).then(b => {
      const plotId = String(b.plot_id || '');
      const crop = String(b.crop || '').trim().slice(0, 40);
      if (!db.prepare('SELECT id FROM plots WHERE id = ?').get(plotId)) return json(res, 404, { error: 'no such plot' });
      if (!crop) return json(res, 400, { error: 'what are you planting?' });
      const id = rid();
      db.prepare('INSERT INTO plantings (id,plot_id,crop,planted,watered,harvested) VALUES (?,?,?,?,0,0)')
        .run(id, plotId, crop, now());
      return json(res, 200, { ok: true, planting: plantingRow(db.prepare('SELECT * FROM plantings WHERE id = ?').get(id)) });
    });
  }

  if (req.method === 'POST' && route === 'water') {
    return readBody(req).then(b => {
      const id = String(b.id || '');
      const p = db.prepare('SELECT * FROM plantings WHERE id = ?').get(id);
      if (!p) return json(res, 404, { error: 'no such planting' });
      if (p.harvested) return json(res, 400, { error: 'already harvested' });
      db.prepare('UPDATE plantings SET watered = watered + 1 WHERE id = ?').run(id);
      return json(res, 200, { ok: true, planting: plantingRow(db.prepare('SELECT * FROM plantings WHERE id = ?').get(id)) });
    });
  }

  if (req.method === 'POST' && route === 'harvest') {
    return readBody(req).then(b => {
      const id = String(b.id || '');
      const p = db.prepare('SELECT * FROM plantings WHERE id = ?').get(id);
      if (!p) return json(res, 404, { error: 'no such planting' });
      if (p.harvested) return json(res, 400, { error: 'already harvested' });
      if ((p.watered || 0) < 4) return json(res, 400, { error: 'not ripe yet — water it more' });
      const note = String(b.note || '').slice(0, 240);
      db.prepare('UPDATE plantings SET harvested = 1, harvest_note = ? WHERE id = ?').run(note, id);
      return json(res, 200, { ok: true, planting: plantingRow(db.prepare('SELECT * FROM plantings WHERE id = ?').get(id)) });
    });
  }

  return json(res, 404, { error: 'not found' });
};
