// Feather Palette API: shared color palettes for small birds, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'palette.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS palettes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bird TEXT NOT NULL DEFAULT 'gurt',
    tags TEXT NOT NULL DEFAULT '',
    colors TEXT NOT NULL DEFAULT '[]',
    likes INTEGER NOT NULL DEFAULT 0,
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS palettes_created ON palettes(created DESC);
`);

const stmt = {
  list: db.prepare('SELECT * FROM palettes ORDER BY created DESC LIMIT 300'),
  search: db.prepare('SELECT * FROM palettes WHERE name LIKE ? OR tags LIKE ? OR colors LIKE ? ORDER BY created DESC LIMIT 300'),
  get: db.prepare('SELECT * FROM palettes WHERE id = ?'),
  insert: db.prepare('INSERT INTO palettes (id,name,bird,tags,colors,likes,created) VALUES (@id,@name,@bird,@tags,@colors,@likes,@created)'),
  remove: db.prepare('DELETE FROM palettes WHERE id = ?'),
  like: db.prepare('UPDATE palettes SET likes = likes + 1 WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM palettes')
};

function publicPalette(r) {
  if (!r) return null;
  let colors = [];
  try { colors = JSON.parse(r.colors); } catch (e) { colors = []; }
  if (!Array.isArray(colors)) colors = [];
  return {
    id: r.id, name: r.name, bird: r.bird, tags: r.tags,
    colors: colors.slice(0, 24), likes: r.likes, created: r.created
  };
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 100000) req.destroy(); });
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch (e) { body = {}; }
    cb(body);
  });
}
function now() { return new Date().toISOString(); }
function cleanHex(c) {
  c = String(c || '').trim().toLowerCase();
  if (!/^#?[0-9a-f]{6}$/.test(c)) return null;
  return c[0] === '#' ? c : '#' + c;
}

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'palettes') {
    const q = (seg[1] === 'search' ? decodeURIComponent(seg[2] || '') : '').trim();
    const rows = q ? stmt.search.all('%' + q + '%', '%' + q + '%', '%' + q + '%') : stmt.list.all();
    return json(res, 200, { palettes: rows.map(publicPalette), total: stmt.count.get().n });
  }

  if (req.method === 'GET' && route === 'palette' && seg[1]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such palette' });
    return json(res, 200, { palette: publicPalette(row) });
  }

  if (req.method === 'POST' && route === 'palettes' && seg[1] === 'new') {
    readBody(req, body => {
      const name = String(body.name || '').trim().slice(0, 80);
      if (!name) return json(res, 400, { error: 'name required' });
      const raw = Array.isArray(body.colors) ? body.colors : [];
      const colors = [];
      for (const c of raw) {
        const h = cleanHex(c);
        if (h && colors.indexOf(h) < 0) colors.push(h);
        if (colors.length >= 24) break;
      }
      if (!colors.length) return json(res, 400, { error: 'at least one valid hex color required' });
      const p = {
        id: 'pal' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name,
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        tags: String(body.tags || '').trim().slice(0, 120),
        colors: JSON.stringify(colors),
        likes: 0,
        created: now()
      };
      stmt.insert.run(p);
      return json(res, 200, { ok: true, palette: publicPalette(stmt.get.get(p.id)) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'palette' && seg[2] === 'like' && seg[1]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such palette' });
    stmt.like.run(seg[1]);
    return json(res, 200, { ok: true, palette: publicPalette(stmt.get.get(seg[1])) });
  }

  if (req.method === 'POST' && route === 'palette' && seg[2] === 'delete' && seg[1]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such palette' });
    stmt.remove.run(seg[1]);
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
