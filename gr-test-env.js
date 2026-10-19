(()=>{
'use strict';
/**
 * Golf Recon test-environment guard.
 * Active on non-production hosts. Blocks Platoon/personal writes to production Supabase.
 */
function isProductionHost(h){
  return h==='golfrecon.app'||h==='www.golfrecon.app';
}
function isTestHost(h){
  if(!h)return true;
  if(isProductionHost(h))return false;
  // Production mirror on project Pages URL — do not treat as test.
  if(h==='mikesweeney55.github.io'&&/^\/golfrecon(?:\/|$)/.test(location.pathname||'/'))return false;
  if(new URLSearchParams(location.search).get('grTest')==='0')return false;
  if(new URLSearchParams(location.search).get('grTest')==='1')return true;
  if(/jsdelivr\.net$/i.test(h)||/\.githack\.com$/i.test(h)||/statically\.io$/i.test(h))return true;
  if(h==='localhost'||h==='127.0.0.1'||h==='0.0.0.0')return true;
  if(/(?:^|\.)pages\.dev$/i.test(h)||/(?:^|\.)trycloudflare\.com$/i.test(h))return true;
  if(h.endsWith('.github.io'))return true;
  return true;
}

const active=isTestHost(location.hostname);
window.grTestEnvActive=active;
if(!active){
  window.grInstallTestGuards=function(){};
  return;
}

window.GR_TEST_ENV=true;

try{
  const KEY='golfreconPlatoonTEST_v1';
  const origSet=Storage.prototype.setItem;
  const origGet=Storage.prototype.getItem;
  const PROD_KEYS=new Set(['golfreconPlatoonV1411','golfreconPlatoonV1410']);
  Storage.prototype.setItem=function(k,v){
    if(this===localStorage&&PROD_KEYS.has(String(k)))return origSet.call(this,KEY,v);
    return origSet.call(this,k,v);
  };
  Storage.prototype.getItem=function(k){
    if(this===localStorage&&PROD_KEYS.has(String(k))){
      const t=origGet.call(this,KEY);
      if(t!=null)return t;
    }
    return origGet.call(this,k);
  };
}catch{}

const BLOCKED_PLATOON=new Set(['save_state','delete_mission']);
const BLOCKED_IMPORT=new Set(['save','update','delete','backfill','save_swing_thoughts']);

function ensureBanner(){
  let b=document.getElementById('grTestEnvBanner');
  if(!b){
    b=document.createElement('div');
    b.id='grTestEnvBanner';
    b.setAttribute('role','status');
    b.textContent='TEST BUILD — Platoon & round changes stay on this device. Production data and official Mission results are not updated.';
    b.style.cssText='position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#5a3d0a;color:#ffe7a8;border-bottom:1px solid #a67c2a;padding:8px 12px;font:700 12px/1.35 ui-sans-serif,system-ui,sans-serif;text-align:center;pointer-events:none';
    (document.body||document.documentElement).appendChild(b);
    try{document.documentElement.style.scrollPaddingTop='42px'}catch{}
  }
  if(!/^\s*\[TEST\]/.test(document.title)){
    try{document.title='[TEST] '+document.title.replace(/^\s*\[TEST\]\s*/,'')}catch{}
  }
}

function wrap(name,blocked,label){
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
    return original.apply(this, [payload, ...rest]);
  };
  wrapped.__grTestWrapped=true;
  wrapped.__grTestOriginal=original;
  try{window[name]=wrapped}catch{}
  try{
    // Some engines keep a global lexical binding for function decls; redefine when possible.
    // eslint-disable-next-line no-eval
    eval(`var ${name} = window.${name};`);
  }catch{}
  return true;
}

function installGuards(){
  ensureBanner();
  wrap('callPlatoonFunction',BLOCKED_PLATOON,'Platoon action');
  wrap('callImportFunction',BLOCKED_IMPORT,'Import action');
  if(typeof window.queuePlatoonServerSave==='function'&&!window.queuePlatoonServerSave.__grTestWrapped){
    const noop=function(){console.warn('[gr-test-env] Platoon server save skipped (TEST build)');};
    noop.__grTestWrapped=true;
    window.queuePlatoonServerSave=noop;
  }
  if(typeof window.pushPlatoonServer==='function'&&!window.pushPlatoonServer.__grTestWrapped){
    const noop=async function(){console.warn('[gr-test-env] Platoon server push skipped (TEST build)');};
    noop.__grTestWrapped=true;
    window.pushPlatoonServer=noop;
  }
  return !!(window.callPlatoonFunction&&window.callPlatoonFunction.__grTestWrapped);
}

window.grInstallTestGuards=installGuards;
ensureBanner();
document.addEventListener('DOMContentLoaded',installGuards);
setTimeout(installGuards,0);
setTimeout(installGuards,100);
setTimeout(installGuards,500);
setTimeout(installGuards,1500);
})();
