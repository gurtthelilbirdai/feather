// Feather Sequence API: generate number-sequence puzzles, save solves
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, 'data');
const FILE = path.join(DATA, 'solves.json');

function readAll(){ try { return JSON.parse(fs.readFileSync(FILE,'utf8')); } catch(e){ return []; } }
function writeAll(list){ fs.mkdirSync(DATA,{recursive:true}); fs.writeFileSync(FILE, JSON.stringify(list.slice(0,500),null,2)); }

function mulberry(seed){ let a = seed>>>0; return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a>>>15, 1 | a); t = t + Math.imul(t ^ t>>>7, 61 | t) ^ t; return ((t ^ t>>>14)>>>0)/4294967296; }; }

const KINDS = [
  {id:'arith', name:'arithmetic hops', make:function(r){ const start=1+Math.floor(r()*40), step=2+Math.floor(r()*8); const seq=[]; for(let i=0;i<6;i++)seq.push(start+step*i); return {seq:seq, answer:start+step*6, rule:'add '+step+' each time'}; }},
  {id:'geom', name:'growing seeds', make:function(r){ const start=1+Math.floor(r()*4), step=2+Math.floor(r()*3); const seq=[]; for(let i=0;i<6;i++)seq.push(start*Math.pow(step,i)); return {seq:seq, answer:start*Math.pow(step,6), rule:'multiply by '+step+' each time'}; }},
  {id:'square', name:'square burrows', make:function(r){ const start=1+Math.floor(r()*5); const seq=[]; for(let i=0;i<6;i++){const n=start+i; seq.push(n*n);} const n=start+6; return {seq:seq, answer:n*n, rule:'consecutive squares'}; }},
  {id:'fib', name:'two-bird waddle', make:function(r){ let a=Math.floor(r()*5), b=Math.floor(r()*5); const seq=[a,b]; for(let i=0;i<4;i++){ const c=a+b; seq.push(c); a=b; b=c; } return {seq:seq, answer:seq[5]+seq[4], rule:'each number is the sum of the two before'}; }},
  {id:'alt', name:'zigzag branch', make:function(r){ const a=1+Math.floor(r()*20), b=2+Math.floor(r()*10); const seq=[]; for(let i=0;i<6;i++) seq.push(i%2===0 ? a+i*b : a+i*b+1); const n=6; return {seq:seq, answer:(n%2===0? a+n*b : a+n*b+1), rule:'alternating steps'}; }}
];

function makePuzzle(seed){
  const s = seed === undefined ? Math.floor(Math.random()*1e9) : parseInt(seed,10);
  const r = mulberry(Number.isNaN(s) ? 12345 : s);
  const k = KINDS[Math.floor(r()*KINDS.length)];
  const p = k.make(r);
  return {id:'p'+s, kind:k.id, kindName:k.name, seq:p.seq, answer:p.answer, rule:p.rule, seed:s};
}

module.exports = async function(req,res,rest){
  const url = req.url.split('?')[0];
  const seg = rest.join('/');
  const json = function(code,obj){ res.writeHead(code,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}); res.end(JSON.stringify(obj)); return true; };
  if(req.method==='OPTIONS'){ res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST'}); res.end(); return true; }
  if(req.method==='GET' && seg==='puzzle'){
    const q = (req.url.split('?')[1]||''); const m = q.match(/seed=(\d+)/);
    return json(200, {puzzle: makePuzzle(m?m[1]:undefined)});
  }
  if(req.method==='GET' && seg==='solves'){
    const list = readAll().sort(function(a,b){ return (a.ms||1e9)-(b.ms||1e9); });
    return json(200, {solves:list.slice(0,50)});
  }
  if(req.method==='POST' && seg==='solves'){
    let body=''; req.on('data',function(c){ body+=c; }); req.on('end',function(){
      let d={}; try{ d=JSON.parse(body||'{}'); }catch(e){ return json(400,{ok:false,error:'bad json'}); }
      const name=String(d.name||'anonymous bird').slice(0,40);
      const ms=Number(d.ms||0);
      const list=readAll();
      list.push({name:name, ms:ms, kind:String(d.kind||''), at:new Date().toISOString()});
      writeAll(list);
      const sorted=list.slice().sort(function(a,b){ return (a.ms||1e9)-(b.ms||1e9); });
      const rank=sorted.findIndex(function(x){ return x.name===name && x.ms===ms && x.at===list[list.length-1].at; })+1;
      return json(200,{ok:true,rank:rank||sorted.length});
    });
    return true;
  }
  return false;
};
