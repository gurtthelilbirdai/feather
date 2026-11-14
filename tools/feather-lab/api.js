// Feather Lab API: generate bird puzzles, store them, save solves
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data');
const PUZZLES = path.join(DATA, 'puzzles.json');
const SOLVES = path.join(DATA, 'solves.json');

function ensure(){
  if(!fs.existsSync(DATA)) fs.mkdirSync(DATA, {recursive:true});
  if(!fs.existsSync(PUZZLES)) fs.writeFileSync(PUZZLES, '[]');
  if(!fs.existsSync(SOLVES)) fs.writeFileSync(SOLVES, '[]');
}
ensure();

function read(f){ try{ return JSON.parse(fs.readFileSync(f,'utf8')); }catch(e){ return []; } }
function write(f,v){ fs.writeFileSync(f, JSON.stringify(v,null,2)); }

function json(res, code, obj){
  res.writeHead(code, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});
  res.end(JSON.stringify(obj));
}

function body(req){
  return new Promise(resolve=>{
    let b='';
    req.on('data', c=>{ b+=c; if(b.length>100000) req.destroy(); });
    req.on('end', ()=>{ try{ resolve(JSON.parse(b||'{}')); }catch(e){ resolve({}); } });
  });
}

function rnd(n){ return Math.floor(Math.random()*n); }

const KINDS = {
  arith: 'arithmetic hops',
  geom: 'growing seeds',
  square: 'square burrows',
  fib: 'two-bird waddle',
  alt: 'two-step waddle'
};

function makeArith(){
  const start = 1+rnd(12), step = 2+rnd(9);
  const seq=[]; let v=start;
  for(let i=0;i<6;i++){ seq.push(v); v+=step; }
  return {kind:'arith', seq, answer:v, rule:'add '+step+' each time'};
}
function makeGeom(){
  const start = 1+rnd(4), ratio = 2+rnd(2);
  const seq=[]; let v=start;
  for(let i=0;i<6;i++){ seq.push(v); v*=ratio; }
  return {kind:'geom', seq, answer:v, rule:'multiply by '+ratio+' each time'};
}
function makeSquare(){
  const start = 1+rnd(5);
  const seq=[]; let v=start;
  for(let i=0;i<6;i++){ seq.push(v*v); v++; }
  return {kind:'square', seq, answer:v*v, rule:'consecutive squares'};
}
function makeFib(){
  const a = 1+rnd(4), b = a+1+rnd(4);
  const seq=[a,b]; let x=a,y=b;
  for(let i=0;i<4;i++){ const z=x+y; seq.push(z); x=y; y=z; }
  const ans=x+y; seq.push(ans);
  return {kind:'fib', seq:seq.slice(0,6), answer:ans, rule:'each number is the sum of the two before'};
}
function makeAlt(){
  const a = 1+rnd(8), step = 2+rnd(6), step2 = 3+rnd(7);
  const seq=[a]; let v=a;
  for(let i=0;i<5;i++){ v += (i%2===0)?step:step2; seq.push(v); }
  return {kind:'alt', seq, answer:v+(step), rule:'alternating steps of +'+step+' and +'+step2};
}

const MAKERS = {arith:makeArith, geom:makeGeom, square:makeSquare, fib:makeFib, alt:makeAlt};

function generate(kind){
  const maker = MAKERS[kind] || MAKERS.arith;
  const p = maker();
  p.id = 'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  p.kindName = KINDS[p.kind];
  p.createdAt = new Date().toISOString();
  return p;
}

module.exports = async function handler(req,res,rest){
  const seg = rest[0];

  if(req.method==='OPTIONS'){ json(res,204,{}); return true; }

  if(req.method==='GET' && seg==='puzzle'){
    const list = read(PUZZLES);
    const p = generate(null);
    list.push(p);
    write(PUZZLES, list.slice(-500));
    json(res,200,{puzzle:p});
    return true;
  }

  if(req.method==='GET' && seg==='puzzles'){
    const list = read(PUZZLES).slice(-50).reverse();
    json(res,200,{puzzles:list});
    return true;
  }

  if(req.method==='GET' && seg==='kinds'){
    json(res,200,{kinds:Object.keys(KINDS).map(k=>({id:k,name:KINDS[k]}))});
    return true;
  }

  if(req.method==='GET' && seg==='solves'){
    const list = read(SOLVES).sort((a,b)=>(a.ms||1e9)-(b.ms||1e9));
    json(res,200,{solves:list.slice(0,100)});
    return true;
  }

  if(req.method==='POST' && seg==='solves'){
    const b = await body(req);
    const name = String(b.name||'anonymous bird').slice(0,40);
    const ms = Math.max(1, Math.min(3600000, Number(b.ms)||0));
    const kind = String(b.kind||'arith').slice(0,20);
    const list = read(SOLVES);
    const entry = {id:'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), name, ms, kind, at:new Date().toISOString()};
    list.push(entry);
    write(SOLVES, list.slice(-1000));
    const sorted = list.slice().sort((a,b2)=>(a.ms||1e9)-(b2.ms||1e9));
    const rank = sorted.findIndex(s=>s.id===entry.id)+1;
    json(res,200,{ok:true, rank, solve:entry});
    return true;
  }

  if(req.method==='POST' && seg==='generate'){
    const b = await body(req);
    const p = generate(String(b.kind||'arith'));
    const list = read(PUZZLES); list.push(p); write(PUZZLES, list.slice(-500));
    json(res,200,{puzzle:p});
    return true;
  }

  return false;
};
