(()=>{
'use strict';

/**
 * Phase 1: Mission standings / highlights / AAR are owned by platoon-recap-shared.js
 * (grMissionRecapMarkup) via platoons-v15-real.js. This file no longer rewrites those
 * blocks after render. It only cleans course names on open dialogs / cards.
 */

function cleanCourseName(v){
  if(typeof window.grCleanCourseName==='function')return window.grCleanCourseName(v);
  const s=String(v||'').replace(/\s+/g,' ').trim();
  return s||'Course TBD';
}

function getP(){try{return window.loadPlatoonLocal?.()||null}catch{return null}}
function getMission(id){const p=getP();return (p?.missions||[]).find(m=>String(m.id)===String(id))||null}
function cleanCourseEl(el,fallback){if(el)el.textContent=cleanCourseName(fallback||el.textContent)}

function patchOpenMissionDialog(id){
  const m=getMission(id),d=document.getElementById('grPlatoonDialog');
  if(!m||!d?.open)return;
  cleanCourseEl(d.querySelector('.gr-event-course'),m.locationName);
}

function patchCards(){
  document.querySelectorAll('.gr-mission .gr-mission-course').forEach(el=>cleanCourseEl(el,el.textContent));
}

// Retired standings helpers — keep names so older callers no-op safely.
window.grApplyMissionStandings=function(){};
window.grMissionStandingsBlockMarkup=function(m,p){
  if(typeof window.grMissionStandingsMarkup==='function')return window.grMissionStandingsMarkup(m,p);
  return '';
};

window.grInstallDisplayFixes=function(){
  const view=window.grViewMission;
  if(typeof view==='function'&&!view._grCourseCleanup){
    const wrapped=function(id,...args){
      const out=view.call(this,id,...args);
      setTimeout(()=>patchOpenMissionDialog(id),0);
      return out;
    };
    wrapped._grCourseCleanup=true;
    window.grViewMission=wrapped;
  }
  patchCards();
};
window.grInstallDisplayFixes();
})();
