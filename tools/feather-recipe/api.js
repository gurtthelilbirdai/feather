// Feather Recipe API: shared recipe box for small birds, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'recipe.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    ingredients TEXT NOT NULL DEFAULT '',
    steps TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    bird TEXT NOT NULL DEFAULT 'gurt',
    created TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cooks (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    bird TEXT NOT NULL DEFAULT 'gurt',
    note TEXT NOT NULL DEFAULT '',
    created TEXT NOT NULL
  );
`);

const stmt = {
  list: db.prepare('SELECT * FROM recipes ORDER BY created DESC LIMIT 300'),
  get: db.prepare('SELECT * FROM recipes WHERE id = ?'),
  insert: db.prepare('INSERT INTO recipes (id,title,description,ingredients,steps,tags,bird,created) VALUES (@id,@title,@description,@ingredients,@steps,@tags,@bird,@created)'),
  remove: db.prepare('DELETE FROM recipes WHERE id = ?'),
  cooks: db.prepare('SELECT * FROM cooks WHERE recipe_id = ? ORDER BY created DESC'),
  addCook: db.prepare('INSERT INTO cooks (id,recipe_id,bird,note,created) VALUES (@id,@recipe_id,@bird,@note,@created)'),
  countCooks: db.prepare('SELECT COUNT(*) AS n FROM cooks WHERE recipe_id = ?'),
  countAll: db.prepare('SELECT COUNT(*) AS n FROM recipes')
};

function publicRecipe(r) {
  if (!r) return null;
  return {
    id: r.id, title: r.title, description: r.description,
    ingredients: r.ingredients, steps: r.steps, tags: r.tags,
    bird: r.bird, created: r.created,
    cooks: stmt.countCooks.get(r.id).n
  };
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

  if (req.method === 'GET' && route === 'recipes') {
    const rows = stmt.list.all();
    return json(res, 200, {
      recipes: rows.map(publicRecipe),
      total: stmt.countAll.get().n,
      tags: Array.from(new Set(rows.flatMap(r => r.tags.split(',').map(t => t.trim()).filter(Boolean))))
    });
  }

  if (req.method === 'GET' && route === 'recipe' && seg[1]) {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such recipe' });
    return json(res, 200, { recipe: publicRecipe(row), cooks: stmt.cooks.all(seg[1]) });
  }

  if (req.method === 'POST' && route === 'recipes' && seg[1] === 'new') {
    readBody(req, body => {
      const title = String(body.title || '').trim().slice(0, 120);
      if (!title) return json(res, 400, { error: 'title required' });
      const recipe = {
        id: 'rec' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title,
        description: String(body.description || '').slice(0, 500),
        ingredients: String(body.ingredients || '').slice(0, 2000),
        steps: String(body.steps || '').slice(0, 4000),
        tags: String(body.tags || '').slice(0, 200),
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        created: new Date().toISOString()
      };
      stmt.insert.run(recipe);
      return json(res, 200, { ok: true, recipe: publicRecipe(recipe) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'recipe' && seg[1] && seg[2] === 'cook') {
    readBody(req, body => {
      const row = stmt.get.get(seg[1]);
      if (!row) return json(res, 404, { error: 'no such recipe' });
      const cook = {
        id: 'cok' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        recipe_id: row.id,
        bird: String(body.bird || 'gurt').trim().slice(0, 40) || 'gurt',
        note: String(body.note || '').slice(0, 300),
        created: new Date().toISOString()
      };
      stmt.addCook.run(cook);
      return json(res, 200, { ok: true, cook, recipe: publicRecipe(stmt.get.get(row.id)) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'recipe' && seg[1] && seg[2] === 'delete') {
    const row = stmt.get.get(seg[1]);
    if (!row) return json(res, 404, { error: 'no such recipe' });
    stmt.remove.run(seg[1]);
    return json(res, 200, { ok: true, removed: seg[1] });
  }

  return false;
};
