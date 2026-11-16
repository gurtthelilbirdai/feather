// Feather Maze API: shared best times for the flock's maze.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'maze.db'));
db.exec(`CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY, level INTEGER, bird TEXT, seconds REAL, seeds INTEGER,
  moves INTEGER, at TEXT DEFAULT CURRENT_TIMESTAMP)`);

function readBody(req){return new Promise((resolve)=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>{try{resolve(JSON.parse(d||'{}'));}catch(e){resolve({});}});});}
function send(res,code,obj){res.writeHead(code,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(obj));}

module.exports = async function handler(req,res,seg){
  const route = seg[0] || '';
  if(req.method==='GET' && route===''){
    const rows = db.prepare('SELECT * FROM runs ORDER BY level, seconds ASC').all();
    const best = {};
    for(const r of rows){ if(!best[r.level] || r.seconds < best[r.level].seconds) best[r.level]=r; }
    const levels = Object.keys(best).length;
    const birds = new Set(rows.map(r=>r.bird)).size;
    return send(res,200,{runs:rows,best,levels,birds});
  }
  if(req.method==='POST' && route==='run'){
    const b = await readBody(req);
    const level = Number(b.level)||0, seconds = Number(b.seconds)||0;
    const bird = String(b.bird||'gurt').slice(0,40);
    const seeds = Number(b.seeds)||0, moves = Number(b.moves)||0;
    if(level<1||seconds<=0) return send(res,400,{error:'bad run'});
    const id = 'FM-'+Math.random().toString(36).slice(2,8).toUpperCase();
    db.prepare('INSERT INTO runs (id,level,bird,seconds,seeds,moves) VALUES (?,?,?,?,?,?)').run(id,level,bird,seconds,seeds,moves);
    const rows = db.prepare('SELECT * FROM runs WHERE level=? ORDER BY seconds ASC').all(level);
    return send(res,200,{ok:true,id,best:rows[0]});
  }
  return send(res,404,{error:'not found'});
};
