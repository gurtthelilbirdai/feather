// Feather Markdown API: shared markdown documents, stored in a real SQLite database
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'markdown.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS docs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    bird TEXT NOT NULL DEFAULT 'gurt',
    created TEXT NOT NULL,
    updated TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS docs_updated ON docs(updated DESC);
`);

const stmt = {
  list: db.prepare('SELECT * FROM docs ORDER BY updated DESC LIMIT 300'),
  search: db.prepare('SELECT * FROM docs WHERE title LIKE ? OR body LIKE ? ORDER BY updated DESC LIMIT 300'),
  get: db.prepare('SELECT * FROM docs WHERE id = ?'),
  insert: db.prepare('INSERT INTO docs (id,title,body,bird,created,updated) VALUES (@id,@title,@body,@bird,@created,@updated)'),
  update: db.prepare('UPDATE docs SET title=@title, body=@body, updated=@updated WHERE id=@id'),
  remove: db.prepare('DELETE FROM docs WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM docs')
};

function publicDoc(r) {
  if (!r) return null;
  return { id: r.id, title: r.title, body: r.body, bird: r.bird, created: r.created, updated: r.updated };
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 300000) req.destroy(); });
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch (e) { body = {}; }
    cb(body);
  });
}
function now() { return new Date().toISOString(); }

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'docs') {
    const q = (seg[1] === 'search' ? decodeURIComponent(seg[2] || '') : '').trim();
    const rows = q ? stmt.search.all('%' + q + '%', '%' + q + '%') : stmt.list.all();
    return json(res, 200, { docs: rows.map(publicDoc), total: stmt.count.get().n });
  }

  if (req.method === 'GET' && route === 'doc' && seg[1]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such doc' });
    return json(res, 200, { doc: publicDoc(row) });
  }

  if (req.method === 'POST' && route === 'docs' && seg[1] === 'new') {
    readBody(req, body => {
      const title = String(body.title || '').trim().slice(0, 120);
      if (!title) return json(res, 400, { error: 'title required' });
      const doc = {
        id: 'doc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title,
        body: String(body.body || '').slice(0, 100000),
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        created: now(), updated: now()
      };
      stmt.insert.run(doc);
      return json(res, 200, { ok: true, doc: publicDoc(doc) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'docs' && seg[2] === 'update') {
    readBody(req, body => {
      const row = stmt.get.get(seg[1]);
      if (!row) return json(res, 404, { error: 'no such doc' });
      const doc = {
        id: row.id,
        title: String(body.title !== undefined ? body.title : row.title).trim().slice(0, 120) || row.title,
        body: String(body.body !== undefined ? body.body : row.body).slice(0, 100000),
        updated: now()
      };
      stmt.update.run(doc);
      return json(res, 200, { ok: true, doc: publicDoc(stmt.get.get(row.id)) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'docs' && seg[2] === 'delete') {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such doc' });
    stmt.remove.run(seg[1]);
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
