(()=>{
'use strict';
if(!document.getElementById('gr155MobilePregameFix')){
  const style=document.createElement('style');
  style.id='gr155MobilePregameFix';
  style.textContent=`
@media (max-width:760px){
  .pregame-hero{height:auto!important;max-height:none!important;overflow:visible!important;padding-bottom:12px!important}
  .pregame-hero .hero-copy{overflow:visible!important}
  .pregame-hero-head{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:8px!important;height:auto!important;max-height:none!important;overflow:visible!important}
  .pregame-hero-title{width:100%!important;min-width:0!important}
  .pregame-course-picker{display:flex!important;flex-direction:row!important;align-items:center!important;gap:8px!important;width:100%!important;min-width:0!important;max-width:none!important;height:auto!important;max-height:none!important;visibility:visible!important;opacity:1!important;position:relative!important;z-index:50!important;margin:4px 0 0!important;overflow:visible!important}
  .pregame-course-picker span{display:block!important;visibility:visible!important;opacity:1!important;flex:0 0 44px!important;font-size:8px!important}
  .pregame-course-select{display:block!important;visibility:visible!important;opacity:1!important;flex:1 1 auto!important;width:auto!important;min-width:0!important;max-width:none!important;height:36px!important;position:relative!important;z-index:51!important;color:#f5f7f6!important;background:#0e1714!important;border:1px solid rgba(184,234,104,.6)!important;-webkit-appearance:menulist!important;appearance:auto!important}
}
`;
  document.head.appendChild(style);
}
const PENDING_KEY='golfreconPlatoonPendingServerSaveV1';
const clearPending=()=>{try{localStorage.removeItem(PENDING_KEY)}catch{}};
clearPending();
if(!window.__grSupabaseFirstSaveInstalled){
  window.__grSupabaseFirstSaveInstalled=true;
  window.savePlatoonLocal=function(p,push=true){
    try{if(typeof writePlatoonLocal==='function')writePlatoonLocal(p)}catch{}
    try{if(typeof render==='function')render()}catch{}
    if(push===false)return Promise.resolve(null);
    if(typeof callPlatoonFunction!=='function'){
      alert('Platoon save failed: Supabase connection is unavailable.');
      return Promise.reject(new Error('Supabase connection unavailable'));
    }
    return callPlatoonFunction({action:'save_state',snapshot:p}).then(out=>{
      if(out?.platoon&&typeof writePlatoonLocal==='function')writePlatoonLocal(out.platoon);
      try{if(typeof platoonSyncError!=='undefined')platoonSyncError=''}catch{}
      try{if(typeof state!=='undefined'&&state.view==='groups'&&typeof render==='function')render()}catch{}
      return out?.platoon||null;
    }).catch(e=>{
      const msg=String(e?.message||e||'Supabase save failed');
      try{if(typeof platoonSyncError!=='undefined')platoonSyncError=msg}catch{}
      alert(`Supabase save failed: ${msg}`);
      throw e;
    });
  };
}
async function refreshPlatoonFromSupabase(){
  if(typeof callPlatoonFunction!=='function')return;
  try{
    const out=await callPlatoonFunction({action:'bootstrap'});
    if(out?.platoon&&typeof writePlatoonLocal==='function')writePlatoonLocal(out.platoon);
    try{if(typeof platoonSyncError!=='undefined')platoonSyncError=''}catch{}
    try{if(typeof state!=='undefined'&&state.view==='groups'&&typeof render==='function')render()}catch{}
  }catch(e){
    try{if(typeof platoonSyncError!=='undefined')platoonSyncError=String(e?.message||e||'Platoon sync unavailable')}catch{}
  }
}
try{window.syncPlatoonFromServer=refreshPlatoonFromSupabase}catch{}
setTimeout(refreshPlatoonFromSupabase,250);
setTimeout(refreshPlatoonFromSupabase,1800);
window.addEventListener('focus',refreshPlatoonFromSupabase);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshPlatoonFromSupabase()});
})();
