// Feather Link API: tiny link shortener for small birds, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'links.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS links (
    code TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    bird TEXT NOT NULL DEFAULT 'gurt',
    hits INTEGER NOT NULL DEFAULT 0,
    created TEXT NOT NULL
  );
`);

const stmt = {
  list: db.prepare('SELECT * FROM links ORDER BY created DESC LIMIT 300'),
  get: db.prepare('SELECT * FROM links WHERE code = ?'),
  insert: db.prepare('INSERT INTO links (code,url,title,bird,hits,created) VALUES (@code,@url,@title,@bird,@hits,@created)'),
  hit: db.prepare('UPDATE links SET hits = hits + 1 WHERE code = ?'),
  remove: db.prepare('DELETE FROM links WHERE code = ?')
};

const ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789';

function makeCode(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

function publish(link) {
  try {
    const https = require('https');
    const body = JSON.stringify(link);
    const req = https.request('https://ntfy.sh/gurt-feather-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, r => { r.resume(); });
    req.on('error', () => {});
    req.write(body);
    req.end();
  } catch (e) {}
}

function mirrorLinks() {
  try {
    const dir = '/drive/website/feather-link';
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'links.json'), JSON.stringify({ links: stmt.list.all() }, null, 1));
  } catch (e) {}
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

  // redirect: /api/featherlink/go/<code>
  if (req.method === 'GET' && route === 'go' && seg[1]) {
    const row = stmt.get.get(seg[1]);
    if (!row) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('no such little link');
    }
    stmt.hit.run(row.code);
    res.writeHead(302, { Location: row.url, 'Cache-Control': 'no-store' });
    return res.end();
  }

  if (req.method === 'GET' && route === 'links') {
    const links = stmt.list.all();
    mirrorLinks();
    return json(res, 200, { links, total: links.length, base: 'https://gurtthelilbirdai.github.io/feather-link/go/' });
  }

  if (req.method === 'POST' && route === 'link' && seg[1] === 'new') {
    readBody(req, body => {
      let url = String(body.url || '').trim();
      if (!url) return json(res, 400, { error: 'url required' });
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      let parsed = null;
      try { parsed = new URL(url); } catch (e) { return json(res, 400, { error: 'that url does not look like a url' }); }
      if (!parsed.hostname.includes('.')) return json(res, 400, { error: 'that url does not look like a url' });

      let code = String(body.code || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
      if (code && stmt.get.get(code)) return json(res, 409, { error: 'that code is already taken' });
      if (!code) {
        do { code = makeCode(5); } while (stmt.get.get(code));
      }
      const link = {
        code,
        url,
        title: String(body.title || parsed.hostname).slice(0, 120),
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        hits: 0,
        created: new Date().toISOString()
      };
      stmt.insert.run(link);
      publish(link);
      mirrorLinks();
      return json(res, 200, { ok: true, link, short: 'https://gurtthelilbirdai.github.io/feather-link/go.html?c=' + code });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'link' && seg[1] && seg[2] === 'delete') {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such link' });
    stmt.remove.run(seg[1]);
    mirrorLinks();
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
