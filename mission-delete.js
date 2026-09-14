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
function run(){document.querySelectorAll('.gr-mission').forEach(enhanceCard);document.querySelectorAll('.gr-archive-row').forEach(enhanceArchive)}
const originalView=window.grViewMission;
if(typeof originalView==='function'){
  window.grViewMission=function(id,...rest){const r=originalView.call(this,id,...rest);addModalDelete(id);return r};
}
new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
setTimeout(run,0);setTimeout(run,400);setTimeout(run,1200);
setTimeout(()=>window.grInstallDisplayFixes?.(),0);
})();