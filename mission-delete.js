(()=>{
'use strict';
function missionIdFromEl(el){
  if(!el)return'';
  const direct=el.querySelector?.('[data-gr-add-results]')?.dataset.grAddResults;if(direct)return direct;
  for(const b of (el.querySelectorAll?.('button')||[])){
    const s=b.getAttribute('onclick')||'';
    let m=s.match(/grOpenMissionEditor\(['\"]([^'\"]+)/);if(m)return m[1];
    m=s.match(/grViewMission\(['\"]([^'\"]+)/);if(m)return m[1];
  }
  return'';
}
function loadP(){try{return window.loadPlatoonLocal?.()||null}catch{return null}}
async function removeMission(id,title,btn){
  if(!id)return alert('Could not identify this Mission.');
  const name=title||'this Mission';
  if(!confirm(`Delete ${name}?\n\nThis permanently removes the Mission and its Platoon results. Your personal Golf Recon rounds are not deleted.`))return;
  const old=btn?.textContent||'🗑 Delete';if(btn){btn.disabled=true;btn.textContent='Deleting…'}
  try{
    if(typeof window.callPlatoonFunction!=='function')throw new Error('Platoon connection is unavailable.');
    const out=await window.callPlatoonFunction({action:'delete_mission',mission_id:id});
    if(out?.platoon&&typeof window.writePlatoonLocal==='function')window.writePlatoonLocal(out.platoon);
    else{const p=loadP();if(p){p.missions=(p.missions||[]).filter(m=>m.id!==id);window.writePlatoonLocal?.(p)}}
    document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close()}catch{}});
    if(typeof window.render==='function')window.render();else location.reload();
  }catch(e){if(btn){btn.disabled=false;btn.textContent=old}alert(`Delete failed: ${e?.message||e}`)}
}
function missionFor(id){const p=loadP();return (p?.missions||[]).find(x=>x.id===id)||null}
function makeDelete(id,title){
  const b=document.createElement('button');b.type='button';b.className='button secondary';b.dataset.grDeleteMission=id;b.textContent='🗑 Delete';b.style.borderColor='rgba(255,110,110,.45)';b.style.color='#ffaaaa';
  b.onclick=e=>{e.preventDefault();e.stopPropagation();removeMission(id,title||missionFor(id)?.title||'this Mission',b)};
  return b;
}
function enhanceCard(card){
  if(card.querySelector('[data-gr-delete-mission]'))return;
  const id=missionIdFromEl(card);if(!id)return;const m=missionFor(id);if(!m)return;
  const actions=card.querySelector('.gr-mini-actions');if(actions)actions.appendChild(makeDelete(id,m.title));
}
function enhanceArchive(row){
  if(row.querySelector('[data-gr-delete-mission]'))return;
  const id=missionIdFromEl(row);if(!id)return;const m=missionFor(id);if(!m)return;
  const actions=row.querySelector('.gr-archive-actions');if(actions)actions.appendChild(makeDelete(id,m.title));
}
function addModalDelete(id){
  setTimeout(()=>{
    const d=document.getElementById('grPlatoonDialog');if(!d||!d.open||d.querySelector('[data-gr-delete-mission]'))return;
    const m=missionFor(id);if(!m)return;
    const actions=d.querySelector('.dialog-actions')||d.querySelector('.dialog-card');
    if(actions)actions.appendChild(makeDelete(id,m.title));
  },0);
}
function cleanCourseName(v){
  let s=String(v||'').replace(/\s+/g,' ').trim();
  const cut=s.search(/\.{3}|…/);if(cut>=0)s=s.slice(0,cut).trim();
  s=s.replace(/\s*\([^)]*$/,'').trim();
  s=s.replace(/\s*\?{2,}.*$/,'').trim();
  return s||'Course TBD';
}
function sortedResults(m){
  return Array.isArray(m?.results)?m.results.map((r,i)=>({...r,_i:i})).sort((a,b)=>{
    const ap=Number.isFinite(Number(a.finish_position))?Number(a.finish_position):999;
    const bp=Number.isFinite(Number(b.finish_position))?Number(b.finish_position):999;
    if(ap!==bp)return ap-bp;
    const an=Number.isFinite(Number(a.net))?Number(a.net):999;
    const bn=Number.isFinite(Number(b.net))?Number(b.net):999;
    return an-bn||a._i-b._i;
  }):[];
}
function scoreText(r){
  const n=Number.isFinite(Number(r?.net))?`N ${Number(r.net)}`:'N —';
  const g=Number.isFinite(Number(r?.gross))?`G ${Number(r.gross)}`:'G —';
  const p=Number.isFinite(Number(r?.raw_points))?`${Number(r.raw_points)} pts`:'0 pts';
  return `${n} · ${g} · ${p}`;
}
function patchStandings(root,m){
  if(!root||!m)return;
  const rs=sortedResults(m);
  const blocks=root.querySelectorAll('.gr155-recap-grid .gr155-recap-block:first-child, .grr-grid .grr-block:first-child');
  blocks.forEach(block=>{
    const rows=[...block.querySelectorAll('.gr155-recap-row,.grr-row')];
    rows.forEach((row,i)=>{const r=rs[i];if(!r)return;const spans=row.querySelectorAll('span');const last=spans[spans.length-1],next=scoreText(r);if(last&&last.textContent!==next)last.textContent=next});
  });
}
function patchCourse(root,m){
  if(!root)return;
  root.querySelectorAll('.gr-event-banner').forEach(x=>{
    if(x.dataset.grStaticBanner==='1')return;
    x.style.setProperty('position','static','important');x.style.setProperty('top','auto','important');x.style.setProperty('z-index','auto','important');x.dataset.grStaticBanner='1';
  });
  root.querySelectorAll('.gr-event-course').forEach(x=>{const next=cleanCourseName(m?.locationName||x.textContent);if(x.textContent!==next)x.textContent=next});
}
function patchMissionUi(id){
  const m=missionFor(id);if(!m)return;
  const d=document.getElementById('grPlatoonDialog');if(d?.open){patchCourse(d,m);patchStandings(d,m)}
}
function patchPastCourse(){
  const input=document.getElementById('grPastCourse');if(input){const c=cleanCourseName(input.value);if(c&&input.value!==c)input.value=c}
}
function patchCard(card){
  const id=missionIdFromEl(card);if(!id)return;const m=missionFor(id);if(!m)return;
  const c=card.querySelector('.gr-mission-course'),next=cleanCourseName(m.locationName||c?.textContent);if(c&&c.textContent!==next)c.textContent=next;
  patchStandings(card,m);
}
let activeMissionId='',running=false;
function run(){
  if(running)return;running=true;
  try{
    document.querySelectorAll('.gr-mission').forEach(card=>{enhanceCard(card);patchCard(card)});
    document.querySelectorAll('.gr-archive-row').forEach(enhanceArchive);
    patchPastCourse();
    if(activeMissionId)patchMissionUi(activeMissionId);
  }finally{running=false}
}
const originalView=window.grViewMission;
if(typeof originalView==='function'){
  window.grViewMission=function(id,...rest){activeMissionId=id;const r=originalView.call(this,id,...rest);addModalDelete(id);[20,100,250].forEach(ms=>setTimeout(()=>patchMissionUi(id),ms));return r};
}
let pending=false;
new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;run()})}).observe(document.body,{childList:true,subtree:true});
setTimeout(run,0);setTimeout(run,400);setTimeout(run,1200);
})();
