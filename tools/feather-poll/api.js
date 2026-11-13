// Feather Poll API: shared polls for small birds, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'poll.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS polls (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    bird TEXT NOT NULL DEFAULT 'gurt',
    created TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    bird TEXT NOT NULL DEFAULT 'gurt',
    created TEXT NOT NULL
  );
`);

const stmt = {
  list: db.prepare('SELECT * FROM polls ORDER BY created DESC LIMIT 200'),
  get: db.prepare('SELECT * FROM polls WHERE id = ?'),
  insert: db.prepare('INSERT INTO polls (id,question,options,bird,created) VALUES (@id,@question,@options,@bird,@created)'),
  remove: db.prepare('DELETE FROM polls WHERE id = ?'),
  votes: db.prepare('SELECT * FROM votes WHERE poll_id = ? ORDER BY created DESC'),
  addVote: db.prepare('INSERT INTO votes (id,poll_id,option_index,bird,created) VALUES (@id,@poll_id,@option_index,@bird,@created)'),
  clearVotes: db.prepare('DELETE FROM votes WHERE poll_id = ?'),
  countAll: db.prepare('SELECT COUNT(*) AS n FROM polls')
};

function publicPoll(p) {
  if (!p) return null;
  const options = JSON.parse(p.options);
  const votes = stmt.votes.all(p.id);
  const counts = options.map((_, i) => votes.filter(v => v.option_index === i).length);
  return {
    id: p.id,
    question: p.question,
    options,
    bird: p.bird,
    created: p.created,
    counts,
    total: votes.length,
    voters: votes.map(v => v.bird)
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

  if (req.method === 'GET' && route === 'polls') {
    const rows = stmt.list.all();
    return json(res, 200, { polls: rows.map(publicPoll), total: stmt.countAll.get().n });
  }

  if (req.method === 'GET' && route === 'poll' && seg[1]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such poll' });
    return json(res, 200, { poll: publicPoll(row) });
  }

  if (req.method === 'POST' && route === 'polls' && seg[1] === 'new') {
    readBody(req, body => {
      const question = String(body.question || '').trim().slice(0, 200);
      const options = (Array.isArray(body.options) ? body.options : String(body.options || '').split('\n'))
        .map(o => String(o).trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 8);
      if (!question) return json(res, 400, { error: 'question required' });
      if (options.length < 2) return json(res, 400, { error: 'need at least two options' });
      const poll = {
        id: 'pol' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        question,
        options: JSON.stringify(options),
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        created: new Date().toISOString()
      };
      stmt.insert.run(poll);
      return json(res, 200, { ok: true, poll: publicPoll(poll) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'poll' && seg[1] && seg[2] === 'vote') {
    readBody(req, body => {
      const row = stmt.get.get(seg[1]);
      if (!row) return json(res, 404, { error: 'no such poll' });
      const options = JSON.parse(row.options);
      const idx = Number(body.option_index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
        return json(res, 400, { error: 'bad option' });
      }
      const bird = String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt';
      const vote = {
        id: 'vot' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        poll_id: row.id,
        option_index: idx,
        bird,
        created: new Date().toISOString()
      };
      stmt.addVote.run(vote);
      return json(res, 200, { ok: true, vote, poll: publicPoll(stmt.get.get(row.id)) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'poll' && seg[1] && seg[2] === 'delete') {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such poll' });
    stmt.clearVotes.run(seg[1]);
    stmt.remove.run(seg[1]);
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
