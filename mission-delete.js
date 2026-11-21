(()=>{
'use strict';
/**
 * Card/archive Delete affordances only. Canonical delete is window.grDeleteMission
 * in platoons-v15-real.js (mission modal already includes Delete).
 * Do not wrap grViewMission or replace grRemoveMission — that caused duplicate buttons.
 */
function missionIdFromEl(el){
  if(!el)return'';
  const direct=el.querySelector?.('[data-gr-add-results]')?.dataset.grAddResults;if(direct)return direct;
  const existing=el.querySelector?.('[data-gr-delete-mission]')?.dataset.grDeleteMission;if(existing)return existing;
  for(const b of (el.querySelectorAll?.('button')||[])){
    const s=b.getAttribute('onclick')||'';
    let m=s.match(/grOpenMissionEditor\(['\"]([^'\"]+)/);if(m)return m[1];
    m=s.match(/grViewMission\(['\"]([^'\"]+)/);if(m)return m[1];
  }
  return'';
}
function loadP(){try{return window.loadPlatoonLocal?.()||null}catch{return null}}
function missionFor(id){const p=loadP();return (p?.missions||[]).find(x=>x.id===id)||null}
function makeDelete(id){
  const b=document.createElement('button');b.type='button';b.className='button secondary';b.dataset.grDeleteMission=id;b.textContent='🗑 Delete';b.style.borderColor='rgba(255,110,110,.45)';b.style.color='#ffaaaa';
  b.onclick=e=>{e.preventDefault();e.stopPropagation();(window.grDeleteMission||window.grRemoveMission)?.(id,b)};
  return b;
}
function enhance(sel,actionsSel){
  document.querySelectorAll(sel).forEach(row=>{
    if(row.querySelector('[data-gr-delete-mission]'))return;
    const id=missionIdFromEl(row);if(!id||!missionFor(id))return;
    const actions=row.querySelector(actionsSel);if(actions)actions.appendChild(makeDelete(id));
  });
}
function run(){
  enhance('.gr-mission','.gr-mini-actions');
  enhance('.gr-archive-row','.gr-archive-actions');
}
new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
setTimeout(run,0);setTimeout(run,400);setTimeout(run,1200);
})();
