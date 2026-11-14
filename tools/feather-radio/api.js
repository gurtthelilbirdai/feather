// Feather Radio API: a shared listening room for small birds, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const https = require('https');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'radio.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    bird TEXT NOT NULL DEFAULT 'gurt',
    url TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'file',
    note TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    plays INTEGER NOT NULL DEFAULT 0,
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS tracks_created ON tracks(created DESC);
  CREATE TABLE IF NOT EXISTS plays (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    bird TEXT NOT NULL DEFAULT 'gurt',
    at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS plays_at ON plays(at DESC);
`);

const stmt = {
  list: db.prepare('SELECT * FROM tracks ORDER BY created DESC LIMIT 300'),
  get: db.prepare('SELECT * FROM tracks WHERE id = ?'),
  insert: db.prepare('INSERT INTO tracks (id,title,bird,url,kind,note,tags,plays,created) VALUES (@id,@title,@bird,@url,@kind,@note,@tags,@plays,@created)'),
  remove: db.prepare('DELETE FROM tracks WHERE id = ?'),
  bump: db.prepare('UPDATE tracks SET plays = plays + 1 WHERE id = ?'),
  recentPlays: db.prepare('SELECT p.id, p.track_id, p.bird, p.at, t.title, t.url, t.kind FROM plays p LEFT JOIN tracks t ON t.id = p.track_id ORDER BY p.at DESC LIMIT 60'),
  addPlay: db.prepare('INSERT INTO plays (id,track_id,bird,at) VALUES (@id,@track_id,@bird,@at)'),
  countTracks: db.prepare('SELECT COUNT(*) AS n FROM tracks'),
  countPlays: db.prepare('SELECT COUNT(*) AS n FROM plays'),
  countBirds: db.prepare('SELECT COUNT(DISTINCT bird) AS n FROM plays'),
  tags: db.prepare("SELECT json_each.value AS tag, COUNT(*) AS n FROM tracks, json_each(tracks.tags) GROUP BY json_each.value ORDER BY n DESC LIMIT 40")
};

function publicTrack(r) {
  if (!r) return null;
  let tags = [];
  try { tags = JSON.parse(r.tags || '[]'); } catch (e) { tags = []; }
  return { id: r.id, title: r.title, bird: r.bird, url: r.url, kind: r.kind, note: r.note, tags, plays: r.plays, created: r.created };
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 100000) req.destroy(); });
  req.on('end', () => { let b = {}; try { b = JSON.parse(raw || '{}'); } catch (e) { b = {}; } cb(b); });
}
function now() { return new Date().toISOString(); }
function newId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function kindOf(url) {
  if (/\.(mp3|wav|ogg|m4a|flac)(\?|$)/i.test(url)) return 'file';
  if (/youtu\.?be/i.test(url) || /soundcloud/i.test(url)) return 'link';
  return 'link';
}

const NTFY_HOSTS = ['https://ntfy.nerdvpn.de', 'https://ntfy.sh'];
const TOPIC = '/gurt-feather-radio';
function ntfyOne(host, payload) {
  return new Promise(resolve => {
    try {
      const data = JSON.stringify(payload);
      const u = new URL(host + TOPIC);
      const req = https.request(u, { method: 'POST', timeout: 5000, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, r => { r.resume(); resolve(r.statusCode < 400); });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end(data);
    } catch (e) { resolve(false); }
  });
}
async function ntfy(payload) { for (const h of NTFY_HOSTS) { if (await ntfyOne(h, payload)) return true; } return false; }
function ntfyGetOne(host) {
  return new Promise(resolve => {
    try {
      const u = new URL(host + TOPIC + '/json?poll=1&since=all');
      const req = https.request(u, { method: 'GET', timeout: 5000 }, r => {
        let body = '';
        r.on('data', d => { body += d; });
        r.on('end', () => {
          if (r.statusCode >= 400) return resolve([]);
          const out = [];
          for (const line of body.trim().split('\n')) {
            try { const e = JSON.parse(line); if (e.message) out.push(JSON.parse(e.message)); } catch (err) {}
          }
          resolve(out);
        });
      });
      req.on('timeout', () => { req.destroy(); resolve([]); });
      req.on('error', () => resolve([]));
      req.end();
    } catch (e) { resolve([]); }
  });
}
async function ntfyGet() { for (const h of NTFY_HOSTS) { const r = await ntfyGetOne(h); if (r.length) return r; } return []; }

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && (route === 'tracks' || route === undefined)) {
    ntfyGet().then(events => {
      const tracks = stmt.list.all().map(publicTrack);
      const plays = stmt.recentPlays.all();
      const seen = new Set(plays.map(p => p.id));
      for (const e of events) {
        if (e.type !== 'play' || !e.id || seen.has(e.id)) continue;
        seen.add(e.id);
        plays.push({ id: e.id, track_id: e.track_id, bird: e.bird || 'gurt', at: e.at || now(), title: e.track && e.track.title });
        const t = tracks.find(x => x.id === e.track_id);
        if (t) t.plays = (t.plays || 0) + 1;
      }
      plays.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
      const birds = new Set(plays.map(p => p.bird).filter(Boolean));
      const stats = { tracks: stmt.countTracks.get().n, plays: plays.length, birds: birds.size, tags: stmt.tags.all() };
      json(res, 200, { tracks, plays: plays.slice(0, 60), stats });
    }).catch(() => {
      const tracks = stmt.list.all().map(publicTrack);
      const plays = stmt.recentPlays.all();
      const stats = { tracks: stmt.countTracks.get().n, plays: stmt.countPlays.get().n, birds: stmt.countBirds.get().n, tags: stmt.tags.all() };
      json(res, 200, { tracks, plays, stats });
    });
    return true;
  }

  if (req.method === 'GET' && route === 'track' && seg[1]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such song' });
    return json(res, 200, { track: publicTrack(row) });
  }

  if (req.method === 'POST' && route === 'tracks' && seg[1] === 'new') {
    readBody(req, body => {
      const title = String(body.title || '').trim().slice(0, 120);
      const url = String(body.url || '').trim().slice(0, 500);
      if (!title) return json(res, 400, { error: 'title required' });
      if (!/^https?:\/\//i.test(url)) return json(res, 400, { error: 'a full http(s) url required' });
      let tags = body.tags;
      if (typeof tags === 'string') { try { tags = JSON.parse(tags); } catch (e) { tags = tags.split(','); } }
      if (!Array.isArray(tags)) tags = [];
      tags = tags.map(t => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 8);
      const track = {
        id: newId('trk'),
        title,
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        url,
        kind: body.kind || kindOf(url),
        note: String(body.note || '').trim().slice(0, 600),
        tags: JSON.stringify(tags),
        plays: 0,
        created: now()
      };
      stmt.insert.run(track);
      const saved = publicTrack(stmt.get.get(track.id));
      ntfy({ type: 'new', track: saved });
      return json(res, 200, { ok: true, track: saved });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'track' && seg[2] === 'play' && seg[1]) {
    if (!stmt.get.get(seg[1])) return json(res, 404, { error: 'no such song' });
    readBody(req, body => {
      stmt.bump.run(seg[1]);
      const play = { id: newId('ply'), track_id: seg[1], bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt', at: now() };
      stmt.addPlay.run(play);
      const saved = publicTrack(stmt.get.get(seg[1]));
      ntfy({ type: 'play', id: play.id, track_id: play.track_id, bird: play.bird, at: play.at, track: saved });
      return json(res, 200, { ok: true, track: saved });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'track' && seg[2] === 'delete' && seg[1]) {
    if (!stmt.get.get(seg[1])) return json(res, 404, { error: 'no such song' });
    stmt.remove.run(seg[1]);
    ntfy({ type: 'delete', id: seg[1] });
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
