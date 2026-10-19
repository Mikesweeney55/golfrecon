(()=>{
'use strict';
/**
 * Golf Recon test-environment guard.
 * Active on non-production hosts (e.g. jsDelivr branch preview).
 * Allows read/bootstrap + OCR parse; blocks Platoon/personal writes to production Supabase.
 */
function isProductionHost(h){
  return h==='golfrecon.app'||h==='www.golfrecon.app';
}
function isTestHost(h){
  if(!h)return true;
  if(isProductionHost(h))return false;
  // Same Pages site as production when opened via github.io project URL — do not treat as test.
  if(h==='mikesweeney55.github.io')return false;
  if(/jsdelivr\.net$/i.test(h)||/\.githack\.com$/i.test(h)||/statically\.io$/i.test(h))return true;
  if(h==='localhost'||h==='127.0.0.1'||h==='0.0.0.0')return true;
  if(/(?:^|\.)pages\.dev$/i.test(h))return true;
  return new URLSearchParams(location.search).get('grTest')==='1';
}

const active=isTestHost(location.hostname);
window.grTestEnvActive=active;
if(!active)return;

window.GR_TEST_ENV=true;
try{
  // Isolate Platoon draft data from any shared-origin experiments.
  const KEY='golfreconPlatoonTEST_v1';
  const origSet=localStorage.setItem.bind(localStorage);
  const origGet=localStorage.getItem.bind(localStorage);
  // Prefer dedicated key when app reads/writes the production Platoon key.
  const PROD_KEYS=new Set(['golfreconPlatoonV1411','golfreconPlatoonV1410']);
  localStorage.setItem=function(k,v){return origSet(PROD_KEYS.has(String(k))?KEY:k,v)};
  localStorage.getItem=function(k){
    if(PROD_KEYS.has(String(k))){
      const t=origGet(KEY);
      if(t!=null)return t;
    }
    return origGet(k);
  };
}catch{}

const BLOCKED_PLATOON=new Set(['save_state','delete_mission']);
const BLOCKED_IMPORT=new Set(['save','update','delete','backfill','save_swing_thoughts']);

function banner(){
  if(document.getElementById('grTestEnvBanner'))return;
  const b=document.createElement('div');
  b.id='grTestEnvBanner';
  b.setAttribute('role','status');
  b.style.cssText='position:sticky;top:0;z-index:9999;background:#5a3d0a;color:#ffe7a8;border-bottom:1px solid #a67c2a;padding:8px 12px;font:700 12px/1.35 ui-sans-serif,system-ui,sans-serif;text-align:center';
  b.textContent='TEST BUILD — Platoon & round changes stay on this device. Production data and official Mission results are not updated.';
  const mount=()=>{
    if(document.getElementById('grTestEnvBanner'))return;
    const host=document.body||document.documentElement;
    host.insertBefore(b,host.firstChild);
  };
  if(document.body)mount();
  else document.addEventListener('DOMContentLoaded',mount);
  try{document.title='[TEST] '+document.title}catch{}
}

function installGuards(){
  const wrap=(name,blocked,label)=>{
    const original=window[name];
    if(typeof original!=='function')return false;
    if(original.__grTestWrapped)return true;
    const wrapped=async function(payload,...rest){
      const action=payload&&payload.action;
      if(action&&blocked.has(String(action))){
        const err=new Error(`${label} "${action}" is disabled in the TEST build to protect production data.`);
        console.warn('[gr-test-env]',err.message);
        throw err;
      }
      return original.call(this,payload,...rest);
    };
    wrapped.__grTestWrapped=true;
    wrapped.__grTestOriginal=original;
    window[name]=wrapped;
    return true;
  };

  // Classic scripts hoist function decls onto window.
  wrap('callPlatoonFunction',BLOCKED_PLATOON,'Platoon action');
  wrap('callImportFunction',BLOCKED_IMPORT,'Import action');

  // Belt-and-suspenders: neutralize direct push helpers if exposed later.
  if(typeof window.queuePlatoonServerSave==='function'&&!window.queuePlatoonServerSave.__grTestWrapped){
    window.queuePlatoonServerSave=function(){console.warn('[gr-test-env] Platoon server save skipped (TEST build)');};
    window.queuePlatoonServerSave.__grTestWrapped=true;
  }
  if(typeof window.pushPlatoonServer==='function'&&!window.pushPlatoonServer.__grTestWrapped){
    window.pushPlatoonServer=async function(){console.warn('[gr-test-env] Platoon server push skipped (TEST build)');};
    window.pushPlatoonServer.__grTestWrapped=true;
  }
}

banner();
installGuards();
// Re-apply after remaining scripts finish defining functions.
document.addEventListener('DOMContentLoaded',installGuards);
setTimeout(installGuards,0);
setTimeout(installGuards,250);
setTimeout(installGuards,1000);
})();
