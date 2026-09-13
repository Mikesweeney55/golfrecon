(()=>{
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function missionIdFromCard(card){
  const direct=card.querySelector('[data-gr-add-results]')?.dataset.grAddResults;if(direct)return direct;
  for(const b of card.querySelectorAll('button')){
    const s=b.getAttribute('onclick')||'';
    let m=s.match(/grOpenMissionEditor\(['\"]([^'\"]+)/);if(m)return m[1];
    m=s.match(/grViewMission\(['\"]([^'\"]+)/);if(m)return m[1];
  }
  return '';
}
function loadP(){try{return window.loadPlatoonLocal?.()||null}catch{return null}}
async function removeMission(id,title,btn){
  if(!id)return alert('Could not identify this Mission.');
  const name=title||'this Mission';
  if(!confirm(`Delete ${name}?\n\nThis permanently removes the Mission and its Platoon results. Your personal Golf Recon rounds are not deleted.`))return;
  const old=btn.textContent;btn.disabled=true;btn.textContent='Deleting…';
  try{
    if(typeof window.callPlatoonFunction!=='function')throw new Error('Platoon connection is unavailable.');
    const out=await window.callPlatoonFunction({action:'delete_mission',mission_id:id});
    if(out?.platoon&&typeof window.writePlatoonLocal==='function')window.writePlatoonLocal(out.platoon);
    else {
      const p=loadP();if(p){p.missions=(p.missions||[]).filter(m=>m.id!==id);window.writePlatoonLocal?.(p)}
    }
    document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close()}catch{}});
    if(typeof window.render==='function')window.render();else location.reload();
  }catch(e){btn.disabled=false;btn.textContent=old;alert(`Delete failed: ${e?.message||e}`)}
}
function enhance(card){
  if(card.querySelector('[data-gr-delete-mission]'))return;
  const id=missionIdFromCard(card);if(!id)return;
  const p=loadP(),m=(p?.missions||[]).find(x=>x.id===id);if(!m)return;
  const actions=card.querySelector('.gr-mini-actions');if(!actions)return;
  const b=document.createElement('button');b.type='button';b.className='button secondary';b.dataset.grDeleteMission=id;b.textContent='🗑 Delete';
  b.style.borderColor='rgba(255,110,110,.45)';b.style.color='#ffaaaa';
  b.onclick=e=>{e.preventDefault();e.stopPropagation();removeMission(id,m.title||'this Mission',b)};
  actions.appendChild(b);
}
function run(){document.querySelectorAll('.gr-mission').forEach(enhance)}
new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
setTimeout(run,0);setTimeout(run,500);setTimeout(run,1500);
})();
