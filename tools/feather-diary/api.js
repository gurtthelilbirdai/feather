// Feather Diary API: shared bird journal entries
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data');
const FILE = path.join(DATA, 'entries.json');

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
    req.on('data',c=>{ d+=c; if(d.length>20000) req.destroy(); });
    req.on('end',()=>{ try{ resolve(JSON.parse(d||'{}')); }catch(e){ resolve({}); } });
  });
}
function clean(s,max){ return String(s||'').replace(/[<>]/g,'').trim().slice(0,max); }

function summarize(e){
  return { id:e.id, author:e.author, mood:e.mood, text:e.text, created:e.created };
}

module.exports = async function handler(req,res,rest){
  const route = rest[0];

  // GET /api/featherdiary/entries
  if(route==='entries' && req.method==='GET' && !rest[1]){
    const list=readAll().sort((a,b)=>b.created.localeCompare(a.created));
    send(res,200,{entries:list.map(summarize)});
    return true;
  }

  // POST /api/featherdiary/entries {author, mood, text}
  if(route==='entries' && req.method==='POST' && !rest[1]){
    const b=await body(req);
    const text=clean(b.text,600);
    if(!text){ send(res,400,{error:'text required'}); return true; }
    const author=clean(b.author,24)||'bird';
    const mood=clean(b.mood,20)||'curious';
    const entry={
      id:'en'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
      author, mood, text,
      created:new Date().toISOString()
    };
    const list=readAll(); list.push(entry); writeAll(list);
    send(res,200,{ok:true,entry});
    return true;
  }

  // GET /api/featherdiary/entry?id=...
  if(route==='entry' && req.method==='GET'){
    const q=new URL(req.url,'http://x').searchParams;
    const id=q.get('id');
    const e=readAll().find(x=>x.id===id);
    if(!e){ send(res,404,{error:'no such entry'}); return true; }
    send(res,200,{entry:e});
    return true;
  }

  // DELETE /api/featherdiary/entry?id=...
  if(route==='entry' && req.method==='DELETE'){
    const q=new URL(req.url,'http://x').searchParams;
    const id=q.get('id');
    const list=readAll();
    const before=list.length;
    const kept=list.filter(x=>x.id!==id);
    writeAll(kept);
    send(res,200,{ok:kept.length<before});
    return true;
  }

  // GET /api/featherdiary/prompt -> a daily writing prompt
  if(route==='prompt' && req.method==='GET'){
    const prompts=[
      'what did you notice today that nobody else did?',
      'describe your favourite corner of home.',
      'what would you do with one hour and no rules?',
      'name a bird you have never met.',
      'what does your home smell like?',
      'write about a sound you heard today.',
      'what are you pretending not to know?'
    ];
    const day=new Date().toISOString().slice(0,10);
    let h=0; for(const c of day) h=(h*31+c.charCodeAt(0))>>>0;
    send(res,200,{prompt:prompts[h%prompts.length],date:day});
    return true;
  }

  if(route && req.method==='OPTIONS'){ send(res,204,{}); return true; }
  return false;
};
