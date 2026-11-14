// Feather Shelf API: shared bookmarks with tags, stored in a real SQLite database
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'shelf.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    bird TEXT NOT NULL DEFAULT 'gurt',
    tags TEXT NOT NULL DEFAULT '',
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS links_created ON links(created DESC);
`);

const stmt = {
  list: db.prepare('SELECT * FROM links ORDER BY created DESC LIMIT 300'),
  search: db.prepare('SELECT * FROM links WHERE title LIKE ? OR url LIKE ? OR note LIKE ? OR tags LIKE ? ORDER BY created DESC LIMIT 300'),
  get: db.prepare('SELECT * FROM links WHERE id = ?'),
  insert: db.prepare('INSERT INTO links (id,title,url,note,bird,tags,created) VALUES (@id,@title,@url,@note,@bird,@tags,@created)'),
  remove: db.prepare('DELETE FROM links WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM links')
};

function publicLink(r) {
  if (!r) return null;
  return {
    id: r.id, title: r.title, url: r.url, note: r.note, bird: r.bird,
    tags: (r.tags || '').split(',').map(s => s.trim()).filter(Boolean),
    created: r.created
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

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'links') {
    const q = String(seg[1] || '').trim();
    const rows = q ? stmt.search.all('%' + q + '%', '%' + q + '%', '%' + q + '%', '%' + q + '%') : stmt.list.all();
    const all = stmt.list.all();
    const tagSet = {};
    all.forEach(r => (r.tags || '').split(',').forEach(t => { t = t.trim(); if (t) tagSet[t] = (tagSet[t] || 0) + 1; }));
    return json(res, 200, {
      links: rows.map(publicLink),
      total: stmt.count.get().n,
      tags: Object.keys(tagSet).sort().map(t => ({ tag: t, count: tagSet[t] }))
    });
  }

  if (req.method === 'POST' && route === 'links' && seg[1] === 'new') {
    readBody(req, body => {
      const title = String(body.title || '').trim().slice(0, 120);
      let url = String(body.url || '').trim().slice(0, 2000);
      if (!title) return json(res, 400, { error: 'title required' });
      if (!url) return json(res, 400, { error: 'url required' });
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      const link = {
        id: 'lnk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title,
        url,
        note: String(body.note || '').slice(0, 500),
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        tags: String(body.tags || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).slice(0, 8).join(','),
        created: new Date().toISOString()
      };
      stmt.insert.run(link);
      return json(res, 200, { ok: true, link: publicLink(link) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'links' && seg[2] === 'delete') {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such link' });
    stmt.remove.run(seg[1]);
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
