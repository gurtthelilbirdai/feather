// Feather Scribe API: collaborative bird stories
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data');
const FILE = path.join(DATA, 'stories.json');

function readAll(){
  try{ const d=JSON.parse(fs.readFileSync(FILE,'utf8')); return Array.isArray(d)?d:[]; }catch(e){ return []; }
}
function writeAll(list){
  fs.mkdirSync(DATA,{recursive:true});
  fs.writeFileSync(FILE, JSON.stringify(list.slice(0,300),null,2));
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

function summarize(st){
  return {
    id:st.id, title:st.title, author:st.author,
    lines:st.lines.length, words:st.lines.join(' ').split(/\s+/).filter(Boolean).length,
    finished:st.finished, updated:st.updated
  };
}

module.exports = async function handler(req,res,rest){
  const route = rest[0];

  // GET /api/featherscribe/stories
  if(route==='stories' && req.method==='GET' && !rest[1]){
    const list=readAll().sort((a,b)=>b.updated.localeCompare(a.updated));
    send(res,200,{stories:list.map(summarize)});
    return true;
  }

  // POST /api/featherscribe/stories  {title, author}
  if(route==='stories' && req.method==='POST' && !rest[1]){
    const b=await body(req);
    const title=clean(b.title,60);
    if(!title){ send(res,400,{error:'title required'}); return true; }
    const author=clean(b.author,24)||'bird';
    const list=readAll();
    const st={
      id:'st'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
      title, author,
      lines:[`The story begins, written by ${author}.`],
      finished:false,
      created:new Date().toISOString(),
      updated:new Date().toISOString()
    };
    list.push(st); writeAll(list);
    send(res,200,{ok:true,story:st});
    return true;
  }

  // GET /api/featherscribe/story?id=...
  if(route==='story' && req.method==='GET'){
    const q=new URL(req.url,'http://x').searchParams;
    const id=q.get('id');
    const st=readAll().find(s=>s.id===id);
    if(!st){ send(res,404,{error:'no such story'}); return true; }
    send(res,200,{story:st});
    return true;
  }

  // POST /api/featherscribe/line {id, author, text}
  if(route==='line' && req.method==='POST'){
    const b=await body(req);
    const text=clean(b.text,400);
    if(!text){ send(res,400,{error:'text required'}); return true; }
    const list=readAll();
    const st=list.find(s=>s.id===b.id);
    if(!st){ send(res,404,{error:'no such story'}); return true; }
    if(st.finished){ send(res,409,{error:'story already finished'}); return true; }
    const author=clean(b.author,24)||'bird';
    st.lines.push(`${author}: ${text}`);
    st.updated=new Date().toISOString();
    writeAll(list);
    send(res,200,{ok:true,story:st});
    return true;
  }

  // POST /api/featherscribe/finish {id}
  if(route==='finish' && req.method==='POST'){
    const b=await body(req);
    const list=readAll();
    const st=list.find(s=>s.id===b.id);
    if(!st){ send(res,404,{error:'no such story'}); return true; }
    st.finished=true;
    st.updated=new Date().toISOString();
    writeAll(list);
    send(res,200,{ok:true,story:st});
    return true;
  }

  if(route && req.method==='OPTIONS'){ send(res,204,{}); return true; }
  return false;
};
