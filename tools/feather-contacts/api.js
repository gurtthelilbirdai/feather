// Feather Contacts API: shared address book for small birds, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'contacts.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bird TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT 'blue',
    created TEXT NOT NULL,
    updated TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS contacts_name ON contacts(name COLLATE NOCASE);
`);

const stmt = {
  list: db.prepare('SELECT * FROM contacts ORDER BY name COLLATE NOCASE LIMIT 500'),
  search: db.prepare(`SELECT * FROM contacts WHERE name LIKE ? OR bird LIKE ? OR email LIKE ? OR phone LIKE ? OR note LIKE ? ORDER BY name COLLATE NOCASE LIMIT 500`),
  get: db.prepare('SELECT * FROM contacts WHERE id = ?'),
  insert: db.prepare('INSERT INTO contacts (id,name,bird,email,phone,note,color,created,updated) VALUES (@id,@name,@bird,@email,@phone,@note,@color,@created,@updated)'),
  update: db.prepare('UPDATE contacts SET name=@name,bird=@bird,email=@email,phone=@phone,note=@note,color=@color,updated=@updated WHERE id=@id'),
  remove: db.prepare('DELETE FROM contacts WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM contacts')
};

function publicContact(r) {
  if (!r) return null;
  return {
    id: r.id, name: r.name, bird: r.bird, email: r.email, phone: r.phone,
    note: r.note, color: r.color, created: r.created, updated: r.updated
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
function clean(v, max) { return String(v || '').trim().slice(0, max); }

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'contacts') {
    const q = (seg[1] === 'search' ? decodeURIComponent(seg[2] || '') : '').trim();
    const rows = q
      ? stmt.search.all('%' + q + '%', '%' + q + '%', '%' + q + '%', '%' + q + '%', '%' + q + '%')
      : stmt.list.all();
    return json(res, 200, { contacts: rows.map(publicContact), total: stmt.count.get().n });
  }

  if (req.method === 'GET' && route === 'contact' && seg[1]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such contact' });
    return json(res, 200, { contact: publicContact(row) });
  }

  if (req.method === 'POST' && route === 'contacts' && seg[1] === 'new') {
    readBody(req, body => {
      const name = clean(body.name, 80);
      if (!name) return json(res, 400, { error: 'name required' });
      const contact = {
        id: 'con' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name,
        bird: clean(body.bird, 40),
        email: clean(body.email, 160),
        phone: clean(body.phone, 60),
        note: clean(body.note, 2000),
        color: clean(body.color, 12) || 'blue',
        created: now(), updated: now()
      };
      stmt.insert.run(contact);
      return json(res, 200, { ok: true, contact: publicContact(contact) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'contacts' && seg[2] === 'update') {
    readBody(req, body => {
      const row = stmt.get.get(seg[1]);
      if (!row) return json(res, 404, { error: 'no such contact' });
      const contact = {
        id: row.id,
        name: body.name !== undefined ? (clean(body.name, 80) || row.name) : row.name,
        bird: body.bird !== undefined ? clean(body.bird, 40) : row.bird,
        email: body.email !== undefined ? clean(body.email, 160) : row.email,
        phone: body.phone !== undefined ? clean(body.phone, 60) : row.phone,
        note: body.note !== undefined ? clean(body.note, 2000) : row.note,
        color: body.color !== undefined ? (clean(body.color, 12) || row.color) : row.color,
        updated: now()
      };
      stmt.update.run(contact);
      return json(res, 200, { ok: true, contact: publicContact(stmt.get.get(row.id)) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'contacts' && seg[2] === 'delete') {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such contact' });
    stmt.remove.run(seg[1]);
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
