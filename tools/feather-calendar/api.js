// Feather Calendar API: shared calendar events, stored in a real SQLite database
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'calendar.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    bird TEXT NOT NULL DEFAULT 'gurt',
    color TEXT NOT NULL DEFAULT 'blue',
    day TEXT NOT NULL,
    start_time TEXT NOT NULL DEFAULT '09:00',
    end_time TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS events_day ON events(day);
`);

const stmt = {
  list: db.prepare('SELECT * FROM events ORDER BY day ASC, start_time ASC LIMIT 500'),
  byDay: db.prepare('SELECT * FROM events WHERE day = ? ORDER BY start_time ASC'),
  get: db.prepare('SELECT * FROM events WHERE id = ?'),
  insert: db.prepare('INSERT INTO events (id,title,bird,color,day,start_time,end_time,note,created) VALUES (@id,@title,@bird,@color,@day,@start_time,@end_time,@note,@created)'),
  remove: db.prepare('DELETE FROM events WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM events')
};

function publicEvent(r) {
  if (!r) return null;
  return {
    id: r.id, title: r.title, bird: r.bird, color: r.color,
    day: r.day, start_time: r.start_time, end_time: r.end_time,
    note: r.note, created: r.created
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
    if (seg[1] === 'day' && seg[2]) {
      const rows = stmt.byDay.all(seg[2]);
      return json(res, 200, { day: seg[2], events: rows.map(publicEvent) });
    }
    const rows = stmt.list.all();
    return json(res, 200, { events: rows.map(publicEvent), total: stmt.count.get().n });
  }

  if (req.method === 'POST' && route === 'events' && seg[1] === 'new') {
    readBody(req, body => {
      const title = String(body.title || '').trim().slice(0, 120);
      if (!title) return json(res, 400, { error: 'title required' });
      const day = String(body.day || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return json(res, 400, { error: 'bad day (YYYY-MM-DD)' });
      const ev = {
        id: 'cal' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title,
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        color: String(body.color || 'blue').slice(0, 12),
        day,
        start_time: String(body.start_time || '09:00').slice(0, 5),
        end_time: String(body.end_time || '').slice(0, 5),
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
