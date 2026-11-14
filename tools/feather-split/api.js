// Feather Split API: shared expense splitting for small birds, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'split.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    payer TEXT NOT NULL,
    amount REAL NOT NULL,
    participants TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    bird TEXT NOT NULL DEFAULT 'gurt',
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS expenses_created ON expenses(created DESC);
`);

const stmt = {
  list: db.prepare('SELECT * FROM expenses ORDER BY created DESC LIMIT 300'),
  get: db.prepare('SELECT * FROM expenses WHERE id = ?'),
  insert: db.prepare('INSERT INTO expenses (id,title,payer,amount,participants,note,bird,created) VALUES (@id,@title,@payer,@amount,@participants,@note,@bird,@created)'),
  remove: db.prepare('DELETE FROM expenses WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM expenses')
};

function publicExpense(r) {
  if (!r) return null;
  return {
    id: r.id, title: r.title, payer: r.payer, amount: r.amount,
    participants: String(r.participants || '').split('|').filter(Boolean),
    note: r.note, bird: r.bird, created: r.created
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

// net balance per bird: positive = is owed money, negative = owes money
function balances(rows) {
  const bal = {};
  function add(name, v) { name = String(name || '').trim(); if (!name) return; bal[name] = (bal[name] || 0) + v; }
  rows.forEach(function (r) {
    const parts = String(r.participants || '').split('|').map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const amt = Number(r.amount) || 0;
    const share = amt / parts.length;
    add(r.payer, amt);
    parts.forEach(function (p) { add(p, -share); });
  });
  return Object.keys(bal).map(function (name) {
    return { bird: name, net: Math.round(bal[name] * 100) / 100 };
  }).sort(function (a, b) { return b.net - a.net; });
}

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'expenses') {
    const rows = stmt.list.all();
    return json(res, 200, {
      expenses: rows.map(publicExpense),
      balances: balances(rows),
      total: stmt.count.get().n
    });
  }

  if (req.method === 'GET' && route === 'balances') {
    const rows = stmt.list.all();
    return json(res, 200, { balances: balances(rows) });
  }

  if (req.method === 'POST' && route === 'expenses' && seg[1] === 'new') {
    readBody(req, body => {
      const title = String(body.title || '').trim().slice(0, 120);
      if (!title) return json(res, 400, { error: 'title required' });
      const amount = Math.round((Number(body.amount) || 0) * 100) / 100;
      if (!(amount > 0)) return json(res, 400, { error: 'amount must be positive' });
      const payer = String(body.payer || '').trim().slice(0, 40);
      if (!payer) return json(res, 400, { error: 'payer required' });
      let parts = Array.isArray(body.participants) ? body.participants : String(body.participants || '').split(',');
      parts = parts.map(s => String(s).trim().slice(0, 40)).filter(Boolean);
      if (!parts.length) parts = [payer];
      if (parts.indexOf(payer) < 0) parts.push(payer);
      const e = {
        id: 'exp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title,
        payer,
        amount,
        participants: parts.join('|'),
        note: String(body.note || '').trim().slice(0, 300),
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        created: now()
      };
      stmt.insert.run(e);
      const rows = stmt.list.all();
      return json(res, 200, { ok: true, expense: publicExpense(stmt.get.get(e.id)), balances: balances(rows) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'expense' && seg[2] === 'delete' && seg[1]) {
    if (!stmt.get.get(seg[1])) return json(res, 404, { error: 'no such expense' });
    stmt.remove.run(seg[1]);
    const rows = stmt.list.all();
    return json(res, 200, { ok: true, removed: seg[1], balances: balances(rows) });
  }

  return false;
};
