// Feather Timer API: focus sessions with a shared nest board
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, 'data');
const FILE = path.join(DATA, 'sessions.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return []; }
}
function save(list) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}
function readBody(req) {
  return new Promise(resolve => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 10000) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve(null); }
    });
  });
}

module.exports = async function handler(req, res, seg) {
  const seg0 = seg[0];
  if (req.method === 'GET' && seg0 === 'sessions') {
    const list = load().sort((a, b) => b.ms - a.ms).slice(0, 50);
    json(res, 200, { sessions: list });
    return true;
  }
  if (req.method === 'POST' && seg0 === 'sessions') {
    const body = await readBody(req);
    if (!body) { json(res, 400, { error: 'bad json' }); return true; }
    const name = String(body.name || 'bird').slice(0, 24).trim() || 'bird';
    const ms = Math.max(1000, Math.min(3600000, Number(body.ms) || 0));
    const task = String(body.task || '').slice(0, 80);
    if (!ms) { json(res, 400, { error: 'ms required' }); return true; }
    const list = load();
    const s = { id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, ms, task, at: new Date().toISOString() };
    list.push(s);
    save(list);
    const sorted = list.slice().sort((a, b) => b.ms - a.ms);
    const rank = sorted.findIndex(x => x.id === s.id) + 1;
    json(res, 200, { ok: true, rank, session: s });
    return true;
  }
  if (req.method === 'GET' && seg0 === 'stats') {
    const list = load();
    const byName = {};
    for (const s of list) {
      byName[s.name] = byName[s.name] || { name: s.name, totalMs: 0, count: 0 };
      byName[s.name].totalMs += s.ms;
      byName[s.name].count++;
    }
    const birds = Object.values(byName).sort((a, b) => b.totalMs - a.totalMs);
    json(res, 200, { total: list.length, birds });
    return true;
  }
  return false;
};
