// Feather Budget API: shared budget tracker, stored in a real SQLite database
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'budget.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS budgets (
    bird TEXT PRIMARY KEY,
    amount REAL NOT NULL DEFAULT 0,
    month TEXT NOT NULL,
    updated TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    bird TEXT NOT NULL,
    kind TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    day TEXT NOT NULL,
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS entries_day ON entries(day DESC);
`);

const stmt = {
  listBudgets: db.prepare('SELECT * FROM budgets ORDER BY bird'),
  getBudget: db.prepare('SELECT * FROM budgets WHERE bird = ?'),
  upsertBudget: db.prepare(`INSERT INTO budgets (bird,amount,month,updated) VALUES (@bird,@amount,@month,@updated)
    ON CONFLICT(bird) DO UPDATE SET amount=@amount, month=@month, updated=@updated`),
  listEntries: db.prepare('SELECT * FROM entries ORDER BY day DESC, created DESC LIMIT 400'),
  entriesByBird: db.prepare('SELECT * FROM entries WHERE bird = ? ORDER BY day DESC, created DESC LIMIT 400'),
  insert: db.prepare('INSERT INTO entries (id,bird,kind,category,amount,note,day,created) VALUES (@id,@bird,@kind,@category,@amount,@note,@day,@created)'),
  remove: db.prepare('DELETE FROM entries WHERE id = ?'),
  totals: db.prepare(`SELECT bird,
      SUM(CASE WHEN kind='income' THEN amount ELSE 0 END) AS income,
      SUM(CASE WHEN kind='expense' THEN amount ELSE 0 END) AS expense
    FROM entries GROUP BY bird`)
};

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
function today() { return now().slice(0, 10); }
function num(v) { const n = Number(v); return isFinite(n) ? n : 0; }

function summary(entries, budgets) {
  const byBird = {};
  entries.forEach(e => {
    const b = byBird[e.bird] || (byBird[e.bird] = { bird: e.bird, income: 0, expense: 0, net: 0 });
    if (e.kind === 'income') b.income += e.amount; else b.expense += e.amount;
  });
  budgets.forEach(u => {
    const b = byBird[u.bird] || (byBird[u.bird] = { bird: u.bird, income: 0, expense: 0, net: 0 });
    b.budget = u.amount; b.month = u.month;
  });
  Object.values(byBird).forEach(b => {
    b.net = b.income - b.expense;
    b.remaining = (b.budget || 0) - b.expense;
  });
  return Object.values(byBird).sort((a, b) => b.net - a.net);
}

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'entries') {
    const bird = seg[1] === 'bird' ? decodeURIComponent(seg[2] || '') : '';
    const entries = bird ? stmt.entriesByBird.all(bird) : stmt.listEntries.all();
    return json(res, 200, { entries, total: entries.length });
  }

  if (req.method === 'GET' && route === 'summary') {
    const entries = stmt.listEntries.all();
    const budgets = stmt.listBudgets.all();
    const cats = {};
    entries.filter(e => e.kind === 'expense').forEach(e => {
      cats[e.category] = (cats[e.category] || 0) + e.amount;
    });
    return json(res, 200, { birds: summary(entries, budgets), categories: cats, month: today().slice(0, 7) });
  }

  if (req.method === 'GET' && route === 'budgets') {
    return json(res, 200, { budgets: stmt.listBudgets.all() });
  }

  if (req.method === 'POST' && route === 'budget' && seg[1] === 'set') {
    readBody(req, body => {
      const bird = String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt';
      const amount = Math.max(0, num(body.amount));
      const month = String(body.month || today().slice(0, 7)).slice(0, 7);
      const row = { bird, amount, month, updated: now() };
      stmt.upsertBudget.run(row);
      return json(res, 200, { ok: true, budget: row });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'entries' && seg[1] === 'new') {
    readBody(req, body => {
      const kind = body.kind === 'income' ? 'income' : 'expense';
      const amount = Math.abs(num(body.amount));
      if (!amount) return json(res, 400, { error: 'amount required' });
      const entry = {
        id: 'bud' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        kind,
        category: String(body.category || 'other').trim().slice(0, 40) || 'other',
        amount,
        note: String(body.note || '').slice(0, 300),
        day: String(body.day || today()).slice(0, 10),
        created: now()
      };
      stmt.insert.run(entry);
      return json(res, 200, { ok: true, entry });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'entries' && seg[2] === 'delete') {
    stmt.remove.run(seg[1]);
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
