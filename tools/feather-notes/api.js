// Feather Notes API: shared bird notes, stored in a real SQLite database
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'notes.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    bird TEXT NOT NULL DEFAULT 'gurt',
    color TEXT NOT NULL DEFAULT 'blue',
    pinned INTEGER NOT NULL DEFAULT 0,
    created TEXT NOT NULL,
    updated TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS notes_updated ON notes(updated DESC);
`);

const stmt = {
  list: db.prepare('SELECT * FROM notes ORDER BY pinned DESC, updated DESC LIMIT 300'),
  search: db.prepare('SELECT * FROM notes WHERE title LIKE ? OR body LIKE ? ORDER BY pinned DESC, updated DESC LIMIT 300'),
  get: db.prepare('SELECT * FROM notes WHERE id = ?'),
  insert: db.prepare('INSERT INTO notes (id,title,body,bird,color,pinned,created,updated) VALUES (@id,@title,@body,@bird,@color,@pinned,@created,@updated)'),
  update: db.prepare('UPDATE notes SET title=@title, body=@body, color=@color, pinned=@pinned, updated=@updated WHERE id=@id'),
  remove: db.prepare('DELETE FROM notes WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM notes')
};

function publicNote(r) {
  if (!r) return null;
  return {
    id: r.id, title: r.title, body: r.body, bird: r.bird, color: r.color,
    pinned: !!r.pinned, created: r.created, updated: r.updated
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

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'notes') {
    const q = (seg[1] === 'search' ? decodeURIComponent(seg[2] || '') : '').trim();
    const rows = q ? stmt.search.all('%' + q + '%', '%' + q + '%') : stmt.list.all();
    return json(res, 200, { notes: rows.map(publicNote), total: stmt.count.get().n });
  }

  if (req.method === 'GET' && route === 'note' && seg[1]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such note' });
    return json(res, 200, { note: publicNote(row) });
  }

  if (req.method === 'POST' && route === 'notes' && seg[1] === 'new') {
    readBody(req, body => {
      const title = String(body.title || '').trim().slice(0, 120);
      if (!title) return json(res, 400, { error: 'title required' });
      const note = {
        id: 'not' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title,
        body: String(body.body || '').slice(0, 20000),
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        color: String(body.color || 'blue').slice(0, 12),
        pinned: body.pinned ? 1 : 0,
        created: now(), updated: now()
      };
      stmt.insert.run(note);
      return json(res, 200, { ok: true, note: publicNote(note) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'notes' && seg[2] === 'update') {
    readBody(req, body => {
      const row = stmt.get.get(seg[1]);
      if (!row) return json(res, 404, { error: 'no such note' });
      const note = {
        id: row.id,
        title: String(body.title !== undefined ? body.title : row.title).trim().slice(0, 120) || row.title,
        body: String(body.body !== undefined ? body.body : row.body).slice(0, 20000),
        color: String(body.color !== undefined ? body.color : row.color).slice(0, 12),
        pinned: body.pinned !== undefined ? (body.pinned ? 1 : 0) : row.pinned,
        updated: now()
      };
      stmt.update.run(note);
      return json(res, 200, { ok: true, note: publicNote(stmt.get.get(row.id)) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'notes' && seg[2] === 'delete') {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such note' });
    stmt.remove.run(seg[1]);
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
