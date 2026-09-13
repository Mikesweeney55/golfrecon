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
.gr-roster-list{display:grid;gap:8px;margin-top:8px}.gr-roster-row{display:grid;grid-template-columns:minmax(120px,.8fr) minmax(180px,1.4fr);gap:8px;align-items:end}.gr-roster-row label{margin-top:0}.gr-roster-help{font-size:10px;color:var(--muted);line-height:1.35;margin-top:5px}.gr-recon-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.gr-recon-card{border:1px solid var(--line);background:#101914;border-radius:12px;padding:10px}.gr-recon-card span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.07em}.gr-recon-card strong{display:block;margin-top:3px;font-size:13px}.gr-recon-list{display:grid;gap:6px;margin-top:10px}.gr-recon-line{font-size:11px;line-height:1.35;color:#dce6e1;padding:8px 9px;border-left:2px solid rgba(184,234,104,.45);background:rgba(255,255,255,.025);border-radius:0 8px 8px 0}@media(max-width:700px){.gr-roster-row{grid-template-columns:1fr}.gr-recon-grid{grid-template-columns:1fr 1fr}}
`;
  document.head.appendChild(style);
}

const PENDING_KEY='golfreconPlatoonPendingServerSaveV1';
const clone=v=>{try{return JSON.parse(JSON.stringify(v))}catch{return null}};
const getPending=()=>{try{return JSON.parse(localStorage.getItem(PENDING_KEY)||'null')}catch{return null}};
const setPending=p=>{try{localStorage.setItem(PENDING_KEY,JSON.stringify(p))}catch{}};
const clearPending=()=>{try{localStorage.removeItem(PENDING_KEY)}catch{}};
const startupLocal=(()=>{try{return clone(typeof loadPlatoonLocal==='function'?loadPlatoonLocal():null)}catch{return null}})();

function norm(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function aliasArray(m){
  if(Array.isArray(m?.aliases))return [...new Set(m.aliases.map(x=>String(x||'').trim()).filter(Boolean))];
  if(typeof m?.aliases==='string')return [...new Set(m.aliases.split(/[,|]/).map(x=>x.trim()).filter(Boolean))];
  return [];
}
const DEFAULT_ALIASES={
  mike:['Mike','Mike S.','Sweeney'],
  ryan:['Ryan','Ryan S.','Sully'],
  steve:['Steve','Stephen'],
  charlie:['Charlie','Chuck'],
  kevin:['Kevin','Kevin C.','Cunny'],
  josh:['Josh','Joshua','Mannke']
};
function seededAliases(m){
  const own=aliasArray(m);if(own.length)return own;
  const first=norm(m?.name).split(' ')[0];return DEFAULT_ALIASES[first]?[...DEFAULT_ALIASES[first]]:[];
}
function mergeClientAliases(server,local){
  if(!server||!local)return server;
  const out=clone(server),lm=Array.isArray(local.members)?local.members:[];
  for(const sm of (out.members||[])){
    const src=lm.find(x=>String(x.id||'')===String(sm.id||''))||lm.find(x=>norm(x.name)===norm(sm.name));
    if(src&&seededAliases(src).length)sm.aliases=seededAliases(src);
  }
  return out;
}
function canonicalMember(p,raw){
  const n=norm(raw);if(!n)return null;
  const hits=[];
  for(const m of (p?.members||[])){
    const vals=[m.name,...seededAliases(m)].map(norm).filter(Boolean);
    if(vals.includes(n))hits.push(m);
  }
  if(hits.length===1)return hits[0];
  const first=n.split(' ')[0];
  const firstHits=(p?.members||[]).filter(m=>norm(m.name).split(' ')[0]===first);
  return firstHits.length===1?firstHits[0]:null;
}
function displayPlayer(p,raw){return canonicalMember(p,raw)?.name||raw||'Player'}
function rosterContext(p,m){
  const ids=new Set(Array.isArray(m?.participants)?m.participants:[]);
  return (p?.members||[]).filter(x=>!ids.size||ids.has(x.id)).map(x=>({id:x.id,name:x.name,aliases:seededAliases(x)}));
}

// Platoons: Supabase is authoritative. Local storage is only an immediate UI cache.
// Every change is also kept in a tiny pending queue until Supabase confirms the save.
if(!window.__grSupabaseFirstSaveInstalled){
  window.__grSupabaseFirstSaveInstalled=true;
  window.savePlatoonLocal=function(p,push=true){
    try{if(typeof writePlatoonLocal==='function')writePlatoonLocal(p)}catch{}
    try{if(typeof render==='function')render()}catch{}
    if(push===false)return Promise.resolve(null);
    setPending(p);
    if(typeof callPlatoonFunction!=='function'){
      alert('Platoon save failed: Supabase connection is unavailable.');
      return Promise.reject(new Error('Supabase connection unavailable'));
    }
    const localSnapshot=clone(p);
    return callPlatoonFunction({action:'save_state',snapshot:p}).then(out=>{
      if(out?.platoon){
        const merged=mergeClientAliases(out.platoon,localSnapshot);
        if(typeof writePlatoonLocal==='function')writePlatoonLocal(merged);
        clearPending();
      }
      try{if(typeof platoonSyncError!=='undefined')platoonSyncError=''}catch{}
      try{if(typeof state!=='undefined'&&state.view==='groups'&&typeof render==='function')render()}catch{}
      return out?.platoon||null;
    }).catch(e=>{
      try{if(typeof platoonSyncError!=='undefined')platoonSyncError=String(e?.message||e||'Supabase save failed')}catch{}
      alert('Supabase save failed. The change is queued on this device and will retry when Golf Recon reconnects.');
      throw e;
    });
  };
}

function mergeLocalHoleDetails(server,local){
  if(!server||!local)return {snapshot:server,changed:false};
  const merged=clone(server),localMissions=Array.isArray(local.missions)?local.missions:[];
  let changed=false;
  for(const sm of (merged?.missions||[])){
    const lm=localMissions.find(x=>String(x.id||'')===String(sm.id||''));if(!lm)continue;
    const localRows=Array.isArray(lm.results)?lm.results:[],serverRows=Array.isArray(sm.results)?sm.results:[];
    for(const lr of localRows){
      if(!Array.isArray(lr?.holes)||!lr.holes.length)continue;
      const sr=serverRows.find(r=>String(r?.player_name||'').trim().toLowerCase()===String(lr?.player_name||'').trim().toLowerCase());if(!sr)continue;
      const lt=Date.parse(lr.hole_detail_saved_at||0)||0,st=Date.parse(sr.hole_detail_saved_at||0)||0;
      if(!Array.isArray(sr.holes)||!sr.holes.length||lt>st){
        sr.holes=clone(lr.holes);
        sr.hole_detail_saved_at=lr.hole_detail_saved_at||new Date().toISOString();
        sr.hole_detail_source_count=lr.hole_detail_source_count||null;
        sr.hole_detail_source_name=lr.hole_detail_source_name||null;
        sr.hole_detail_canonical_id=lr.hole_detail_canonical_id||null;
        changed=true;
      }
    }
  }
  return {snapshot:mergeClientAliases(merged,local),changed};
}

async function refreshPlatoonFromSupabase(){
  if(typeof callPlatoonFunction!=='function'||typeof loadPlatoonLocal!=='function')return;
  try{
    const pending=getPending();
    if(pending){
      const saved=await callPlatoonFunction({action:'save_state',snapshot:pending});
      if(saved?.platoon){if(typeof writePlatoonLocal==='function')writePlatoonLocal(mergeClientAliases(saved.platoon,pending));clearPending()}
      try{if(typeof state!=='undefined'&&state.view==='groups'&&typeof render==='function')render()}catch{}
      return;
    }

    const localNow=loadPlatoonLocal();
    const recoverySource=startupLocal||localNow;
    const out=await callPlatoonFunction({action:'bootstrap',snapshot:recoverySource||{}});
    if(!out?.platoon)return;

    const merged=mergeLocalHoleDetails(out.platoon,recoverySource);
    if(merged.changed){
      setPending(merged.snapshot);
      const saved=await callPlatoonFunction({action:'save_state',snapshot:merged.snapshot});
      if(saved?.platoon){if(typeof writePlatoonLocal==='function')writePlatoonLocal(mergeClientAliases(saved.platoon,merged.snapshot));clearPending()}
    }else if(typeof writePlatoonLocal==='function')writePlatoonLocal(mergeClientAliases(out.platoon,recoverySource));

    try{if(typeof platoonSyncError!=='undefined')platoonSyncError=''}catch{}
    try{if(typeof state!=='undefined'&&state.view==='groups'&&typeof render==='function')render()}catch{}
  }catch(e){
    try{if(typeof platoonSyncError!=='undefined')platoonSyncError=String(e?.message||e||'Platoon sync unavailable')}catch{}
  }
}

function cleanHoles(holes){
  const map=new Map();for(const h of (Array.isArray(holes)?holes:[])){const hole=Number(h?.hole);if(!Number.isInteger(hole)||hole<1||hole>18)continue;map.set(hole,{hole,par:Number.isFinite(Number(h?.par))?Number(h.par):null,score:Number.isFinite(Number(h?.score))?Number(h.score):null})}return [...map.values()].sort((a,b)=>a.hole-b.hole)
}
function holeSig(holes){return cleanHoles(holes).map(h=>`${h.hole}:${h.par??''}:${h.score??''}`).join('|')}
function statsFor(r){
  const holes=cleanHoles(r?.holes).filter(h=>Number.isFinite(h.score));
  const birds=holes.filter(h=>Number.isFinite(h.par)&&h.score===h.par-1),eagles=holes.filter(h=>Number.isFinite(h.par)&&h.score<=h.par-2),pars=holes.filter(h=>Number.isFinite(h.par)&&h.score===h.par),dbl=holes.filter(h=>Number.isFinite(h.par)&&h.score>=h.par+2);
  const worst=[...holes].filter(h=>Number.isFinite(h.par)).sort((a,b)=>(b.score-b.par)-(a.score-a.par))[0]||null;
  const back=holes.filter(h=>h.hole>=10).reduce((s,h)=>s+h.score,0),backN=holes.filter(h=>h.hole>=10).length;
  return {holes,birds,eagles,pars,dbl,worst,back:backN===9?back:null};
}
function enhancedSummaryMarkup(p,m){
  const rows=Array.isArray(m?.results)?m.results:[];
  if(!rows.length)return '<div class="gr155-recap">No Mission results yet.</div>';
  const sorted=[...rows].sort((a,b)=>(Number(a.finish_position)||999)-(Number(b.finish_position)||999)||((Number(a.net)||999)-(Number(b.net)||999)));
  const net=[...rows].filter(r=>Number.isFinite(Number(r.net))).sort((a,b)=>Number(a.net)-Number(b.net));
  const gross=[...rows].filter(r=>Number.isFinite(Number(r.gross))).sort((a,b)=>Number(a.gross)-Number(b.gross));
  const pts=[...rows].filter(r=>Number.isFinite(Number(r.raw_points))).sort((a,b)=>Number(b.raw_points)-Number(a.raw_points));
  const detail=rows.map(r=>({r,s:statsFor(r)}));
  const birdLead=[...detail].sort((a,b)=>b.s.birds.length-a.s.birds.length)[0];
  const clean=[...detail].filter(x=>x.s.holes.length).sort((a,b)=>a.s.dbl.length-b.s.dbl.length)[0];
  const back=[...detail].filter(x=>x.s.back!=null).sort((a,b)=>a.s.back-b.s.back)[0];
  const lines=[];
  if(net[0]){const margin=net[1]?Number(net[1].net)-Number(net[0].net):null;lines.push(`${displayPlayer(p,net[0].player_name)} won low net at ${Number(net[0].net)}${margin>0?`, ${margin} shot${margin===1?'':'s'} clear`:''}.`)}
  if(gross[0])lines.push(`${displayPlayer(p,gross[0].player_name)} had low gross at ${Number(gross[0].gross)}.`);
  if(birdLead&&birdLead.s.birds.length){const hs=birdLead.s.birds.map(h=>h.hole).join(', ');lines.push(`${displayPlayer(p,birdLead.r.player_name)} led the birdies with ${birdLead.s.birds.length}${hs?` (holes ${hs})`:''}.`)}
  if(clean&&clean.s.holes.length)lines.push(`${displayPlayer(p,clean.r.player_name)} kept the card cleanest with ${clean.s.dbl.length} double-or-worse hole${clean.s.dbl.length===1?'':'s'}.`);
  if(back)lines.push(`${displayPlayer(p,back.r.player_name)} posted the best back nine at ${back.s.back}.`);
  const blowups=detail.filter(x=>x.s.dbl.length).sort((a,b)=>b.s.dbl.length-a.s.dbl.length)[0];
  if(blowups&&blowups.s.dbl.length>=2)lines.push(`${displayPlayer(p,blowups.r.player_name)} had ${blowups.s.dbl.length} double-or-worse holes — the biggest damage area of the round.`);
  const table=sorted.map((r,i)=>`<tr><td>${Number.isFinite(Number(r.finish_position))?Number(r.finish_position):i+1}</td><td>${displayPlayer(p,r.player_name)}</td><td>${Number.isFinite(Number(r.net))?Number(r.net):'—'}</td><td>${Number.isFinite(Number(r.gross))?Number(r.gross):'—'}</td><td>${Number.isFinite(Number(r.raw_points))?Number(r.raw_points):'—'}</td></tr>`).join('');
  const cards=[net[0]?`<div class="gr-recon-card"><span>Low Net</span><strong>${displayPlayer(p,net[0].player_name)} · ${Number(net[0].net)}</strong></div>`:'',gross[0]?`<div class="gr-recon-card"><span>Low Gross</span><strong>${displayPlayer(p,gross[0].player_name)} · ${Number(gross[0].gross)}</strong></div>`:'',pts[0]&&Number(pts[0].raw_points)>0?`<div class="gr-recon-card"><span>Points Leader</span><strong>${displayPlayer(p,pts[0].player_name)} · ${Number(pts[0].raw_points)}</strong></div>`:'',birdLead&&birdLead.s.birds.length?`<div class="gr-recon-card"><span>Birdies</span><strong>${displayPlayer(p,birdLead.r.player_name)} · ${birdLead.s.birds.length}</strong></div>`:''].filter(Boolean).join('');
  return `<div class="gr155-results-wrap"><table class="gr155-results-table"><thead><tr><th>Pos</th><th>Player</th><th>Net</th><th>Gross</th><th>Pts</th></tr></thead><tbody>${table}</tbody></table>${cards?`<div class="gr-recon-grid">${cards}</div>`:''}<div class="gr-recon-list">${lines.map(x=>`<div class="gr-recon-line">${x}</div>`).join('')}</div></div>`;
}

function installRosterAndReconPatch(){
  if(window.__grRosterReconPatchInstalled)return;window.__grRosterReconPatchInstalled=true;
  const originalSetup=window.grOpenSetup;
  window.grOpenSetup=()=>{
    const p=typeof loadPlatoonLocal==='function'?loadPlatoonLocal():null;if(!p||typeof platoonDialog!=='function'){if(originalSetup)return originalSetup();return}
    const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
    const d=platoonDialog(`<div class="dialog-head"><div><div class="eyebrow">PLATOON</div><h2>Setup</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div><label>Name<input id="grRRName" value="${esc(p.name||'')}"></label><label>Motto<input id="grRRMotto" value="${esc(p.motto||'')}"></label><div class="grid two"><label>Season<input id="grRRSeason" type="number" value="${esc(p.season||new Date().getFullYear())}"></label><label>Visibility<select id="grRRVis"><option ${p.visibility==='Private'?'selected':''}>Private</option><option ${p.visibility==='Invite only'?'selected':''}>Invite only</option></select></label></div><div style="margin-top:16px"><div class="eyebrow">MASTER ROSTER</div><div class="gr-roster-help">Chief-editable names and aliases used to recognize players in result and scorecard screenshots. Separate aliases with commas.</div><div id="grRRRows" class="gr-roster-list"></div><button class="button secondary" id="grRRAdd" type="button" style="margin-top:8px">+ Add Player</button></div><div class="dialog-actions"><button class="button secondary" type="button" onclick="closePlatoonDialog()">Cancel</button><button class="button primary" id="grRRSave" type="button">Save Platoon</button></div>`);
    const rows=d.querySelector('#grRRRows');
    const draw=()=>{rows.innerHTML=(p.members||[]).map((m,i)=>`<div class="gr-roster-row" data-i="${i}"><label>Name<input data-rname value="${esc(m.name||'')}"></label><label>Recognize as<input data-ralias value="${esc(seededAliases(m).join(', '))}" placeholder="Ryan, Ryan S., Sully"></label></div>`).join('')};draw();
    d.querySelector('#grRRAdd').onclick=()=>{p.members=p.members||[];p.members.push({id:'cadet-'+Date.now(),name:'',aliases:[],linked:false,role:'cadet'});draw()};
    d.querySelector('#grRRSave').onclick=async()=>{
      p.name=d.querySelector('#grRRName').value.trim()||'My Time';p.motto=d.querySelector('#grRRMotto').value.trim();p.season=Number(d.querySelector('#grRRSeason').value)||new Date().getFullYear();p.visibility=d.querySelector('#grRRVis').value;
      [...rows.querySelectorAll('.gr-roster-row')].forEach(row=>{const i=Number(row.dataset.i),m=p.members[i];if(!m)return;m.name=row.querySelector('[data-rname]').value.trim()||m.name||'Cadet';m.aliases=row.querySelector('[data-ralias]').value.split(',').map(x=>x.trim()).filter(Boolean)});
      try{await Promise.resolve(savePlatoonLocal(p));d.close();alert('Platoon master roster saved.')}catch{}
    };
  };

  function openRosterHoleImport(id){
    const p=loadPlatoonLocal(),m=(p.missions||[]).find(x=>x.id===id);if(!m||typeof platoonDialog!=='function'||typeof callPlatoonFunction!=='function'||typeof platoonFilePayload!=='function')return;
    const locked=clone(Array.isArray(m.results)?m.results:[]),d=platoonDialog(`<div class="dialog-head"><div><div class="eyebrow">HOLE-BY-HOLE DETAIL</div><h2>${m.title||m.locationName||'Mission'}</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div><label class="upload-zone" style="cursor:pointer"><strong>Add player scorecard screenshots</strong><span>Names will be matched against the Platoon master roster</span><input id="grRRFiles" type="file" accept="image/*" multiple></label><div id="grRROut"></div><div class="dialog-actions"><button class="button secondary" type="button" onclick="closePlatoonDialog()">Cancel</button><button class="button primary" id="grRRParse" type="button">Read Scorecards</button></div>`),input=d.querySelector('#grRRFiles'),out=d.querySelector('#grRROut'),btn=d.querySelector('#grRRParse');
    btn.onclick=async()=>{const files=[...input.files];if(!files.length){out.innerHTML='<div class="platoon-notice">Add at least one screenshot.</div>';return}btn.disabled=true;btn.textContent='Reading…';try{const images=[];for(const f of files)images.push(await platoonFilePayload(f));const parsed=await callPlatoonFunction({action:'parse_hole_details',mission:{date:m.date,locationName:m.locationName,title:m.title,roster:rosterContext(p,m)},images});const players=Array.isArray(parsed?.players)?parsed.players:[];const matches=players.map(x=>({detail:x,member:canonicalMember(p,x.player_name),holes:cleanHoles(x.holes)})).filter(x=>x.member&&x.holes.length);out.innerHTML=matches.map(x=>`<div class="gr155-hole-player"><div><strong>${x.detail.player_name} → ${x.member.name}</strong><span>${x.holes.length} holes</span></div></div>`).join('')+`<div class="dialog-actions"><button class="button primary" id="grRRHoleSave" type="button" ${matches.length?'':'disabled'}>Save Hole Detail</button></div>`;const save=d.querySelector('#grRRHoleSave');if(save&&!save.disabled)save.onclick=async()=>{let saved=0;for(const x of matches){const target=locked.find(r=>canonicalMember(p,r.player_name)?.id===x.member.id);if(!target)continue;const sig=holeSig(x.holes);for(const other of locked){if(other!==target&&sig&&holeSig(other.holes)===sig){delete other.holes;delete other.hole_detail_saved_at;delete other.hole_detail_source_count;delete other.hole_detail_source_name;delete other.hole_detail_canonical_id}}target.holes=x.holes;target.hole_detail_saved_at=new Date().toISOString();target.hole_detail_source_count=files.length;target.hole_detail_source_name=x.detail.player_name;target.hole_detail_canonical_id=x.member.id;saved++}m.results=locked;try{await Promise.resolve(savePlatoonLocal(p));d.close();alert(`Hole-by-hole detail saved for ${saved} player${saved===1?'':'s'} using the master roster.`)}catch{}}}catch(e){out.innerHTML=`<div class="platoon-notice">${String(e?.message||e)}</div>`}finally{btn.disabled=false;btn.textContent='Read Scorecards'}};
  }

  const oldUpload=window.grUploadScores;
  window.grUploadScores=id=>{
    const m=(loadPlatoonLocal().missions||[]).find(x=>x.id===id);if(!m)return;
    let d=document.getElementById('grRRChoice');if(!d){d=document.createElement('dialog');d.id='grRRChoice';document.body.appendChild(d)}
    d.innerHTML=`<div class="dialog-card"><div class="dialog-head"><div><div class="eyebrow">MISSION RESULTS</div><h2>${m.title||m.locationName||'Mission'}</h2></div><button class="icon-button" data-close type="button">✕</button></div><div class="gr155-choice-grid"><button class="card gr155-choice" data-official type="button"><strong>🏆 Official Results</strong><span>Leaderboard, gross, net, finish and points</span></button><button class="card gr155-choice" data-detail type="button"><strong>📸 Hole-by-Hole Detail</strong><span>Match scorecards to the Platoon master roster</span></button></div></div>`;d.querySelector('[data-close]').onclick=()=>d.close();d.querySelector('[data-official]').onclick=()=>{d.close();if(typeof openMissionImport==='function')openMissionImport(id);else if(oldUpload)oldUpload(id)};d.querySelector('[data-detail]').onclick=()=>{d.close();openRosterHoleImport(id)};d.showModal();
  };

  function refreshRecon(){
    const p=loadPlatoonLocal();document.querySelectorAll('.gr155-upload-status').forEach(x=>x.remove());document.querySelectorAll('.gr-mission').forEach(card=>{let id=card.querySelector('[data-gr-add-results]')?.dataset.grAddResults; if(!id){for(const b of card.querySelectorAll('button')){const s=b.getAttribute('onclick')||'',mm=s.match(/grOpenMissionEditor\(['\"]([^'\"]+)/);if(mm){id=mm[1];break}}}if(!id)return;const m=(p.missions||[]).find(x=>x.id===id);if(m?.status==='completed'){const s=card.querySelector('.gr-summary');if(s)s.innerHTML=enhancedSummaryMarkup(p,m)}});
    const dlg=document.getElementById('grPlatoonDialog');if(dlg?.open){dlg.querySelectorAll('.gr155-upload-status').forEach(x=>x.remove());const sum=dlg.querySelector('.gr-summary.gr-after-action');if(sum){const title=dlg.querySelector('h2')?.textContent||'',m=(p.missions||[]).find(x=>(x.title||'Mission')===title);if(m)sum.innerHTML=enhancedSummaryMarkup(p,m)}}
  }
  new MutationObserver(()=>setTimeout(refreshRecon,0)).observe(document.body,{childList:true,subtree:true});setTimeout(refreshRecon,50);setTimeout(refreshRecon,700);
}

setTimeout(installRosterAndReconPatch,0);
setTimeout(refreshPlatoonFromSupabase,250);
setTimeout(refreshPlatoonFromSupabase,1800);
window.addEventListener('focus',refreshPlatoonFromSupabase);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshPlatoonFromSupabase()});
})();
