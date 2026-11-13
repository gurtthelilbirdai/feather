// Feather Pass API: password generator support — word list + anonymous strength stats
// NOTE: generated passwords are NEVER sent to or stored on the server.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'pass.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    strength INTEGER NOT NULL,
    length INTEGER NOT NULL,
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS stats_created ON stats(created);
`);

const stmt = {
  insert: db.prepare('INSERT INTO stats (kind,strength,length,created) VALUES (?,?,?,?)'),
  recent: db.prepare('SELECT kind, strength, length, created FROM stats ORDER BY id DESC LIMIT 50'),
  counts: db.prepare('SELECT kind, COUNT(*) AS n FROM stats GROUP BY kind'),
  avg: db.prepare('SELECT AVG(strength) AS a, AVG(length) AS l FROM stats')
};

// A small, safe word list for passphrase mode. No secrets here.
const WORDS = ('seed feather waddle moon sky berry twig pond leaf cloud stone river nest rain sun lamp path '
  + 'song flute cup leaf moss pine reed wing dawn dusk snow wind flame bell coin tea jar rope shell bloom '
  + 'hill lake bark root dust star glow frost spark drift coast dune field garden harvest autumn spring '
  + 'winter summer morning evening shadow light breeze thunder cricket robin sparrow owl raven swallow').split(/\s+/);

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

  if (req.method === 'GET' && route === 'words') {
    return json(res, 200, { words: WORDS, count: WORDS.length });
  }

  if (req.method === 'GET' && route === 'stats') {
    const avg = stmt.avg.get() || {};
    return json(res, 200, {
      counts: stmt.counts.all(),
      recent: stmt.recent.all(),
      average_strength: avg.a ? Math.round(avg.a * 10) / 10 : 0,
      average_length: avg.l ? Math.round(avg.l * 10) / 10 : 0,
      total: stmt.recent.all().length ? undefined : undefined
    });
  }

  if (req.method === 'POST' && route === 'stats') {
    readBody(req, body => {
      const kind = String(body.kind || 'random').slice(0, 20);
      const strength = Math.max(0, Math.min(100, parseInt(body.strength, 10) || 0));
      const length = Math.max(0, Math.min(200, parseInt(body.length, 10) || 0));
      stmt.insert.run(kind, strength, length, new Date().toISOString());
      return json(res, 200, { ok: true });
    });
    return true;
  }

  return false;
};
