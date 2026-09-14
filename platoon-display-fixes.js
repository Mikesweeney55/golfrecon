(()=>{
'use strict';
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function cleanCourseName(v){
  let s=String(v||'').replace(/\s+/g,' ').trim();
  if(!s)return'Course TBD';
  const known=["Campbell's Scottish Highlands","Campbell’s Scottish Highlands"];
  for(const k of known){if(s.toLowerCase().startsWith(k.toLowerCase()))return k;}
  for(const token of ['...','…']){const i=s.indexOf(token);if(i>=0)s=s.slice(0,i).trim();}
  s=s.replace(/\s*\([^)]*$/,'').trim();
  s=s.replace(/\s+(?:dan itibaren|ücretsiz|fullbody|kuvvet|antrenman)\b.*$/i,'').trim();
  return s||'Course TBD';
}
function getP(){try{return window.loadPlatoonLocal?.()||null}catch{return null}}
function getMission(id){const p=getP();return (p?.missions||[]).find(m=>String(m.id)===String(id))||null}
function sorted(m){
  return (m?.results||[]).map((r,i)=>({...r,_i:i})).sort((a,b)=>{
    const ap=finite(a.finish_position)?Number(a.finish_position):999;
    const bp=finite(b.finish_position)?Number(b.finish_position):999;
    if(ap!==bp)return ap-bp;
    const an=finite(a.net)?Number(a.net):999;
    const bn=finite(b.net)?Number(b.net):999;
    return an-bn||a._i-b._i;
  });
}
function memberName(p,raw){
  const n=String(raw||'').trim().toLowerCase();if(!n)return'Player';
  const first=n.split(/\s+/)[0];
  const matches=(p?.members||[]).filter(m=>{
    const aliases=Array.isArray(m?.aliases)?m.aliases:[];
    const vals=[m?.name,...aliases].filter(Boolean).map(x=>String(x).trim().toLowerCase());
    return vals.includes(n)||String(m?.name||'').trim().toLowerCase().split(/\s+/)[0]===first;
  });
  return matches.length===1?matches[0].name:(raw||'Player');
}
function standingsMarkup(m,p){
  const rows=sorted(m);
  const body=rows.map((r,i)=>{
    const pos=finite(r.finish_position)?Number(r.finish_position):i+1;
    const net=finite(r.net)?Number(r.net):'—';
    const gross=finite(r.gross)?Number(r.gross):'—';
    const pts=finite(r.raw_points)?Number(r.raw_points):0;
    return `<div class="grstd-row"><div class="grstd-name"><b>${pos}</b><span>${esc(memberName(p,r.player_name))}</span></div><div>${net}</div><div>${gross}</div><div>${pts}</div></div>`;
  }).join('')||'<div class="grstd-empty">No results yet.</div>';
  return `<div class="grstd-table"><div class="grstd-head"><div>NAME</div><div>NET</div><div>GROSS</div><div>POINTS</div></div>${body}</div>`;
}
function standingsBlockMarkup(m,p){return `<div class="gr155-recap-title">RESULT STANDINGS</div>${standingsMarkup(m,p)}`;}
window.grMissionStandingsMarkup=standingsMarkup;
window.grMissionStandingsBlockMarkup=standingsBlockMarkup;
window.grCleanCourseName=cleanCourseName;
function missionIdFromEl(el){
  const direct=el?.querySelector?.('[data-gr-add-results]')?.dataset.grAddResults;if(direct)return direct;
  for(const b of (el?.querySelectorAll?.('button')||[])){
    const s=b.getAttribute('onclick')||'';
    let m=s.match(/grViewMission\(['\"]([^'\"]+)/);if(m)return m[1];
    m=s.match(/grOpenMissionEditor\(['\"]([^'\"]+)/);if(m)return m[1];
  }
  return'';
}
function replaceStandingsBlock(block,m,p){if(block&&m)block.innerHTML=standingsBlockMarkup(m,p);}
function cleanCourseEl(el,fallback){if(el)el.textContent=cleanCourseName(fallback||el.textContent);}
function patchMission(id){
  const p=getP(),m=getMission(id),d=document.getElementById('grPlatoonDialog');if(!m||!d?.open)return;
  cleanCourseEl(d.querySelector('.gr-event-course'),m.locationName);
  const block=d.querySelector('.gr155-recap-grid .gr155-recap-block:first-child,.grr-grid .grr-block:first-child');
  replaceStandingsBlock(block,m,p);
}
function patchCards(){
  const p=getP();if(!p)return;
  document.querySelectorAll('.gr-mission').forEach(card=>{
    const id=missionIdFromEl(card);if(!id)return;
    const m=(p.missions||[]).find(x=>String(x.id)===String(id));if(!m)return;
    cleanCourseEl(card.querySelector('.gr-mission-course'),m.locationName);
    const block=card.querySelector('.gr-summary .gr155-recap-grid .gr155-recap-block:first-child,.gr-summary .grr-grid .grr-block:first-child');
    replaceStandingsBlock(block,m,p);
  });
}
function scheduleCards(){setTimeout(patchCards,0);setTimeout(patchCards,80);setTimeout(patchCards,220);}
function installStyles(){
  let s=document.getElementById('grDisplayFixStyle');if(!s){s=document.createElement('style');s.id='grDisplayFixStyle';document.head.appendChild(s)}
  s.textContent=`#grPlatoonDialog[open] .gr-event-banner{position:static!important;top:auto!important;z-index:auto!important}.grstd-table{width:100%;font-variant-numeric:tabular-nums}.grstd-head,.grstd-row{display:grid;grid-template-columns:minmax(0,1fr) 52px 62px 62px;align-items:center;column-gap:8px}.grstd-head{padding:0 0 8px;border-bottom:1px solid rgba(255,255,255,.12);font-size:10px;font-weight:800;letter-spacing:.08em;opacity:.6}.grstd-head>div:not(:first-child),.grstd-row>div:not(:first-child){text-align:right}.grstd-row{min-height:44px;border-bottom:1px solid rgba(255,255,255,.08);font-size:14px}.grstd-row:last-child{border-bottom:0}.grstd-name{display:flex;align-items:center;gap:8px;min-width:0}.grstd-name b{width:16px;flex:0 0 16px}.grstd-name span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.grstd-empty{padding:12px 0;opacity:.65}@media(max-width:390px){.grstd-head,.grstd-row{grid-template-columns:minmax(0,1fr) 44px 54px 56px;column-gap:6px}.grstd-row{font-size:13px}}`;
}
window.grApplyMissionStandings=patchCards;
window.grInstallDisplayFixes=function(){
  installStyles();
  const view=window.grViewMission;
  if(typeof view==='function'&&!view._grSharedStandings){
    const wrapped=function(id,...args){const out=view.call(this,id,...args);setTimeout(()=>patchMission(id),0);setTimeout(()=>patchMission(id),100);return out};
    wrapped._grSharedStandings=true;window.grViewMission=wrapped;
  }
  const render=window.render;
  if(typeof render==='function'&&!render._grSharedStandings){
    const wrappedRender=function(...args){const out=render.apply(this,args);scheduleCards();return out};
    wrappedRender._grSharedStandings=true;window.render=wrappedRender;
  }
  scheduleCards();
};
window.grInstallDisplayFixes();
})();
