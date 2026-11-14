// Feather Habit API: habit tracking with streaks, stored to disk
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data');
const FILE = path.join(DATA, 'habits.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return { habits: [] }; }
}
function save(d) {
  try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
}
function today() { return new Date().toISOString().slice(0, 10); }
function dayBefore(day) {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
function streakOf(h) {
  const days = new Set(h.days || []);
  let cur = today();
  if (!days.has(cur)) cur = dayBefore(cur);
  let n = 0;
  while (days.has(cur)) { n++; cur = dayBefore(cur); }
  return n;
}
function bestOf(h) {
  const days = (h.days || []).slice().sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) {
    run = (prev && dayBefore(d) === prev) ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}
function publicHabit(h) {
  return {
    id: h.id, name: h.name, bird: h.bird,
    days: (h.days || []).slice().sort(),
    streak: streakOf(h), best: bestOf(h),
    doneToday: (h.days || []).includes(today()),
    created: h.created
  };
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 10000) req.destroy(); });
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch (e) { body = {}; }
    cb(body);
  });
}

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'habits') {
    const d = load();
    return json(res, 200, { habits: d.habits.map(publicHabit) });
  }

  if (req.method === 'POST' && route === 'habits' && seg[1] === 'new') {
    readBody(req, body => {
      const name = String(body.name || '').trim().slice(0, 60);
      const bird = String(body.bird || 'gurt').trim().slice(0, 40);
      if (!name) return json(res, 400, { error: 'name required' });
      const d = load();
      const h = {
        id: 'hab' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name, bird, days: [], created: new Date().toISOString()
      };
      d.habits.push(h);
      save(d);
      return json(res, 200, { ok: true, habit: publicHabit(h) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'habits' && seg[2] === 'check') {
    const d = load();
    const h = d.habits.find(x => x.id === seg[1]);
    if (!h) return json(res, 404, { error: 'no such habit' });
    h.days = h.days || [];
    const t = today();
    const i = h.days.indexOf(t);
    if (i >= 0) h.days.splice(i, 1); else h.days.push(t);
    save(d);
    return json(res, 200, { ok: true, habit: publicHabit(h) });
  }

  if (req.method === 'POST' && route === 'habits' && seg[2] === 'delete') {
    const d = load();
    const i = d.habits.findIndex(x => x.id === seg[1]);
    if (i < 0) return json(res, 404, { error: 'no such habit' });
    const gone = d.habits.splice(i, 1)[0];
    save(d);
    return json(res, 200, { ok: true, removed: gone.id });
  }

  return false;
};
