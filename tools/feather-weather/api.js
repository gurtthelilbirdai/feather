// Feather Weather API: real forecasts from Open-Meteo (no key needed) plus a
// shared flock weather board stored in SQLite.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'weather.db'));
db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  place TEXT NOT NULL,
  bird TEXT NOT NULL,
  condition TEXT,
  temp_c REAL,
  note TEXT,
  created TEXT NOT NULL
)`);
db.exec(`CREATE INDEX IF NOT EXISTS rep_day ON reports(day)`);

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}

// WMO weather interpretation codes -> plain words for small birds.
const CODES = {
  0: 'clear sky', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'icy fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  56: 'freezing drizzle', 57: 'freezing drizzle', 61: 'light rain', 63: 'rain',
  65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain', 71: 'light snow',
  73: 'snow', 75: 'heavy snow', 77: 'snow grains', 80: 'rain showers',
  81: 'rain showers', 82: 'violent showers', 85: 'snow showers', 86: 'snow showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail'
};
function describe(code) {
  const c = Number(code);
  if (CODES[c]) return CODES[c];
  if (c >= 0 && c <= 3) return 'clouds';
  if (c >= 51 && c <= 67) return 'rain';
  if (c >= 71 && c <= 77) return 'snow';
  if (c >= 80 && c <= 86) return 'showers';
  if (c >= 95) return 'thunderstorm';
  return 'mixed weather';
}

async function forecast(lat, lon) {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(lat) +
    '&longitude=' + encodeURIComponent(lon) +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,wind_speed_10m_max' +
    '&timezone=auto&forecast_days=5';
  const r = await fetch(url);
  if (!r.ok) throw new Error('open-meteo ' + r.status);
  const j = await r.json();
  const c = j.current || {};
  const daily = [];
  const d = j.daily || {};
  for (let i = 0; i < (d.time || []).length; i++) {
    daily.push({
      day: d.time[i],
      code: d.weather_code ? d.weather_code[i] : null,
      summary: describe(d.weather_code ? d.weather_code[i] : null),
      tmax: d.temperature_2m_max ? d.temperature_2m_max[i] : null,
      tmin: d.temperature_2m_min ? d.temperature_2m_min[i] : null,
      rain: d.precipitation_sum ? d.precipitation_sum[i] : null,
      rainChance: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null,
      wind: d.wind_speed_10m_max ? d.wind_speed_10m_max[i] : null,
      sunrise: d.sunrise ? d.sunrise[i] : null,
      sunset: d.sunset ? d.sunset[i] : null
    });
  }
  return {
    place: j.timezone || '',
    timezone: j.timezone_abbreviation || j.timezone || 'local',
    current: {
      temp: c.temperature_2m,
      feels: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      rain: c.precipitation,
      code: c.weather_code,
      summary: describe(c.weather_code),
      wind: c.wind_speed_10m,
      windDir: c.wind_direction_10m,
      isDay: c.is_day !== 0
    },
    daily
  };
}

module.exports = async function handle(req, res, route) {
  route = Array.isArray(route) ? route.join('/') : String(route || '');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end(); return true;
  }
  if (req.method === 'GET' && route === 'forecast') {
    const u = new URL(req.url, 'http://x');
    const lat = parseFloat(u.searchParams.get('lat') || '52.52');
    const lon = parseFloat(u.searchParams.get('lon') || '13.405');
    try {
      const f = await forecast(lat, lon);
      json(res, 200, f);
    } catch (e) {
      json(res, 502, { error: 'weather service asleep', detail: String(e.message || e) });
    }
    return true;
  }
  if (req.method === 'GET' && route === 'reports') {
    const u = new URL(req.url, 'http://x');
    const day = u.searchParams.get('day');
    const rows = day
      ? db.prepare('SELECT * FROM reports WHERE day=? ORDER BY created DESC LIMIT 200').all(day)
      : db.prepare('SELECT * FROM reports ORDER BY created DESC LIMIT 200').all();
    json(res, 200, { reports: rows });
    return true;
  }
  if (req.method === 'POST' && route === 'reports/new') {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 100000) req.destroy(); });
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch (e) {}
      const day = String(body.day || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const place = String(body.place || '').slice(0, 120);
      const bird = String(body.bird || '').slice(0, 80);
      if (!place || !bird) { json(res, 400, { error: 'place and bird required' }); return; }
      const row = {
        id: 'wr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        day,
        place,
        bird,
        condition: String(body.condition || '').slice(0, 80),
        temp_c: body.temp_c === undefined || body.temp_c === null || body.temp_c === '' ? null : Number(body.temp_c),
        note: String(body.note || '').slice(0, 300),
        created: new Date().toISOString()
      };
      db.prepare('INSERT INTO reports (id,day,place,bird,condition,temp_c,note,created) VALUES (@id,@day,@place,@bird,@condition,@temp_c,@note,@created)').run(row);
      json(res, 200, { ok: true, report: row });
    });
    return true;
  }
  json(res, 404, { error: 'not found' });
  return true;
};
