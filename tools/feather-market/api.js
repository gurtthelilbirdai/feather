// Feather Market API: shared shopping list for small birds, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'market.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    qty TEXT NOT NULL DEFAULT '1',
    note TEXT NOT NULL DEFAULT '',
    bird TEXT NOT NULL DEFAULT 'gurt',
    claimed INTEGER NOT NULL DEFAULT 0,
    claimed_by TEXT NOT NULL DEFAULT '',
    created TEXT NOT NULL
  );
`);

const stmt = {
  list: db.prepare('SELECT * FROM items ORDER BY claimed ASC, created DESC LIMIT 300'),
  get: db.prepare('SELECT * FROM items WHERE id = ?'),
  insert: db.prepare('INSERT INTO items (id,title,qty,note,bird,claimed,claimed_by,created) VALUES (@id,@title,@qty,@note,@bird,@claimed,@claimed_by,@created)'),
  claim: db.prepare('UPDATE items SET claimed=@claimed, claimed_by=@claimed_by WHERE id=@id'),
  remove: db.prepare('DELETE FROM items WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM items')
};

function publicItem(r) {
  if (!r) return null;
  return {
    id: r.id, title: r.title, qty: r.qty, note: r.note, bird: r.bird,
    claimed: !!r.claimed, claimedBy: r.claimed_by, created: r.created
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

  if (req.method === 'GET' && route === 'items') {
    const rows = stmt.list.all();
    return json(res, 200, {
      items: rows.map(publicItem),
      total: stmt.count.get().n,
      wanted: rows.filter(r => !r.claimed).length
    });
  }

  if (req.method === 'POST' && route === 'items' && seg[1] === 'new') {
    readBody(req, body => {
      const title = String(body.title || '').trim().slice(0, 120);
      if (!title) return json(res, 400, { error: 'title required' });
      const item = {
        id: 'itm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title,
        qty: String(body.qty || '1').trim().slice(0, 40) || '1',
        note: String(body.note || '').slice(0, 500),
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        claimed: 0, claimed_by: '', created: new Date().toISOString()
      };
      stmt.insert.run(item);
      return json(res, 200, { ok: true, item: publicItem(item) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'items' && seg[2] === 'claim') {
    readBody(req, body => {
      const row = stmt.get.get(seg[1]);
      if (!row) return json(res, 404, { error: 'no such item' });
      const claimed = body.claimed === false ? 0 : 1;
      const who = claimed ? String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt' : '';
      stmt.claim.run({ claimed, claimed_by: who, id: row.id });
      return json(res, 200, { ok: true, item: publicItem(stmt.get.get(row.id)) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'items' && seg[2] === 'delete') {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such item' });
    stmt.remove.run(seg[1]);
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
