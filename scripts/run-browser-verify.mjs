/**
 * Headless Chrome CDP runner for scripts/verify-mission-phases.html
 */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import {setTimeout as sleep} from 'node:timers/promises';

const PORT = 9222;
const URL = 'http://127.0.0.1:8765/scripts/verify-mission-phases.html';
const PROFILE = '/tmp/chrome-cdp-mission';

function getJson(url){
  return new Promise((resolve,reject)=>{
    http.get(url,res=>{
      let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{resolve(JSON.parse(d))}catch(e){reject(e)}});
    }).on('error',reject);
  });
}

async function waitFor(fn,ms=20000){
  const start=Date.now();
  while(Date.now()-start<ms){
    try{const v=await fn();if(v)return v}catch{}
    await sleep(200);
  }
  throw new Error('timeout waiting for condition');
}

fs.rmSync(PROFILE,{recursive:true,force:true});
fs.mkdirSync(PROFILE,{recursive:true});

const chrome = spawn('google-chrome',[
  '--headless=new','--disable-gpu','--no-sandbox',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--disable-dev-shm-usage',
  URL
],{stdio:['ignore','pipe','pipe']});

let stderr='';
chrome.stderr.on('data',d=>{stderr+=d});

try{
  const version = await waitFor(async()=>{
    try{return await getJson(`http://127.0.0.1:${PORT}/json/version`)}catch{return null}
  },15000);

  // Prefer WebSocket via native fetch + manual CDP is heavy; use /json/list + Runtime via websocket.
  // Node 22+ has WebSocket.
  const targets = await waitFor(async()=>{
    const list=await getJson(`http://127.0.0.1:${PORT}/json/list`);
    return list.find(t=>t.type==='page'&&t.url.includes('verify-mission-phases'))||list.find(t=>t.type==='page');
  },15000);

  const ws = new WebSocket(targets.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});

  let id=0;
  const pending=new Map();
  ws.onmessage=ev=>{
    const msg=JSON.parse(ev.data);
    if(msg.id&&pending.has(msg.id)){
      const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);
      if(msg.error)reject(new Error(JSON.stringify(msg.error)));else resolve(msg.result);
    }
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}));
  });

  await send('Runtime.enable');
  await send('Page.enable');

  const report = await waitFor(async()=>{
    const out=await send('Runtime.evaluate',{
      expression:`document.body.getAttribute('data-phase-report')`,
      returnByValue:true
    });
    const v=out?.result?.value;
    if(!v)return null;
    return JSON.parse(v);
  },25000);

  fs.writeFileSync('/tmp/phase35-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  ws.close();
  chrome.kill('SIGKILL');
  process.exit(report.ok?0:1);
}catch(e){
  console.error('Browser verify failed:', e.message);
  console.error(stderr.slice(-2000));
  chrome.kill('SIGKILL');
  process.exit(2);
}
