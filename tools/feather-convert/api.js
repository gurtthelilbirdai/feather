// Feather Convert API: unit conversions with a shared history board
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, 'data');
const FILE = path.join(DATA, 'history.json');


const UNITS = {
  length: { m:1, km:1000, cm:0.01, mm:0.001, mi:1609.344, yd:0.9144, ft:0.3048, in:0.0254, 'nautical mile':1852 },
  mass: { kg:1, g:0.001, mg:1e-6, t:1000, lb:0.45359237, oz:0.028349523, stone:6.35029318 },
  speed: { 'm/s':1, 'km/h':0.277777778, mph:0.44704, knot:0.514444, 'ft/s':0.3048 },
  area: { 'm2':1, 'km2':1e6, 'cm2':1e-4, hectare:10000, acre:4046.85642, 'ft2':0.09290304, 'mi2':2589988.11 },
  time: { s:1, min:60, h:3600, day:86400, week:604800, month:2629800, year:31557600 }
};
function convert(value, from, to) {
  for (const cat of Object.keys(UNITS)) {
    const u = UNITS[cat];
    if (u[from] !== undefined && u[to] !== undefined) return value * u[from] / u[to];
  }
  if (from === 'celsius' || from === 'fahrenheit' || from === 'kelvin') {
    const c = from === 'celsius' ? value : from === 'fahrenheit' ? (value - 32) * 5 / 9 : value - 273.15;
    const k = c + 273.15;
    return to === 'celsius' ? c : to === 'fahrenheit' ? c * 9 / 5 + 32 : k;
  }
  return null;
}

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return []; }
}
function save(list) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'history') {
    const list = load().sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 50);
    return json(res, 200, { history: list });
  }

  if (req.method === 'POST' && route === 'convert') {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 10000) req.destroy(); });
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch (e) { return json(res, 400, { error: 'bad json' }); }
      const from = String(body.from || '').slice(0, 20);
      const to = String(body.to || '').slice(0, 20);
      const value = Number(body.value);
      if (!from || !to || !isFinite(value)) return json(res, 400, { error: 'from, to and value required' });
      const list = load();
      const item = {
        id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        from, to, value, result: convert(value, from, to), at: new Date().toISOString()
      };
      list.push(item);
      save(list.slice(-500));
      return json(res, 200, { ok: true, item });
    });
    return true;
  }

  if (req.method === 'GET' && route === 'units') {
    return json(res, 200, {
      units: ['length', 'mass', 'temperature', 'speed', 'area', 'time']
    });
  }

  return false;
};
