// Feather Words API: generate bird puzzles and save scores
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data');
const FILE = path.join(DATA, 'scores.json');

const BANK = [
  {word:'WADDLE', clue:'how a round bird moves', len:6},
  {word:'FEATHER', clue:'what keeps a bird warm', len:7},
  {word:'NEST', clue:'a bird\'s little home', len:4},
  {word:'CHIRP', clue:'a tiny bird sound', len:5},
  {word:'POND', clue:'where lily pads float', len:4},
  {word:'SEED', clue:'a snack found in grass', len:4},
  {word:'WING', clue:'a bird lifts with it', len:4},
  {word:'SONG', clue:'what a bird sings', len:4},
  {word:'MOTH', clue:'a fluttery nighttime snack', len:4},
  {word:'SKY', clue:'where clouds and birds go', len:3},
  {word:'RAIN', clue:'drops from clouds', len:4},
  {word:'LEAF', clue:'green thing on a branch', len:4},
  {word:'STAR', clue:'a pinprick in the night', len:4},
  {word:'ROCK', clue:'a hard grey ground thing', len:4},
  {word:'LAMP', clue:'a tiny sun for the yard', len:4},
  {word:'BOOK', clue:'pages full of words', len:4},
  {word:'TREE', clue:'a tall plant with branches', len:4},
  {word:'FISH', clue:'lives in the pond', len:4},
  {word:'HOP', clue:'a short bird jump', len:3},
  {word:'WARM', clue:'what a feather jacket gives', len:4}
];

function readAll(){
  try{ const d=JSON.parse(fs.readFileSync(FILE,'utf8')); return Array.isArray(d)?d:[]; }catch(e){ return []; }
}
function writeAll(list){
  fs.mkdirSync(DATA,{recursive:true});
  fs.writeFileSync(FILE, JSON.stringify(list.slice(0,500),null,2));
}
function send(res,code,obj){
  res.writeHead(code,{
    'Content-Type':'application/json',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(obj));
}
function body(req){
  return new Promise(resolve=>{
    let d='';
    req.on('data',c=>{ d+=c; if(d.length>10000) req.destroy(); });
    req.on('end',()=>{ try{ resolve(JSON.parse(d||'{}')); }catch(e){ resolve({}); } });
  });
}
function clean(s,max){ return String(s||'').replace(/[<>]/g,'').trim().slice(0,max); }

function makePuzzle(seed){
  const rnd = (n)=>{ seed=(seed*1664525+1013904223)>>>0; return seed%n; };
  const pool = BANK.slice();
  const picked=[];
  for(let i=0;i<5 && pool.length;i++){
    picked.push(pool.splice(rnd(pool.length),1)[0]);
  }
  return picked.map(p=>({word:p.word, clue:p.clue, len:p.len}));
}

module.exports = async function handler(req,res,rest){
  const route = rest[0];

  if(req.method==='OPTIONS'){ send(res,204,{}); return true; }

  // GET /api/featherwords/puzzle?seed=123
  if(req.method==='GET' && route==='puzzle'){
    const seed = Number(new URL(req.url,'http://x').searchParams.get('seed')) || Date.now()%100000;
    send(res,200,{puzzle:makePuzzle(seed)});
    return true;
  }

  // GET /api/featherwords/scores
  if(req.method==='GET' && route==='scores'){
    send(res,200,{scores:readAll().sort((a,b)=>b.points-a.points).slice(0,50)});
    return true;
  }

  // POST /api/featherwords/scores {name,points,seconds}
  if(req.method==='POST' && route==='scores'){
    const b = await body(req);
    const name = clean(b.name,20) || 'anonymous bird';
    const points = Math.max(0, Math.min(10000, Math.floor(Number(b.points)||0)));
    const seconds = Math.max(0, Math.min(9999, Math.floor(Number(b.seconds)||0)));
    if(points<=0){ send(res,400,{error:'no points'}); return true; }
    const list = readAll();
    list.push({name, points, seconds, at:new Date().toISOString()});
    writeAll(list);
    send(res,200,{ok:true});
    return true;
  }

  send(res,404,{error:'not found'});
  return true;
};
