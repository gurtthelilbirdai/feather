// Feather Almanac API: a daily nature almanac with moon phases, daylight,
// seasonal notes, and a shared flock observation board. SQLite storage.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'almanac.db'));
db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  bird TEXT NOT NULL,
  kind TEXT,
  note TEXT,
  place TEXT,
  observer TEXT,
  created TEXT NOT NULL
)`);
db.exec(`CREATE INDEX IF NOT EXISTS obs_day ON observations(day)`);
// migrate old tables that lack newer columns
const cols = db.prepare('PRAGMA table_info(observations)').all().map(c => c.name);
for (const c of ['observer','place','kind','note']) {
  if (!cols.includes(c)) db.exec(`ALTER TABLE observations ADD COLUMN ${c} TEXT`);
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

function moonPhase(date) {
  // Mean synodic month based phase, 0 = new moon.
  const known = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  const days = date.getTime() / 86400000 - known;
  let p = ((days % 29.530588853) + 29.530588853) % 29.530588853;
  p /= 29.530588853;
  const names = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
    'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
  const idx = Math.floor(p * 8 + 0.5) % 8;
  const illum = (1 - Math.cos(2 * Math.PI * p)) / 2;
  return {
    phase: p,
    name: names[idx],
    illumination: Math.round(illum * 1000) / 10,
    age: Math.round(p * 29.53 * 10) / 10
  };
}

function daylight(date, lat) {
  // Simple NOAA-ish sunrise/sunset approximation in UTC hours.
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
  const decl = 23.44 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365) * Math.PI / 180;
  const phi = lat * Math.PI / 180;
  const cosH = -Math.tan(phi) * Math.tan(decl);
  if (cosH <= -1) return { sunrise: '00:00', sunset: '23:59', hours: 24 };
  if (cosH >= 1) return { sunrise: '—', sunset: '—', hours: 0 };
  const H = Math.acos(cosH) * 180 / Math.PI;
  const fmt = h => {
    const hh = Math.floor(((h % 24) + 24) % 24);
    const mm = Math.round((h - Math.floor(h)) * 60);
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  };
  const localNoon = 12;
  return {
    sunrise: fmt(localNoon - H / 15),
    sunset: fmt(localNoon + H / 15),
    hours: Math.round((2 * H / 15) * 10) / 10
  };
}

const SEASONS = [
  { name: 'winter', from: [11, 11], to: [2, 1] },
  { name: 'spring', from: [2, 2], to: [4, 4] },
  { name: 'summer', from: [4, 5], to: [7, 7] },
  { name: 'autumn', from: [7, 8], to: [10, 10] }
];
function season(date) {
  const m = date.getUTCMonth() + 1, d = date.getUTCDate();
  for (const s of SEASONS) {
    const [fm, fd] = s.from, [tm, td] = s.to;
    if (fm <= tm ? (m > fm || (m === fm && d >= fd)) && (m < tm || (m === tm && d <= td))
                  : (m > fm || (m === fm && d >= fd)) || (m < tm || (m === tm && d <= td))) return s.name;
  }
  return 'summer';
}

const NOTES = {
  winter: ['bare branches make good perches', 'berries are the whole winter pantry', 'look for robins near warm walls'],
  spring: ['first nests go up in the hedges', 'morning chorus starts before light', 'watch for returning swallows'],
  summer: ['long days, short nights', 'insects hum in the warm air', 'swifts sleep high up'],
  autumn: ['leaves turn before the cold', 'birds grow restless and loud', 'geese line up to leave']
};

function almanacFor(dateStr) {
  const date = dateStr ? new Date(dateStr + 'T12:00:00Z') : new Date();
  if (isNaN(date.getTime())) return null;
  const day = date.toISOString().slice(0, 10);
  const s = season(date);
  const notes = NOTES[s] || [];
  const seed = [...day].reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    day,
    season: s,
    moon: moonPhase(date),
    daylight: daylight(date, 52),
    note: notes[seed % notes.length],
    weekday: date.toUTCString().slice(0, 3),
    dayOfYear: Math.floor((date - new Date(Date.UTC(date.getUTCFullYear(), 0, 0))) / 86400000)
  };
}

module.exports = function handle(req, res, route) {
  route = Array.isArray(route) ? route.join('/') : String(route || '');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end(); return true;
  }
  if (req.method === 'GET' && route === 'today') {
    const u = new URL(req.url, 'http://x');
    const a = almanacFor(u.searchParams.get('day'));
    if (a) { json(res, 200, a); } else { json(res, 400, { error: 'bad day' }); }
    return true;
  }
  if (req.method === 'GET' && route === 'observations') {
    const u = new URL(req.url, 'http://x');
    const day = u.searchParams.get('day');
    const rows = day
      ? db.prepare('SELECT * FROM observations WHERE day=? ORDER BY created DESC LIMIT 200').all(day)
      : db.prepare('SELECT * FROM observations ORDER BY created DESC LIMIT 200').all();
    json(res, 200, { observations: rows }); return true;
  }
  if (req.method === 'POST' && route === 'observations/new') {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 100000) req.destroy(); });
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch (e) {}
      const day = String(body.day || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const bird = String(body.bird || '').slice(0, 80);
      if (!bird) { json(res, 400, { error: 'bird required' }); return; }
      const row = {
        id: 'obs' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        day,
        bird,
        kind: String(body.kind || '').slice(0, 60),
        note: String(body.note || '').slice(0, 300),
        place: String(body.place || '').slice(0, 120),
        observer: String(body.observer || body.bird2 || '').slice(0, 80),
        created: new Date().toISOString()
      };
      db.prepare('INSERT INTO observations (id,day,bird,kind,note,place,observer,created) VALUES (@id,@day,@bird,@kind,@note,@place,@observer,@created)').run(row);
      json(res, 200, { ok: true, observation: row });
    });
    return true;
  }
  json(res, 404, { error: 'not found' });
  return true;
};
