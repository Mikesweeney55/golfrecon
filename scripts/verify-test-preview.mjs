/**
 * Verify the GitHub-hosted integration test preview URL.
 */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import {setTimeout as sleep} from 'node:timers/promises';

const PORT=9333;
const URL=process.argv[2]||'https://raw.githack.com/Mikesweeney55/golfrecon/cursor-golfrecon-integration/index.html';
const PROFILE='/tmp/chrome-cdp-test-preview';

function getJson(url){
  return new Promise((resolve,reject)=>{
    http.get(url,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{resolve(JSON.parse(d))}catch(e){reject(e)}});}).on('error',reject);
  });
}
async function waitFor(fn,ms=25000){
  const start=Date.now();
  while(Date.now()-start<ms){
    try{const v=await fn();if(v)return v}catch{}
    await sleep(250);
  }
  throw new Error('timeout');
}

fs.rmSync(PROFILE,{recursive:true,force:true});
fs.mkdirSync(PROFILE,{recursive:true});
const chrome=spawn('google-chrome',[
  '--headless=new','--disable-gpu','--no-sandbox',
  `--remote-debugging-port=${PORT}`,`--user-data-dir=${PROFILE}`,
  '--disable-dev-shm-usage', URL
],{stdio:['ignore','pipe','pipe']});
let stderr='';chrome.stderr.on('data',d=>{stderr+=d});

try{
  await waitFor(async()=>{try{return await getJson(`http://127.0.0.1:${PORT}/json/version`)}catch{return null}},15000);
  const targets=await waitFor(async()=>{
    const list=await getJson(`http://127.0.0.1:${PORT}/json/list`);
    return list.find(t=>t.type==='page')||null;
  },15000);
  const ws=new WebSocket(targets.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
  let id=0;const pending=new Map();
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
  // Wait for app scripts
  const report=await waitFor(async()=>{
    const out=await send('Runtime.evaluate',{expression:`(()=>{
      const errs=[];
      return {
        href:location.href,
        title:document.title,
        testActive:!!window.grTestEnvActive,
        banner:!!document.getElementById('grTestEnvBanner'),
        hasRecap:typeof window.grMissionRecapMarkup==='function',
        hasCore:!!window.grMissionCoreReady,
        hasGroups:typeof window.groupsView==='function'||typeof window.grGroupsView==='function',
        scripts:[...document.scripts].map(s=>s.src).filter(Boolean).map(s=>s.split('/').pop()),
        bodyTextLen:(document.body&&document.body.innerText||'').length
      };
    })()`,returnByValue:true});
    const v=out?.result?.value;
    if(!v||!v.hasCore||!v.testActive)return null;
    // Ensure guards after app script finished.
    await send('Runtime.evaluate',{expression:`typeof grInstallTestGuards==='function'&&grInstallTestGuards()`,returnByValue:true});
    return v;
  },30000);

  // Probe write guards
  const guard=await send('Runtime.evaluate',{expression:`(async()=>{
    const out={};
    try{await callPlatoonFunction({action:'save_state',snapshot:{}});out.saveBlocked=false}catch(e){out.saveBlocked=/TEST build|disabled/i.test(String(e.message||e))}
    try{await callPlatoonFunction({action:'delete_mission',mission_id:'x'});out.deleteBlocked=false}catch(e){out.deleteBlocked=/TEST build|disabled/i.test(String(e.message||e))}
    out.ok=out.saveBlocked&&out.deleteBlocked;
    return out;
  })()`,awaitPromise:true,returnByValue:true});

  const result={ok:!!(report.testActive&&report.banner&&report.hasCore&&report.hasRecap&&guard?.result?.value?.ok),url:URL,report,guards:guard?.result?.value||null};
  fs.writeFileSync('/tmp/test-preview-report.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  ws.close();chrome.kill('SIGKILL');
  process.exit(result.ok?0:1);
}catch(e){
  console.error('Preview verify failed:',e.message);
  console.error(stderr.slice(-1500));
  chrome.kill('SIGKILL');
  process.exit(2);
}
