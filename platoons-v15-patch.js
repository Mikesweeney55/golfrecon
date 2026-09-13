(()=>{
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let platoonMenuDialog=null;
function closeMenu(){if(platoonMenuDialog?.open)platoonMenuDialog.close()}
function ensureMenu(){
  if(platoonMenuDialog)return platoonMenuDialog;
  const d=document.createElement('dialog');
  d.id='grPlatoonNavMenu';
  d.className='platoon-modal';
  d.innerHTML='<div class="dialog-card"><div class="dialog-head"><div><div class="eyebrow">PLATOONS</div><h2 style="margin:5px 0 0">Navigate</h2></div><button class="icon-button" id="grPlatoonMenuClose" type="button">✕</button></div><div class="grid" style="margin-top:14px"><button class="card" data-gr-platoon-nav="calendar" type="button" style="text-align:left;color:inherit"><strong>📅 Calendar</strong><div class="muted" style="font-size:11px;margin-top:4px">Mission dates and schedule</div></button><button class="card" data-gr-platoon-nav="blog" type="button" style="text-align:left;color:inherit"><strong>📝 Blog</strong><div class="muted" style="font-size:11px;margin-top:4px">Platoon clubhouse and posts</div></button><button class="card" data-gr-platoon-nav="missions" type="button" style="text-align:left;color:inherit"><strong>🎯 Missions</strong><div class="muted" style="font-size:11px;margin-top:4px">Upcoming, Wars and history</div></button></div></div>';
  document.body.appendChild(d);
  d.querySelector('#grPlatoonMenuClose').onclick=()=>d.close();
  d.addEventListener('click',e=>{
    const b=e.target.closest('[data-gr-platoon-nav]');if(!b)return;
    const action=b.dataset.grPlatoonNav;d.close();
    if(action==='missions')requestAnimationFrame(()=>document.querySelector('.gr-war-card,.gr-section')?.scrollIntoView({behavior:'smooth',block:'start'}));
    if(action==='calendar')showCalendar();
    if(action==='blog')showBlog();
  });
  platoonMenuDialog=d;return d;
}
function showCalendar(){
  const p=loadPlatoonLocal(),rows=(p.missions||[]).filter(m=>m.type!=='war').slice().sort((a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999')));
  const d=document.createElement('dialog');d.className='platoon-modal';
  d.innerHTML=`<div class="dialog-card"><div class="dialog-head"><div><div class="eyebrow">PLATOON CALENDAR</div><h2 style="margin:5px 0 0">${esc(p.name||'My Time')}</h2></div><button class="icon-button" data-close type="button">✕</button></div><div style="margin-top:14px">${rows.length?rows.map(m=>`<button class="card" type="button" data-mission="${esc(m.id)}" style="display:block;width:100%;text-align:left;color:inherit;margin-bottom:8px"><strong>${esc(m.title||m.locationName||'Mission')}</strong><div class="muted" style="font-size:11px;margin-top:3px">${esc(m.date||'Date TBD')} · ${esc(m.locationName||'Course TBD')}</div></button>`).join(''):'<div class="empty">No Missions scheduled.</div>'}</div></div>`;
  document.body.appendChild(d);d.querySelector('[data-close]').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());d.addEventListener('click',e=>{const b=e.target.closest('[data-mission]');if(!b)return;d.close();if(window.grViewMission)window.grViewMission(b.dataset.mission)});d.showModal();
}
function showBlog(){
  const p=loadPlatoonLocal(),d=document.createElement('dialog');d.className='platoon-modal';
  d.innerHTML=`<div class="dialog-card"><div class="dialog-head"><div><div class="eyebrow">PLATOON BLOG</div><h2 style="margin:5px 0 0">${esc(p.name||'My Time')} Clubhouse</h2></div><button class="icon-button" data-close type="button">✕</button></div><div class="empty" style="padding:28px 0 10px">No posts yet.</div></div>`;
  document.body.appendChild(d);d.querySelector('[data-close]').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());d.showModal();
}
function applyPatch(){
  const base=window.grGroupsView;if(typeof base!=='function')return;
  const patched=()=>{
    const p=loadPlatoonLocal();let html=base();
    html=html.replace('<div class="gr-standings-title">Platoon Standings</div>',`<div class="gr-standings-title">${esc(p.season||new Date().getFullYear())} Platoon Standings</div>`);
    html=html.replace(/<div class="chips"><span class="chip">[\s\S]*?<\/div><div class="gr-hq-actions">/,'<div class="gr-hq-actions">');
    html=html.replace(/<div class="gr-players">[\s\S]*?<\/div>/g,'');
    return html;
  };
  try{groupsView=patched}catch{window.groupsView=patched}
  window.grGroupsView=patched;
  const nav=document.querySelector('.nav-item[data-view="groups"]');
  if(nav&&!nav.dataset.grSecondTap){
    nav.dataset.grSecondTap='1';
    nav.addEventListener('click',e=>{
      try{if(typeof state!=='undefined'&&state.view==='groups'){e.preventDefault();e.stopImmediatePropagation();ensureMenu().showModal()}}catch{}
    },true);
  }
  try{if(typeof state!=='undefined'&&state.view==='groups'&&typeof render==='function')render()}catch{}
}
applyPatch();
})();