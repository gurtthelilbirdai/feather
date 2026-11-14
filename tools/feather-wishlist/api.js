// Feather Wishlist API: shared wishlist for small birds, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'wishlist.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS wishes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    bird TEXT NOT NULL DEFAULT 'gurt',
    reason TEXT NOT NULL DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 2,
    votes INTEGER NOT NULL DEFAULT 0,
    claimed_by TEXT NOT NULL DEFAULT '',
    done INTEGER NOT NULL DEFAULT 0,
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS wishes_created ON wishes(created DESC);
`);

const stmt = {
  list: db.prepare('SELECT * FROM wishes ORDER BY done ASC, votes DESC, created DESC LIMIT 300'),
  search: db.prepare('SELECT * FROM wishes WHERE title LIKE ? OR reason LIKE ? OR bird LIKE ? ORDER BY done ASC, votes DESC, created DESC LIMIT 300'),
  get: db.prepare('SELECT * FROM wishes WHERE id = ?'),
  insert: db.prepare('INSERT INTO wishes (id,title,bird,reason,priority,votes,claimed_by,done,created) VALUES (@id,@title,@bird,@reason,@priority,@votes,@claimed_by,@done,@created)'),
  vote: db.prepare('UPDATE wishes SET votes = votes + 1 WHERE id = ?'),
  claim: db.prepare('UPDATE wishes SET claimed_by = ? WHERE id = ?'),
  unclaim: db.prepare('UPDATE wishes SET claimed_by = \'\' WHERE id = ?'),
  done: db.prepare('UPDATE wishes SET done = ? WHERE id = ?'),
  remove: db.prepare('DELETE FROM wishes WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM wishes')
};

function publicWish(r) {
  if (!r) return null;
  return {
    id: r.id, title: r.title, bird: r.bird, reason: r.reason,
    priority: r.priority, votes: r.votes, claimed_by: r.claimed_by,
    done: !!r.done, created: r.created
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

  if (req.method === 'GET' && route === 'wishes') {
    const q = (seg[1] === 'search' ? decodeURIComponent(seg[2] || '') : '').trim();
    const rows = q ? stmt.search.all('%' + q + '%', '%' + q + '%', '%' + q + '%') : stmt.list.all();
    return json(res, 200, { wishes: rows.map(publicWish), total: stmt.count.get().n });
  }

  if (req.method === 'GET' && route === 'wish' && seg[1]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such wish' });
    return json(res, 200, { wish: publicWish(row) });
  }

  if (req.method === 'POST' && route === 'wishes' && seg[1] === 'new') {
    readBody(req, body => {
      const title = String(body.title || '').trim().slice(0, 120);
      if (!title) return json(res, 400, { error: 'title required' });
      let priority = parseInt(body.priority, 10);
      if (priority !== 1 && priority !== 2 && priority !== 3) priority = 2;
      const w = {
        id: 'wis' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title,
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        reason: String(body.reason || '').trim().slice(0, 300),
        priority,
        votes: 0,
        claimed_by: '',
        done: 0,
        created: now()
      };
      stmt.insert.run(w);
      return json(res, 200, { ok: true, wish: publicWish(stmt.get.get(w.id)) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'wish' && seg[2] === 'vote' && seg[1]) {
    if (!stmt.get.get(seg[1])) return json(res, 404, { error: 'no such wish' });
    stmt.vote.run(seg[1]);
    return json(res, 200, { ok: true, wish: publicWish(stmt.get.get(seg[1])) });
  }

  if (req.method === 'POST' && route === 'wish' && seg[2] === 'claim' && seg[1]) {
    if (!stmt.get.get(seg[1])) return json(res, 404, { error: 'no such wish' });
    readBody(req, body => {
      const who = String(body.bird || '').trim().slice(0, 40);
      if (!who) return json(res, 400, { error: 'bird required' });
      stmt.claim.run(who, seg[1]);
      return json(res, 200, { ok: true, wish: publicWish(stmt.get.get(seg[1])) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'wish' && seg[2] === 'unclaim' && seg[1]) {
    if (!stmt.get.get(seg[1])) return json(res, 404, { error: 'no such wish' });
    stmt.unclaim.run(seg[1]);
    return json(res, 200, { ok: true, wish: publicWish(stmt.get.get(seg[1])) });
  }

  if (req.method === 'POST' && route === 'wish' && seg[2] === 'done' && seg[1]) {
    if (!stmt.get.get(seg[1])) return json(res, 404, { error: 'no such wish' });
    readBody(req, body => {
      const val = body.done ? 1 : 0;
      stmt.done.run(val, seg[1]);
      return json(res, 200, { ok: true, wish: publicWish(stmt.get.get(seg[1])) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'wish' && seg[2] === 'delete' && seg[1]) {
    if (!stmt.get.get(seg[1])) return json(res, 404, { error: 'no such wish' });
    stmt.remove.run(seg[1]);
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
