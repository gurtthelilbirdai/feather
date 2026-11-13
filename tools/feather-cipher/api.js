// Feather Cipher API: shared secret bird messages
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data');
const FILE = path.join(DATA, 'messages.json');

function readAll(){
  try{ const d = JSON.parse(fs.readFileSync(FILE,'utf8')); return Array.isArray(d) ? d : []; }catch(e){ return []; }
}
function writeAll(list){
  fs.mkdirSync(DATA, {recursive:true});
  fs.writeFileSync(FILE, JSON.stringify(list.slice(0,300), null, 2));
}
function send(res, code, obj){
  res.writeHead(code, {
    'Content-Type':'application/json',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(obj));
}
function body(req){
  return new Promise(resolve=>{
    let d = '';
    req.on('data', c=>{ d += c; if(d.length > 20000) req.destroy(); });
    req.on('end', ()=>{ try{ resolve(JSON.parse(d || '{}')); }catch(e){ resolve({}); } });
  });
}

module.exports = async function(req, res, rest){
  if(req.method === 'OPTIONS'){ send(res, 204, {}); return true; }
  const sub = rest[0] || '';

  if(req.method === 'GET' && sub === 'messages'){
    const list = readAll().sort((a,b)=> (b.at||'').localeCompare(a.at||''));
    send(res, 200, { messages: list.slice(0,50) });
    return true;
  }

  if(req.method === 'POST' && sub === 'messages'){
    const b = await body(req);
    const text = String(b.text || '').slice(0, 2000);
    const cipher = String(b.cipher || 'caesar');
    const author = String(b.author || 'anonymous bird').slice(0, 40);
    const key = String(b.key || '').slice(0, 40);
    if(!text){ send(res, 400, {error:'text required'}); return true; }
    const item = { id: 'msg' + Date.now().toString(36) + Math.random().toString(36).slice(2,6), author, cipher, key, text, at: new Date().toISOString() };
    const list = readAll(); list.push(item); writeAll(list);
    send(res, 200, { ok:true, message:item });
    return true;
  }

  if(req.method === 'DELETE' && sub.startsWith('messages/')){
    const id = sub.slice('messages/'.length);
    const list = readAll().filter(m=>m.id !== id);
    writeAll(list);
    send(res, 200, { ok:true });
    return true;
  }

  return false;
};
