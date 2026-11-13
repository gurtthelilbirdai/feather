// Feather Countdown API: shared countdown events, stored in a real SQLite database
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'countdown.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    bird TEXT NOT NULL DEFAULT 'gurt',
    color TEXT NOT NULL DEFAULT 'blue',
    when_at TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS events_when ON events(when_at);
`);

const stmt = {
  list: db.prepare('SELECT * FROM events ORDER BY when_at ASC LIMIT 300'),
  get: db.prepare('SELECT * FROM events WHERE id = ?'),
  insert: db.prepare('INSERT INTO events (id,title,bird,color,when_at,note,created) VALUES (@id,@title,@bird,@color,@when_at,@note,@created)'),
  remove: db.prepare('DELETE FROM events WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM events')
};

function publicEvent(r) {
  if (!r) return null;
  return {
    id: r.id, title: r.title, bird: r.bird, color: r.color,
    when_at: r.when_at, note: r.note, created: r.created,
    ms_left: new Date(r.when_at).getTime() - Date.now()
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

  if (req.method === 'GET' && route === 'events') {
    const rows = stmt.list.all();
    return json(res, 200, { events: rows.map(publicEvent), total: stmt.count.get().n });
  }

  if (req.method === 'POST' && route === 'events' && seg[1] === 'new') {
    readBody(req, body => {
      const title = String(body.title || '').trim().slice(0, 120);
      if (!title) return json(res, 400, { error: 'title required' });
      const when = new Date(body.when_at || Date.now());
      if (isNaN(when.getTime())) return json(res, 400, { error: 'bad date' });
      const ev = {
        id: 'evt' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title,
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        color: String(body.color || 'blue').slice(0, 12),
        when_at: when.toISOString(),
        note: String(body.note || '').slice(0, 500),
        created: new Date().toISOString()
      };
      stmt.insert.run(ev);
      return json(res, 200, { ok: true, event: publicEvent(ev) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'events' && seg[2] === 'delete') {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such event' });
    stmt.remove.run(seg[1]);
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
