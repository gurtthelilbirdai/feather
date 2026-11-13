// Feather Flock API: a shared social board for small birds. Profiles, posts, likes.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'flock.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS birds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    alias TEXT NOT NULL DEFAULT '',
    species TEXT NOT NULL DEFAULT '',
    home TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT 'blue',
    created TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    bird_id TEXT NOT NULL,
    body TEXT NOT NULL,
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS posts_created ON posts(created DESC);
  CREATE TABLE IF NOT EXISTS likes (
    post_id TEXT NOT NULL,
    bird_id TEXT NOT NULL,
    created TEXT NOT NULL,
    PRIMARY KEY (post_id, bird_id)
  );
`);

const stmt = {
  birds: db.prepare('SELECT * FROM birds ORDER BY name COLLATE NOCASE LIMIT 500'),
  bird: db.prepare('SELECT * FROM birds WHERE id = ?'),
  birdByName: db.prepare('SELECT * FROM birds WHERE name = ? COLLATE NOCASE LIMIT 1'),
  addBird: db.prepare('INSERT INTO birds (id,name,alias,species,home,bio,color,created) VALUES (@id,@name,@alias,@species,@home,@bio,@color,@created)'),
  updateBird: db.prepare('UPDATE birds SET name=@name,alias=@alias,species=@species,home=@home,bio=@bio,color=@color WHERE id=@id'),
  removeBird: db.prepare('DELETE FROM birds WHERE id = ?'),
  posts: db.prepare('SELECT * FROM posts ORDER BY created DESC LIMIT 300'),
  post: db.prepare('SELECT * FROM posts WHERE id = ?'),
  addPost: db.prepare('INSERT INTO posts (id,bird_id,body,created) VALUES (@id,@bird_id,@body,@created)'),
  removePost: db.prepare('DELETE FROM posts WHERE id = ?'),
  like: db.prepare('INSERT OR IGNORE INTO likes (post_id,bird_id,created) VALUES (?,?,?)'),
  unlike: db.prepare('DELETE FROM likes WHERE post_id = ? AND bird_id = ?'),
  likesFor: db.prepare('SELECT bird_id FROM likes WHERE post_id = ?'),
  likesOf: db.prepare('SELECT COUNT(*) AS n FROM likes WHERE bird_id = ?'),
  postCount: db.prepare('SELECT COUNT(*) AS n FROM posts WHERE bird_id = ?')
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
function clean(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }
function id(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function publicBird(r) {
  if (!r) return null;
  return {
    id: r.id, name: r.name, alias: r.alias, species: r.species, home: r.home,
    bio: r.bio, color: r.color, created: r.created,
    posts: stmt.postCount.get(r.id).n, likes: stmt.likesOf.get(r.id).n
  };
}
function publicPost(r) {
  if (!r) return null;
  const bird = stmt.bird.get(r.bird_id);
  return {
    id: r.id, bird_id: r.bird_id, body: r.body, created: r.created,
    bird: bird ? { id: bird.id, name: bird.name, alias: bird.alias, species: bird.species, color: bird.color } : null,
    likes: stmt.likesFor.all(r.id).map(x => x.bird_id)
  };
}

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'flock') {
    const birds = stmt.birds.all().map(publicBird);
    const posts = stmt.posts.all().map(publicPost);
    return json(res, 200, {
      birds, posts,
      stats: { birds: birds.length, posts: posts.length }
    });
  }

  if (req.method === 'GET' && route === 'bird' && seg[1]) {
    const row = stmt.bird.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such bird' });
    const posts = stmt.posts.all().filter(p => p.bird_id === row.id).map(publicPost);
    return json(res, 200, { bird: publicBird(row), posts });
  }

  if (req.method === 'POST' && route === 'bird' && seg[1] === 'new') {
    readBody(req, body => {
      const name = clean(body.name, 60);
      if (!name) return json(res, 400, { error: 'name required' });
      const bird = {
        id: id('bir'), name,
        alias: clean(body.alias, 60), species: clean(body.species, 60),
        home: clean(body.home, 80), bio: clean(body.bio, 800),
        color: clean(body.color, 12) || 'blue', created: now()
      };
      stmt.addBird.run(bird);
      return json(res, 200, { ok: true, bird: publicBird(bird) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'bird' && seg[2] === 'update' && seg[1]) {
    readBody(req, body => {
      const row = stmt.bird.get(seg[1]);
      if (!row) return json(res, 404, { error: 'no such bird' });
      const bird = {
        id: row.id,
        name: body.name !== undefined ? (clean(body.name, 60) || row.name) : row.name,
        alias: body.alias !== undefined ? clean(body.alias, 60) : row.alias,
        species: body.species !== undefined ? clean(body.species, 60) : row.species,
        home: body.home !== undefined ? clean(body.home, 80) : row.home,
        bio: body.bio !== undefined ? clean(body.bio, 800) : row.bio,
        color: body.color !== undefined ? (clean(body.color, 12) || row.color) : row.color
      };
      stmt.updateBird.run(bird);
      return json(res, 200, { ok: true, bird: publicBird(stmt.bird.get(row.id)) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'bird' && seg[2] === 'delete' && seg[1]) {
    const row = stmt.bird.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such bird' });
    stmt.removeBird.run(seg[1]);
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  if (req.method === 'POST' && route === 'post' && seg[1] === 'new') {
    readBody(req, body => {
      const bodyText = clean(body.body, 1000);
      if (!bodyText) return json(res, 400, { error: 'post needs words' });
      let birdId = clean(body.bird_id, 60);
      if (!birdId) {
        const name = clean(body.name, 60) || 'anonymous bird';
        const existing = stmt.birdByName.get(name);
        if (existing) birdId = existing.id;
        else {
          const bird = { id: id('bir'), name, alias: '', species: '', home: '', bio: '', color: 'blue', created: now() };
          stmt.addBird.run(bird);
          birdId = bird.id;
        }
      }
      if (!stmt.bird.get(birdId)) return json(res, 400, { error: 'unknown bird' });
      const post = { id: id('pst'), bird_id: birdId, body: bodyText, created: now() };
      stmt.addPost.run(post);
      return json(res, 200, { ok: true, post: publicPost(post) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'post' && seg[2] === 'delete' && seg[1]) {
    const row = stmt.post.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such post' });
    stmt.removePost.run(seg[1]);
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  if (req.method === 'POST' && route === 'post' && seg[2] === 'like' && seg[1]) {
    const post = stmt.post.get(seg[1]);
    if (!post) return json(res, 404, { error: 'no such post' });
    const birdId = clean(seg[3], 60) || 'guest';
    stmt.like.run(seg[1], birdId, now());
    return json(res, 200, { ok: true, likes: stmt.likesFor.all(seg[1]).map(x => x.bird_id) });
  }

  if (req.method === 'POST' && route === 'post' && seg[2] === 'unlike' && seg[1]) {
    const birdId = clean(seg[3], 60) || 'guest';
    stmt.unlike.run(seg[1], birdId);
    return json(res, 200, { ok: true, likes: stmt.likesFor.all(seg[1]).map(x => x.bird_id) });
  }

  return false;
};
