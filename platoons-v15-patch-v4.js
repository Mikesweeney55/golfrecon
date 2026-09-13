(()=>{
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let platoonMenuDialog=null,platoonSubpage='home',calendarCursor=null;
const pData=()=>loadPlatoonLocal();
function goSubpage(name){platoonSubpage=name;renderGroups();}
function renderGroups(){try{if(typeof render==='function')render()}catch{}}
function ensureMenu(){
  if(platoonMenuDialog)return platoonMenuDialog;
  const d=document.createElement('dialog');d.id='grPlatoonNavMenu';d.className='platoon-modal';
  d.innerHTML='<div class="dialog-card"><div class="dialog-head"><div><div class="eyebrow">PLATOONS</div><h2 style="margin:5px 0 0">Navigate</h2></div><button class="icon-button" data-close type="button">✕</button></div><div class="grid" style="margin-top:14px"><button class="card" data-gr-platoon-nav="calendar" type="button" style="text-align:left;color:inherit"><strong>📅 Calendar</strong><div class="muted" style="font-size:11px;margin-top:4px">Full mission calendar</div></button><button class="card" data-gr-platoon-nav="blog" type="button" style="text-align:left;color:inherit"><strong>📝 Blog</strong><div class="muted" style="font-size:11px;margin-top:4px">Platoon clubhouse and posts</div></button><button class="card" data-gr-platoon-nav="missions" type="button" style="text-align:left;color:inherit"><strong>🎯 Missions</strong><div class="muted" style="font-size:11px;margin-top:4px">Return to Platoon HQ missions view</div></button></div></div>';
  document.body.appendChild(d);d.querySelector('[data-close]').onclick=()=>d.close();
  d.addEventListener('click',e=>{const b=e.target.closest('[data-gr-platoon-nav]');if(!b)return;const action=b.dataset.grPlatoonNav;d.close();goSubpage(action==='missions'?'home':action)});
  platoonMenuDialog=d;return d;
}
function subHead(title,sub){return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px"><div><div class="eyebrow">PLATOONS</div><h2 style="margin:4px 0 0">${esc(title)}</h2>${sub?`<div class="muted" style="font-size:12px;margin-top:4px">${esc(sub)}</div>`:''}</div><button class="button secondary" type="button" data-platoon-home>Platoon HQ</button></div>`}
function monthStart(){
  if(calendarCursor)return new Date(calendarCursor.getFullYear(),calendarCursor.getMonth(),1);
  const now=new Date(),rows=(pData().missions||[]).filter(m=>m.date&&m.type!=='war').map(m=>new Date(m.date+'T12:00:00')).filter(d=>!isNaN(d));
  const next=rows.filter(d=>d>=new Date(now.getFullYear(),now.getMonth(),now.getDate())).sort((a,b)=>a-b)[0];
  calendarCursor=new Date((next||now).getFullYear(),(next||now).getMonth(),1);return calendarCursor;
}
function calendarView(){
  const p=pData(),cur=monthStart(),y=cur.getFullYear(),m=cur.getMonth(),first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();
  const missions=(p.missions||[]).filter(x=>x.type!=='war'&&x.date);
  const map={};missions.forEach(x=>{const d=new Date(x.date+'T12:00:00');if(d.getFullYear()===y&&d.getMonth()===m)(map[d.getDate()]||=[]).push(x)});
  let cells='';for(let i=0;i<first;i++)cells+='<div style="min-height:88px;border:1px solid var(--border,#263244);border-radius:10px;opacity:.35"></div>';
  for(let d=1;d<=days;d++){
    const items=map[d]||[];cells+=`<div style="min-height:88px;border:1px solid ${items.length?'#4f8cff':'var(--border,#263244)'};border-radius:10px;padding:7px;background:${items.length?'rgba(79,140,255,.08)':'transparent'}"><div style="font-weight:800;font-size:12px;margin-bottom:5px">${d}</div>${items.map(x=>`<button type="button" data-mission="${esc(x.id)}" style="display:block;width:100%;border:0;background:transparent;color:inherit;text-align:left;padding:3px 0;font-size:10px;font-weight:700;line-height:1.15">⛳ ${esc(x.title||x.locationName||'Mission')}</button>`).join('')}</div>`;
  }
  const label=cur.toLocaleString(undefined,{month:'long',year:'numeric'});
  return `${subHead('Calendar',p.name||'My Time')}<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><button class="icon-button" type="button" data-cal-prev>‹</button><strong style="font-size:18px">${esc(label)}</strong><button class="icon-button" type="button" data-cal-next>›</button></div><div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;margin-bottom:5px">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div style="text-align:center;font-size:10px;font-weight:800;opacity:.65">${x}</div>`).join('')}</div><div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px">${cells}</div></div>`;
}
function blogView(){const p=pData();return `${subHead('Blog',(p.name||'My Time')+' Clubhouse')}<div class="card"><div class="empty" style="padding:34px 12px">No posts yet.</div></div>`}
function applyPatch(){
  const base=window.grGroupsView;if(typeof base!=='function')return;
  const patched=()=>{
    if(platoonSubpage==='calendar')return calendarView();
    if(platoonSubpage==='blog')return blogView();
    const p=pData();let html=base();
    html=html.replace('<div class="gr-standings-title">Platoon Standings</div>',`<div class="gr-standings-title">${esc(p.season||new Date().getFullYear())} Platoon Standings</div>`);
    html=html.replace(/<div class="chips"><span class="chip">[\s\S]*?<\/div><div class="gr-hq-actions">/,'<div class="gr-hq-actions">');
    html=html.replace(/<div class="gr-players">[\s\S]*?<\/div>/g,'');return html;
  };
  try{groupsView=patched}catch{window.groupsView=patched}window.grGroupsView=patched;
  const nav=document.querySelector('.nav-item[data-view="groups"]');
  if(nav&&!nav.dataset.grSecondTap){nav.dataset.grSecondTap='1';nav.addEventListener('click',e=>{try{if(typeof state!=='undefined'&&state.view==='groups'){e.preventDefault();e.stopImmediatePropagation();ensureMenu().showModal()}}catch{}},true)}
  if(!document.body.dataset.grPlatoonSubpages){
    document.body.dataset.grPlatoonSubpages='1';document.addEventListener('click',e=>{
      if(e.target.closest('[data-platoon-home]')){platoonSubpage='home';renderGroups();return}
      if(e.target.closest('[data-cal-prev]')){const c=monthStart();calendarCursor=new Date(c.getFullYear(),c.getMonth()-1,1);renderGroups();return}
      if(e.target.closest('[data-cal-next]')){const c=monthStart();calendarCursor=new Date(c.getFullYear(),c.getMonth()+1,1);renderGroups();return}
      const b=e.target.closest('[data-mission]');if(b&&window.grViewMission)window.grViewMission(b.dataset.mission);
    });
  }
  try{if(typeof state!=='undefined'&&state.view==='groups')renderGroups()}catch{}
}
applyPatch();
})();