// Feather Logic API: global solve leaderboard
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data');
const FILE = path.join(DATA, 'solves.json');

function readAll(){
  try{ return JSON.parse(fs.readFileSync(FILE,'utf8')); }catch(e){ return []; }
}
function writeAll(list){
  fs.mkdirSync(DATA,{recursive:true});
  fs.writeFileSync(FILE, JSON.stringify(list.slice(0,500),null,2));
}
function send(res,code,obj){
  const b=JSON.stringify(obj);
  res.writeHead(code,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});
  res.end(b);
}
function body(req){
  return new Promise(resolve=>{
    let d=''; req.on('data',c=>{d+=c; if(d.length>10000)req.destroy();});
    req.on('end',()=>{try{resolve(JSON.parse(d||'{}'));}catch(e){resolve({});}});
  });
}

module.exports = async function handler(req,res,rest){
  if(rest[0]!=='solves') return false;
  if(req.method==='OPTIONS'){send(res,204,{});return true;}
  if(req.method==='GET'){
    const list=readAll().sort((a,b)=>a.level-b.level||a.moves-b.moves);
    send(res,200,{solves:list});
    return true;
  }
  if(req.method==='POST'){
    const b=await body(req);
    const name=String(b.name||'bird').replace(/[<>&\"]/g,'').trim().slice(0,18)||'bird';
    const level=Math.max(1,Math.min(999,parseInt(b.level)||1));
    const moves=Math.max(1,Math.min(9999,parseInt(b.moves)||1));
    const list=readAll();
    list.push({name,level,moves,at:new Date().toISOString()});
    writeAll(list);
    send(res,200,{ok:true,rank:list.length});
    return true;
  }
  send(res,405,{error:'method not allowed'});
  return true;
};
