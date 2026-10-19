/**
 * Smoke-test production GitHub Pages after Phases 1–5 merge.
 */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import {setTimeout as sleep} from 'node:timers/promises';

const PORT=9340;
const URL=process.argv[2]||'https://golfrecon.app/';
const PROFILE='/tmp/chrome-cdp-prod-smoke';

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
  let id=0;const pending=new Map();const logs=[];
  ws.onmessage=ev=>{
    const msg=JSON.parse(ev.data);
    if(msg.method==='Runtime.consoleAPICalled'){
      const t=msg.params.args?.map(a=>a.value??a.description).join(' ');
      if(t)logs.push(t);
    }
    if(msg.method==='Runtime.exceptionThrown'){
      logs.push('EXC:'+(msg.params.exceptionDetails?.exception?.description||msg.params.exceptionDetails?.text||''));
    }
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

  const report=await waitFor(async()=>{
    const out=await send('Runtime.evaluate',{expression:`(()=>{
      const auth=document.getElementById('authGate');
      const shell=document.getElementById('appShell');
      const nav=[...document.querySelectorAll('.nav-item,[data-view]')].map(el=>el.dataset.view||el.textContent.trim()).filter(Boolean);
      return {
        host:location.hostname,
        title:document.title,
        testActive:!!window.grTestEnvActive,
        banner:!!document.getElementById('grTestEnvBanner'),
        sharedReady:!!window.grSharedRecapReady,
        coreReady:!!window.grMissionCoreReady,
        hasRecap:typeof window.grMissionRecapMarkup==='function',
        hasWar:typeof window.grWarStandings==='function',
        hasGroups:typeof window.groupsView==='function'||typeof window.grGroupsView==='function',
        hasCallPlatoon:typeof window.callPlatoonFunction==='function',
        hasCallImport:typeof window.callImportFunction==='function',
        authVisible:!!(auth&&getComputedStyle(auth).display!=='none'),
        shellPresent:!!shell,
        navHasPregame:nav.some(v=>/pregame/i.test(v)),
        navHasRounds:nav.some(v=>/rounds/i.test(v)),
        navHasGroups:nav.some(v=>/groups|platoon/i.test(v)),
        navHasGame:nav.some(v=>/game/i.test(v)),
        scripts:[...document.scripts].map(s=>(s.src||'').split('/').pop()).filter(Boolean)
      };
    })()`,returnByValue:true});
    const v=out?.result?.value;
    if(!v||!v.coreReady||!v.sharedReady)return null;
    return v;
  },30000);

  // On production, mutating actions must NOT be short-circuited by TEST guards
  // (they may still require auth — that is expected).
  const guardProbe=await send('Runtime.evaluate',{expression:`(async()=>{
    const out={testActive:!!window.grTestEnvActive};
    try{
      await callPlatoonFunction({action:'save_state',snapshot:{}});
      out.saveMessage='accepted';
    }catch(e){
      out.saveMessage=String(e&&e.message||e);
    }
    out.saveNotTestBlocked=!/TEST build/i.test(out.saveMessage||'');
    return out;
  })()`,awaitPromise:true,returnByValue:true});

  const g=guardProbe?.result?.value||{};
  const hardErrors=logs.filter(l=>/^EXC:/.test(l)&&!/favicon|ResizeObserver|mapbox/i.test(l));
  const steps={
    productionHost:report.host==='golfrecon.app',
    testModeOff:!report.testActive&&!report.banner&&!/^\s*\[TEST\]/.test(report.title||''),
    sharedReady:!!report.sharedReady,
    coreReady:!!report.coreReady,
    recapFn:!!report.hasRecap,
    warFn:!!report.hasWar,
    groupsFn:!!report.hasGroups,
    personalNav:report.navHasPregame&&report.navHasRounds&&report.navHasGame,
    platoonsNav:!!report.navHasGroups,
    authOrShell:!!(report.authVisible||report.shellPresent),
    scriptsLoaded:report.scripts.includes('platoon-mission-core.js?v=3')&&report.scripts.includes('platoon-recap-shared.js?v=3')&&report.scripts.includes('platoons-v15-real.js?v=165'),
    writesNotTestBlocked:!!g.saveNotTestBlocked,
    noHardExceptions:hardErrors.length===0
  };

  const result={ok:Object.values(steps).every(Boolean),url:URL,steps,report,guardProbe:g,hardErrors,logs:logs.slice(0,20)};
  fs.writeFileSync('/tmp/prod-smoke-report.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  ws.close();chrome.kill('SIGKILL');
  process.exit(result.ok?0:1);
}catch(e){
  console.error('Production smoke failed:',e.message);
  console.error(stderr.slice(-1500));
  chrome.kill('SIGKILL');
  process.exit(2);
}
