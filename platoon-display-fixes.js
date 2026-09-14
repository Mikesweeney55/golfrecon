(()=>{
'use strict';
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
function cleanCourseName(v){
  let s=String(v||'').replace(/\s+/g,' ').trim();
  const i=s.indexOf('...');if(i>=0)s=s.slice(0,i).trim();
  const j=s.indexOf('…');if(j>=0)s=s.slice(0,j).trim();
  s=s.replace(/\s*\([^)]*$/,'').trim();
  return s||'Course TBD';
}
function getMission(id){
  try{return (window.loadPlatoonLocal?.().missions||[]).find(m=>String(m.id)===String(id))||null}catch{return null}
}
function sorted(m){
  return (m?.results||[]).map((r,i)=>({...r,_i:i})).sort((a,b)=>{
    const ap=finite(a.finish_position)?Number(a.finish_position):999;
    const bp=finite(b.finish_position)?Number(b.finish_position):999;
    return ap-bp||a._i-b._i;
  });
}
function patch(id){
  const m=getMission(id),d=document.getElementById('grPlatoonDialog');if(!m||!d?.open)return;
  const course=d.querySelector('.gr-event-course');if(course)course.textContent=cleanCourseName(m.locationName);
  const block=d.querySelector('.gr155-recap-grid .gr155-recap-block:first-child,.grr-grid .grr-block:first-child');
  if(block){
    const rows=[...block.querySelectorAll('.gr155-recap-row,.grr-row')],rs=sorted(m);
    rows.forEach((row,i)=>{
      const r=rs[i];if(!r)return;
      const spans=row.querySelectorAll('span'),v=spans[spans.length-1];if(!v)return;
      const n=finite(r.net)?`N ${Number(r.net)}`:'N —';
      const g=finite(r.gross)?`G ${Number(r.gross)}`:'G —';
      const p=finite(r.raw_points)?`${Number(r.raw_points)} pts`:'0 pts';
      v.textContent=`${n} · ${g} · ${p}`;
    });
  }
}
if(!document.getElementById('grDisplayFixStyle')){
  const s=document.createElement('style');s.id='grDisplayFixStyle';
  s.textContent='#grPlatoonDialog[open] .gr-event-banner{position:static!important;top:auto!important;z-index:auto!important}';
  document.head.appendChild(s);
}
const old=window.grViewMission;
if(typeof old==='function')window.grViewMission=function(id,...args){const out=old.call(this,id,...args);setTimeout(()=>patch(id),0);setTimeout(()=>patch(id),100);return out};
window.grCleanCourseName=cleanCourseName;
})();
