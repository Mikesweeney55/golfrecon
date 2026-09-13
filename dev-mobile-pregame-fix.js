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

// Platoons: Supabase is authoritative. Local storage is only an immediate UI cache.
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
      try{if(typeof platoonSyncError!=='undefined')platoonSyncError=String(e?.message||e||'Supabase save failed')}catch{}
      alert('Supabase save failed. This change has not been confirmed on the server. Please retry.');
      throw e;
    });
  };
}

function mergeLocalHoleDetails(server,local){
  if(!server||!local)return {snapshot:server,changed:false};
  const merged=JSON.parse(JSON.stringify(server)),localMissions=Array.isArray(local.missions)?local.missions:[];
  let changed=false;
  for(const sm of (merged.missions||[])){
    const lm=localMissions.find(x=>String(x.id||'')===String(sm.id||''));if(!lm)continue;
    const localRows=Array.isArray(lm.results)?lm.results:[],serverRows=Array.isArray(sm.results)?sm.results:[];
    for(const lr of localRows){
      if(!Array.isArray(lr?.holes)||!lr.holes.length)continue;
      const sr=serverRows.find(r=>String(r?.player_name||'').trim().toLowerCase()===String(lr?.player_name||'').trim().toLowerCase());if(!sr)continue;
      const lt=Date.parse(lr.hole_detail_saved_at||0)||0,st=Date.parse(sr.hole_detail_saved_at||0)||0;
      if(!Array.isArray(sr.holes)||!sr.holes.length||lt>st){sr.holes=lr.holes;sr.hole_detail_saved_at=lr.hole_detail_saved_at||new Date().toISOString();sr.hole_detail_source_count=lr.hole_detail_source_count||null;changed=true}
    }
  }
  return {snapshot:merged,changed};
}
async function refreshPlatoonFromSupabase(){
  if(typeof callPlatoonFunction!=='function'||typeof loadPlatoonLocal!=='function')return;
  try{
    const local=loadPlatoonLocal();
    const out=await callPlatoonFunction({action:'bootstrap',snapshot:local});
    if(!out?.platoon)return;
    const merged=mergeLocalHoleDetails(out.platoon,local);
    if(merged.changed){
      const saved=await callPlatoonFunction({action:'save_state',snapshot:merged.snapshot});
      if(saved?.platoon&&typeof writePlatoonLocal==='function')writePlatoonLocal(saved.platoon);
    }else if(typeof writePlatoonLocal==='function')writePlatoonLocal(out.platoon);
    try{if(typeof state!=='undefined'&&state.view==='groups'&&typeof render==='function')render()}catch{}
  }catch(e){try{if(typeof platoonSyncError!=='undefined')platoonSyncError=String(e?.message||e||'Platoon sync unavailable')}catch{}}
}
setTimeout(refreshPlatoonFromSupabase,900);
window.addEventListener('focus',refreshPlatoonFromSupabase);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshPlatoonFromSupabase()});
})();
