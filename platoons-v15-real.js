(()=>{
'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let platoonSubpage='home',calendarCursor=null;
function renderGroups(){try{if(typeof render==='function')render()}catch{}}
function goSubpage(name){platoonSubpage=name||'home';renderGroups()}
function subNav(){const tabs=[{id:'home',label:'Missions'},{id:'calendar',label:'Calendar'},{id:'blog',label:'Blog'}];return `<nav class="gr-platoon-subnav" aria-label="Platoons sections">${tabs.map(t=>`<button type="button" class="gr-platoon-subtab ${platoonSubpage===t.id?'active':''}" data-gr-subnav="${t.id}">${E(t.label)}</button>`).join('')}</nav>`}
function withSubNav(html){return `<div class="gr-platoons-shell">${html||''}${subNav()}</div>`}
function subHead(title,sub){return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px"><div><div class="eyebrow">PLATOONS</div><h2 style="margin:4px 0 0">${E(title)}</h2>${sub?`<div class="muted" style="font-size:12px;margin-top:4px">${E(sub)}</div>`:''}</div><button class="button secondary" type="button" data-platoon-home>Platoon HQ</button></div>`}
function monthStart(){if(calendarCursor)return new Date(calendarCursor.getFullYear(),calendarCursor.getMonth(),1);const now=new Date(),rows=(loadPlatoonLocal().missions||[]).filter(m=>m.date&&m.type!=='war').map(m=>new Date(m.date+'T12:00:00')).filter(d=>!isNaN(d));const next=rows.filter(d=>d>=new Date(now.getFullYear(),now.getMonth(),now.getDate())).sort((a,b)=>a-b)[0];calendarCursor=new Date((next||now).getFullYear(),(next||now).getMonth(),1);return calendarCursor}
function calendarView(){const p=loadPlatoonLocal(),cur=monthStart(),y=cur.getFullYear(),m=cur.getMonth(),first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),missions=(p.missions||[]).filter(x=>x.type!=='war'&&x.date),map={};missions.forEach(x=>{const d=new Date(x.date+'T12:00:00');if(d.getFullYear()===y&&d.getMonth()===m)(map[d.getDate()]||=[]).push(x)});let cells='';for(let i=0;i<first;i++)cells+='<div style="min-height:88px;border:1px solid var(--border,#263244);border-radius:10px;opacity:.35"></div>';for(let d=1;d<=days;d++){const items=map[d]||[];cells+=`<div style="min-height:88px;border:1px solid ${items.length?'#4f8cff':'var(--border,#263244)'};border-radius:10px;padding:7px;background:${items.length?'rgba(79,140,255,.08)':'transparent'}"><div style="font-weight:800;font-size:12px;margin-bottom:5px">${d}</div>${items.map(x=>`<button type="button" data-mission="${E(x.id)}" style="display:block;width:100%;border:0;background:transparent;color:inherit;text-align:left;padding:3px 0;font-size:10px;font-weight:700;line-height:1.15">⛳ ${E(x.title||x.locationName||'Mission')}</button>`).join('')}</div>`}const label=cur.toLocaleString(undefined,{month:'long',year:'numeric'});return `${subHead('Calendar',p.name||'My Time')}<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><button class="icon-button" type="button" data-cal-prev>‹</button><strong style="font-size:18px">${E(label)}</strong><button class="icon-button" type="button" data-cal-next>›</button></div><div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;margin-bottom:5px">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div style="text-align:center;font-size:10px;font-weight:800;opacity:.65">${x}</div>`).join('')}</div><div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px">${cells}</div></div>`}
function blogView(){const p=loadPlatoonLocal();return `${subHead('Blog',(p.name||'My Time')+' Clubhouse')}<div class="card"><div class="empty" style="padding:34px 12px">No posts yet.</div></div>`}
function missionCourseNames(current){const names=[];try{if(typeof db!=='undefined'&&Array.isArray(db.courses))db.courses.forEach(c=>{const n=String(c?.name||'').trim();if(n)names.push(n)})}catch{}try{(loadPlatoonLocal().missions||[]).forEach(m=>{const n=String(m?.locationName||'').trim();if(n&&n!=='Course TBD'&&n!=='Multi-course')names.push(n)})}catch{}const cur=String(current||'').trim();if(cur&&!names.includes(cur))names.unshift(cur);return [...new Set(names)].sort((a,b)=>a.localeCompare(b))}
function courseSelectMarkup(current){const cur=String(current||'').trim(),names=missionCourseNames(cur);return `<select id="grMCourse" style="width:100%"><option value="">Select course…</option>${names.map(n=>`<option value="${E(n)}" ${n===cur?'selected':''}>${E(n)}</option>`).join('')}<option value="__gr_add_course__">＋ Add new course…</option></select>`}
const uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const fmtTime=v=>{if(!v)return 'TBD';const [h,m]=String(v).slice(0,5).split(':').map(Number),d=new Date();d.setHours(h,m||0,0,0);return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})};
const fmtDate=v=>v?new Date(v+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}):'Date TBD';
function dateTile(v){if(!v)return '<div class="gr-date"><div class="d">—</div><div class="w">TBD</div></div>';const d=new Date(v+'T12:00:00');return `<div class="gr-date"><div class="m">${d.toLocaleString(undefined,{month:'short'}).toUpperCase()}</div><div class="d">${d.getDate()}</div><div class="w">${d.toLocaleString(undefined,{weekday:'short'}).toUpperCase()}</div></div>`}
function cleanNotes(v){return String(v||'').replace(/\n?\[\[GR_GUESTS:[\s\S]*?\]\]/g,'').replace(/\n?\[\[GR_WAR:[^\]]+\]\]/g,'').replace(/\n?\[\[GR_WAR_END:[^\]]*\]\]/g,'').replace(/\n?\[\[GR_PREVIEW:[\s\S]*?\]\]/g,'').replace(/\n?\[\[GR_LIVE:[^\]]*\]\]/g,'').replace(/\n?\[\[GR_IMPORT_FP:[^\]]*\]\]/g,'').trim()}
function guestsOf(m){if(Array.isArray(m.guests))return m.guests;const x=String(m.notes||'').match(/\[\[GR_GUESTS:([\s\S]*?)\]\]/);if(!x)return [];try{return JSON.parse(x[1])||[]}catch{return []}}
function warIdOf(m){const x=String(m.notes||'').match(/\[\[GR_WAR:([^\]]+)\]\]/);return x?x[1]:''}
function warEndOf(m){const x=String(m.notes||'').match(/\[\[GR_WAR_END:([^\]]*)\]\]/);return x?x[1]:''}
function composeNotes(base,guests=[],warId='',warEnd=''){let s=cleanNotes(base);if(guests.length)s+=`${s?'\n':''}[[GR_GUESTS:${JSON.stringify(guests)}]]`;if(warId)s+=`${s?'\n':''}[[GR_WAR:${warId}]]`;if(warEnd)s+=`${s?'\n':''}[[GR_WAR_END:${warEnd}]]`;return s}
function membersOf(p){return (p.members||[]).filter(m=>m.status!=='inactive')}
function playersOf(p,m){const map=new Map(membersOf(p).map(x=>[x.id,x.name]));return (m.participants||[]).map(id=>map.get(id)).filter(Boolean)}
function peopleOf(p,m){return [...playersOf(p,m).map(name=>({name,guest:false})),...guestsOf(m).map(name=>({name,guest:true}))]}
function courseLabel(v){return typeof window.grCleanCourseName==='function'?window.grCleanCourseName(v):(v||'Course TBD')}
function phaseOf(m){return typeof window.grMissionPhase==='function'?window.grMissionPhase(m):(m.status==='completed'?'completed':m.status==='ready'?'ready':'draft')}
function statusTag(m){
  const phase=phaseOf(m);
  const cls=phase==='completed'?'gr-complete':phase==='in_progress'?'gr-live':phase==='ready'?'gr-ready':'';
  const label=phase==='completed'?'COMPLETED':phase==='in_progress'?'IN PROGRESS':phase==='ready'?'READY':'DRAFT';
  return `<span class="gr-tag ${cls}">${label}</span>`;
}
function previewFor(p,m){
  const stored=typeof window.grPreviewFromMission==='function'?window.grPreviewFromMission(m):null;
  if(stored&&(stored.battlefield||(stored.intel&&stored.intel.length)))return stored;
  if(typeof window.grBuildMissionPreview==='function')return window.grBuildMissionPreview(p,m);
  const same=(p.missions||[]).filter(x=>x.id!==m.id&&x.type!=='war'&&courseLabel(x.locationName)===courseLabel(m.locationName)&&x.status==='completed');
  const names=peopleOf(p,m).map(x=>x.name);
  return {battlefield:same.length?`${same.length} prior Platoon round${same.length===1?'':'s'} at ${courseLabel(m.locationName)}.`:`First Platoon Mission at ${courseLabel(m.locationName)}.`,watch:names.length?names.slice(0,4).join(' · '):'Field TBD',intel:[]};
}
function previewMarkup(pre){
  const intel=Array.isArray(pre?.intel)?pre.intel:[];
  const body=intel.length?intel.map(x=>`<p>${E(x)}</p>`).join(''):`<p>${E(pre?.battlefield||'')}</p><p>${E(pre?.watch||'')}</p>`;
  return `<div class="gr-preview"><h4>Pre-Mission Intel</h4>${body}</div>`;
}
function resultRows(m){return Array.isArray(m.results)?m.results:[]}
function netStandings(m){return resultRows(m).filter(r=>Number.isFinite(Number(r.net))).map(r=>({...r,net:Number(r.net)})).sort((a,b)=>a.net-b.net||Number(a.finish_position??999)-Number(b.finish_position??999))}
function platoonStandings(p){const members=membersOf(p),score=new Map(members.map(m=>[String(m.name||'').trim().toLowerCase(),{name:m.name,points:0}]));for(const m of (p.missions||[])){if(m.type==='war'||m.status!=='completed')continue;for(const r of resultRows(m)){const k=String(r.player_name||'').trim().toLowerCase();if(score.has(k))score.get(k).points+=Number(r.raw_points||0)}}return [...score.values()].sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name))}
function missionHighlights(m){const rows=resultRows(m),net=netStandings(m),gross=rows.filter(r=>Number.isFinite(Number(r.gross))).map(r=>({...r,gross:Number(r.gross)})).sort((a,b)=>a.gross-b.gross),pts=rows.filter(r=>Number.isFinite(Number(r.raw_points))).map(r=>({...r,raw_points:Number(r.raw_points)})).sort((a,b)=>b.raw_points-a.raw_points),eagles=rows.filter(r=>Number(r.eagle_count)>0).sort((a,b)=>Number(b.eagle_count)-Number(a.eagle_count));return {lowNet:net[0]||null,lowGross:gross[0]||null,points:pts[0]||null,eagles:eagles[0]||null}}
function summaryText(m){const net=netStandings(m),h=missionHighlights(m);if(!net.length){const rows=resultRows(m);if(!rows.length)return 'Mission complete.';const ranked=[...rows].sort((a,b)=>(a.finish_position??999)-(b.finish_position??999));const w=ranked[0];return w?`${w.player_name} led the field${w.gross!=null?` with ${w.gross} gross`:''}.`:'Mission complete.'}const w=net[0],runner=net[1];let s=`${w.player_name} took low net at ${w.net}`;if(runner){const margin=runner.net-w.net;s+=margin>0?`, ${margin} shot${margin===1?'':'s'} clear of ${runner.player_name}`:` in a tie with ${runner.player_name}`}if(h.lowGross&&h.lowGross.player_name!==w.player_name)s+=`. ${h.lowGross.player_name} posted the low gross at ${h.lowGross.gross}`;if(h.points&&Number(h.points.raw_points)>0)s+=`. ${h.points.player_name} earned ${h.points.raw_points} point${Number(h.points.raw_points)===1?'':'s'}`;return s+'.'}
function missionSummaryMarkup(m){const p=loadPlatoonLocal();if(typeof window.grMissionRecapMarkup==='function')return window.grMissionRecapMarkup(p,m);const net=netStandings(m).slice(0,6),h=missionHighlights(m);const netRows=net.length?net.map((r,i)=>`<div class="gr-net-row"><span><b>${i+1}</b> ${E(r.player_name||'Player')}</span><strong>${r.net}</strong></div>`).join(''):'<div class="gr-after-empty">No net scores</div>';const highlights=[h.lowGross?`<div><span>Low Gross</span><strong>${E(h.lowGross.player_name)} · ${h.lowGross.gross}</strong></div>`:'',h.points&&Number(h.points.raw_points)>0?`<div><span>Points</span><strong>${E(h.points.player_name)} · ${h.points.raw_points}</strong></div>`:'',h.eagles?`<div><span>Eagles</span><strong>${E(h.eagles.player_name)} · ${h.eagles.eagle_count}</strong></div>`:''].filter(Boolean).join('')||'<div class="gr-after-empty">No extra highlights</div>';return `<div class="gr-after-grid"><section class="gr-after-panel"><h4>Net Standings</h4>${netRows}</section><section class="gr-after-panel gr-highlights"><h4>Highlights</h4>${highlights}</section></div><div class="gr-after-narrative">${E(summaryText(m))}</div>`}
function platoonStandingsMarkup(p){
  if(typeof window.grPlatoonRecapMarkup==='function')return window.grPlatoonRecapMarkup(p);
  const rows=platoonStandings(p);
  const season=p.season||new Date().getFullYear();
  return `<div class="gr-platoon-standings"><div class="gr-standings-title">${E(season)} Platoon Standings</div>${rows.map((r,i)=>`<div class="gr-platoon-standing-row"><span><b>${i+1}</b> ${E(r.name)}</span><strong>${Number(r.points||0)}</strong></div>`).join('')}</div>`;
}

function missionActions(m,warId){
  const phase=phaseOf(m),bits=[];
  if(phase==='draft')bits.push(`<button class="button primary" onclick="grLockMission('${E(m.id)}')">Create Preview / Lock</button>`);
  if(phase==='ready')bits.push(`<button class="button primary" onclick="grStartMission('${E(m.id)}')">Start Round</button>`);
  if(phase==='draft'||phase==='ready'||phase==='in_progress')bits.push(`<button class="button secondary" onclick="grViewMission('${E(m.id)}')">Preview</button>`);
  if(phase==='completed')bits.push(`<button class="button secondary" onclick="grViewMission('${E(m.id)}')">Standings / AAR</button>`);
  bits.push(`<button class="button secondary" onclick="grOpenMissionEditor('${E(m.id)}','${E(warId||'')}')">Edit</button>`);
  if(phase!=='completed')bits.push(`<button class="button secondary" onclick="grUploadScores('${E(m.id)}')">Import Scores</button>`);
  if(phase==='completed')bits.push(`<button class="button secondary" data-gr-add-results="${E(m.id)}" onclick="grUploadScores('${E(m.id)}')">📸 Add Results</button>`);
  if(phase==='ready'||phase==='in_progress')bits.push(`<button class="button secondary" onclick="grReopenMission('${E(m.id)}')">Back to Draft</button>`);
  bits.push(`<button class="button secondary" data-gr-delete-mission="${E(m.id)}" onclick="grDeleteMission('${E(m.id)}')" style="border-color:rgba(255,110,110,.45);color:#ffaaaa">🗑 Delete</button>`);
  return `<div class="gr-mini-actions">${bits.join('')}</div>`;
}

function missionCard(p,m,featured=false){
  const people=peopleOf(p,m),pre=previewFor(p,m),warId=warIdOf(m),phase=phaseOf(m);
  const showPrev=phase==='ready'||phase==='in_progress';
  return `<div class="gr-mission ${featured?'featured':''}" data-mission-id="${E(m.id)}" data-mission-phase="${E(phase)}"><div class="gr-mission-head">${dateTile(m.date)}<div><div class="gr-mission-title">${E(m.title||'Mission')}</div><div class="gr-mission-course">${E(courseLabel(m.locationName))}</div></div><div class="gr-status"><span class="gr-tag gr-time-tag">⏱ ${E(fmtTime(m.teeTime))}</span>${statusTag(m)}</div></div><div class="gr-meta"><div class="gr-meta-cell"><span>Format</span><strong>${E(m.format||'TBD')}</strong></div><div class="gr-meta-cell"><span>Players</span><strong>${people.length}</strong></div></div><div class="gr-players">${people.map(x=>`<span class="gr-player ${x.guest?'guest':''}">${E(x.name)}${x.guest?' · GUEST':''}</span>`).join('')}</div>${showPrev?previewMarkup(pre):''}${phase==='completed'?`<div class="gr-summary gr-summary-compact">${missionSummaryMarkup(m)}</div>`:''}${missionActions(m,warId)}</div>`;
}

function completedMissionAccordion(p,m,open=false){
  const people=peopleOf(p,m),warId=warIdOf(m),phase=phaseOf(m);
  return `<details class="gr-mission gr-mission-accordion ${open?'featured':''}" data-mission-id="${E(m.id)}" data-mission-phase="${E(phase)}" ${open?'open':''}><summary class="gr-mission-accordion-sum"><div class="gr-mission-head">${dateTile(m.date)}<div><div class="gr-mission-title">${E(m.title||'Mission')}</div><div class="gr-mission-course">${E(courseLabel(m.locationName))}</div></div><div class="gr-status"><span class="gr-tag gr-time-tag">⏱ ${E(fmtTime(m.teeTime))}</span>${statusTag(m)}</div></div></summary><div class="gr-mission-accordion-body"><div class="gr-meta"><div class="gr-meta-cell"><span>Format</span><strong>${E(m.format||'TBD')}</strong></div><div class="gr-meta-cell"><span>Players</span><strong>${people.length}</strong></div></div><div class="gr-players">${people.map(x=>`<span class="gr-player ${x.guest?'guest':''}">${E(x.name)}${x.guest?' · GUEST':''}</span>`).join('')}</div><div class="gr-summary gr-after-action">${missionSummaryMarkup(m)}</div>${missionActions(m,warId)}</div></details>`;
}

function leaderboard(p,war){
  if(typeof window.grWarStandings==='function'){
    const ws=window.grWarStandings(p,war);
    return {mode:ws.mode,rows:ws.rows.map(r=>({name:r.name,played:r.played,points:r.points,avgNet:r.avgNet,avgGross:r.avgGross}))};
  }
  const kids=(p.missions||[]).filter(m=>m.type!=='war'&&warIdOf(m)===war.id&&m.status==='completed');
  const map=new Map();
  for(const m of kids)for(const r of (m.results||[])){
    const k=r.player_name||'Player',x=map.get(k)||{name:k,played:0,points:0,net:0,gross:0,nc:0,gc:0};
    x.played++;x.points+=Number(r.raw_points||0);
    if(Number.isFinite(Number(r.net))){x.net+=Number(r.net);x.nc++}
    if(Number.isFinite(Number(r.gross))){x.gross+=Number(r.gross);x.gc++}
    map.set(k,x);
  }
  const mode=String(war.format||'Points').toLowerCase();
  const rows=[...map.values()].map(r=>({name:r.name,played:r.played,points:r.points,avgNet:r.nc?r.net/r.nc:null,avgGross:r.gc?r.gross/r.gc:null}));
  rows.sort((a,b)=>mode.includes('net')?(a.avgNet??999)-(b.avgNet??999):mode.includes('gross')?(a.avgGross??999)-(b.avgGross??999):b.points-a.points);
  return {mode,rows};
}

function warCard(p,w){
  const kids=typeof window.grWarChildMissions==='function'
    ? window.grWarChildMissions(p,w)
    : (p.missions||[]).filter(m=>m.type!=='war'&&warIdOf(m)===w.id).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const board=leaderboard(p,w);
  const done=kids.filter(m=>m.status==='completed').length;
  const pct=kids.length?Math.round(done/kids.length*100):0;
  const mode=String(w.format||'Points');
  const avgHead=mode.toLowerCase().includes('gross')?'Avg G':'Avg N';
  const rows=board.rows||[];
  const maxPts=Math.max(1,...rows.map(r=>Number(r.points)||0));
  const table=rows.length?`<div class="gr-war-standings-label">War Standings</div><div class="dossier-rank-list">${rows.map((r,i)=>{
    const avg=mode.toLowerCase().includes('gross')?(r.avgGross!=null?Math.round(r.avgGross*10)/10:'—'):(r.avgNet!=null?Math.round(r.avgNet*10)/10:'—');
    const pts=Number(r.points)||0;
    const bar=Math.max(4,Math.round(100*pts/maxPts));
    return `<div class="dossier-rank-row"><b class="dossier-rank-num">${i+1}</b><div class="dossier-rank-body"><strong>${E(r.name)}</strong><div class="dossier-rank-track"><span style="width:${bar}%"></span></div><div class="muted" style="font-size:10px;margin-top:3px">${r.played||0} played · ${avgHead} ${avg}</div></div><span class="dossier-rank-pts">${pts} pts</span></div>`;
  }).join('')}</div>`:'';
  return `<div class="card gr-war-card"><div class="gr-war-head"><div><div class="eyebrow">WAR</div><h3>${E(w.title||'War')}</h3><div class="muted" style="font-size:11px">${done} of ${kids.length} Missions complete${warEndOf(w)?` · through ${E(fmtDate(warEndOf(w)))}`:''} · ${E(mode)}</div></div><span class="gr-tag gr-war">${done===kids.length&&kids.length?'COMPLETE':'ACTIVE'}</span></div><div class="gr-progress"><span style="width:${pct}%"></span></div>${table}<div class="gr-mini-actions"><button class="button primary" onclick="grOpenMissionEditor('','${E(w.id)}')">+ Mission</button><button class="button secondary" onclick="grOpenWarEditor('${E(w.id)}')">Edit War</button></div><div class="gr-stack" style="margin-top:9px"><div class="gr-war-standings-label">Mission Results</div>${kids.map(m=>missionCard(p,m,false)).join('')||'<div class="muted" style="font-size:11px">No Missions yet.</div>'}</div></div>`;
}

function groupsV15(){
  if(platoonSubpage==='calendar')return withSubNav(calendarView());
  if(platoonSubpage==='blog')return withSubNav(blogView());
  const p=loadPlatoonLocal(),missions=(p.missions||[]).filter(m=>m.type!=='war'),wars=(p.missions||[]).filter(m=>m.type==='war'),standalone=missions.filter(m=>!warIdOf(m));
  const upcoming=standalone.filter(m=>m.status!=='completed').sort((a,b)=>{
    const ad=String(a.date||'9999'),bd=String(b.date||'9999');
    if(ad!==bd)return ad.localeCompare(bd);
    return String(a.teeTime||'').localeCompare(String(b.teeTime||''));
  });
  const complete=standalone.filter(m=>m.status==='completed').sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.teeTime||'').localeCompare(String(a.teeTime||'')));
  const upcomingBody=upcoming.length
    ? `<div class="gr-stack">${upcoming.map((m,i)=>missionCard(p,m,i===0||phaseOf(m)==='in_progress')).join('')}</div>`
    : `<div class="card gr-empty-upcoming"><strong>No upcoming Missions</strong><span class="muted">Schedule the next round with + Operation.</span></div>`;
  const completedBody=complete.length
    ? `<div class="gr-stack">${complete.map((m,i)=>completedMissionAccordion(p,m,i===0)).join('')}</div>`
    : `<div class="card gr-empty-upcoming"><strong>No completed Missions yet</strong><span class="muted">Finished rounds will stack here with standings and AAR.</span></div>`;
  const pastBtn=typeof window.grImportPastMission==='function'?`<button class="button secondary" data-gr-past-import="1" onclick="grImportPastMission()">📥 Import Past Mission</button>`:'';
  const home=`<div class="gr-platoons-home"><section class="card gr-platoon-hq"><div><div class="eyebrow">PLATOON HQ</div><div class="gr-platoon-name">${E(p.name||'My Time')}</div><div class="gr-platoon-motto">${E(p.motto||'')}</div>${platoonStandingsMarkup(p)}<div class="gr-hq-actions"><button class="button secondary" onclick="grOpenSetup()">⚙ Setup</button>${pastBtn}<button class="button primary" onclick="grOpenOperation()">+ Operation</button></div></div><div>${p.logoData?`<img class="gr-platoon-logo" src="${E(p.logoData)}" alt="Platoon logo">`:'<div class="gr-logo-placeholder">PLATOON<br>LOGO</div>'}</div></section>${wars.map(w=>warCard(p,w)).join('')}<section class="gr-section" id="grUpcomingMissions"><div class="gr-section-head"><h2>Upcoming Missions</h2></div>${upcomingBody}</section><section class="gr-section" id="grCompletedMissions"><div class="gr-section-head"><h2>Completed Missions</h2></div>${completedBody}</section></div>`;
  return withSubNav(home);
}

function modal(inner){let d=document.getElementById('grPlatoonDialog');if(!d){d=document.createElement('dialog');d.id='grPlatoonDialog';document.body.appendChild(d)}d.innerHTML=`<div class="dialog-card">${inner}</div>`;d.showModal();return d}
function closeModal(){document.getElementById('grPlatoonDialog')?.close()}
window.grOpenOperation=()=>{modal(`<div class="dialog-head"><div><div class="eyebrow">NEW OPERATION</div><h2>What are you creating?</h2></div><button class="icon-button" onclick="grCloseModal()">✕</button></div><div class="grid two" style="margin-top:14px"><button class="card" style="text-align:left;color:inherit" onclick="grCloseModal();grOpenMissionEditor()"><strong style="font-size:18px">Mission</strong><div class="muted" style="font-size:11px">One competitive round</div></button><button class="card" style="text-align:left;color:inherit" onclick="grCloseModal();grOpenWarEditor()"><strong style="font-size:18px">War</strong><div class="muted" style="font-size:11px">Multiple Missions</div></button></div>`)};
window.grCloseModal=closeModal;
window.grOpenSetup=()=>{const p=loadPlatoonLocal(),d=modal(`<div class="dialog-head"><div><div class="eyebrow">PLATOON</div><h2>Setup</h2></div><button class="icon-button" onclick="grCloseModal()">✕</button></div><label>Name<input id="grPName" value="${E(p.name||'')}"></label><label>Motto<input id="grPMotto" value="${E(p.motto||'')}"></label><div class="grid two"><label>Season<input id="grPSeason" type="number" value="${E(p.season||new Date().getFullYear())}"></label><label>Visibility<select id="grPVis"><option ${p.visibility==='Private'?'selected':''}>Private</option><option ${p.visibility==='Invite only'?'selected':''}>Invite only</option></select></label></div><label class="gr-logo-upload">${p.logoData?'Change Platoon Logo':'Upload Platoon Logo'}<input id="grPLogo" type="file" accept="image/*"></label><div class="dialog-actions"><button class="button secondary" onclick="grCloseModal()">Cancel</button><button class="button primary" id="grPSave">Save</button></div>`);d.querySelector('#grPLogo').onchange=e=>{const f=e.target.files?.[0];if(!f)return;const img=new Image(),r=new FileReader();r.onload=()=>{img.onload=()=>{const c=document.createElement('canvas'),max=256,scale=Math.min(1,max/Math.max(img.width,img.height));c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);d.dataset.logo=c.toDataURL('image/jpeg',.82)};img.src=r.result};r.readAsDataURL(f)};d.querySelector('#grPSave').onclick=()=>{p.name=d.querySelector('#grPName').value.trim()||'My Time';p.motto=d.querySelector('#grPMotto').value.trim();p.season=Number(d.querySelector('#grPSeason').value)||new Date().getFullYear();p.visibility=d.querySelector('#grPVis').value;if(d.dataset.logo)p.logoData=d.dataset.logo;savePlatoonLocal(p);closeModal()}};

window.grOpenMissionEditor=(id='',warId='')=>{
  const p=loadPlatoonLocal(),m=id?(p.missions||[]).find(x=>x.id===id):null,war=warId?(p.missions||[]).find(x=>x.id===warId&&x.type==='war'):null,gs=m?guestsOf(m):[],memberIds=m?.participants||[],baseNotes=m?cleanNotes(m.notes):'';
  const d=modal(`<div class="dialog-head"><div><div class="eyebrow">MISSION</div><h2>${m?'Edit Mission':'New Mission'}</h2></div><button class="icon-button" onclick="grCloseModal()">✕</button></div><div class="gr-event-banner"><div class="gr-event-name" id="grBannerTitle">${E(m?.title||'Event name')}</div><div class="gr-event-course" id="grBannerCourse">${E(courseLabel(m?.locationName))}</div><div class="gr-event-facts"><span class="gr-event-fact" id="grBannerDate">📅 ${E(fmtDate(m?.date))}</span><span class="gr-event-fact" id="grBannerTime">⏱ ${E(fmtTime(m?.teeTime))}</span><span class="gr-event-fact" id="grBannerFormat">${E(m?.format||'Format TBD')}</span></div></div><label>Event Name<input id="grMTitle" value="${E(m?.title||'')}"></label><label>Course${courseSelectMarkup(m?.locationName)}</label><div class="grid two"><label>Date<input id="grMDate" type="date" value="${E(m?.date||'')}"></label><label>Tee Time<input id="grMTime" type="time" value="${E(String(m?.teeTime||'').slice(0,5))}"></label></div><label>Format<input id="grMFormat" value="${E(m?.format||'Net stroke play')}"></label><label>Cadets Playing<div class="gr-check-grid">${membersOf(p).map(x=>`<label class="gr-check"><input type="checkbox" data-member="${E(x.id)}" ${memberIds.includes(x.id)?'checked':''}>${E(x.name)}</label>`).join('')}</div></label><label>Guests<div class="gr-guest-add"><input id="grGuestName" placeholder="Guest name"><button class="button secondary" id="grAddGuest" type="button">Add</button></div><div class="gr-guest-list" id="grGuests"></div></label><label>Notes<input id="grMNotes" value="${E(baseNotes)}"></label>${war?`<div class="chip" style="margin-top:10px">WAR · ${E(war.title)}</div>`:''}<div class="dialog-actions sticky-actions"><button class="button secondary" onclick="grCloseModal()">Cancel</button><button class="button primary" id="grMSave">Save Mission</button></div>`);
  let guests=[...gs];
  const drawGuests=()=>d.querySelector('#grGuests').innerHTML=guests.map((g,i)=>`<span class="gr-guest-pill">${E(g)} <button type="button" data-rmguest="${i}">✕</button></span>`).join('');
  drawGuests();
  d.querySelector('#grGuests').onclick=e=>{const i=e.target.dataset.rmguest;if(i!=null){guests.splice(Number(i),1);drawGuests()}};
  d.querySelector('#grAddGuest').onclick=()=>{const v=d.querySelector('#grGuestName').value.trim();if(v&&!guests.includes(v)){guests.push(v);d.querySelector('#grGuestName').value='';drawGuests()}};
  const courseEl=()=>d.querySelector('#grMCourse');
  const syncBanner=()=>{d.querySelector('#grBannerTitle').textContent=d.querySelector('#grMTitle').value||'Event name';d.querySelector('#grBannerCourse').textContent=courseEl()?.value||'Course TBD';d.querySelector('#grBannerDate').textContent='📅 '+fmtDate(d.querySelector('#grMDate').value);d.querySelector('#grBannerTime').textContent='⏱ '+fmtTime(d.querySelector('#grMTime').value);d.querySelector('#grBannerFormat').textContent=d.querySelector('#grMFormat').value||'Format TBD'};
  ['grMTitle','grMDate','grMTime','grMFormat'].forEach(x=>d.querySelector('#'+x).addEventListener('input',syncBanner));
  const sel=courseEl();
  if(sel){
    sel.addEventListener('change',()=>{
      if(sel.value==='__gr_add_course__'){
        const name=String(prompt('New course name')||'').trim();
        if(!name){sel.value=String(m?.locationName||'');syncBanner();return}
        let o=[...sel.options].find(x=>x.value===name);
        if(!o){o=document.createElement('option');o.value=name;o.textContent=name;const add=[...sel.options].find(x=>x.value==='__gr_add_course__');sel.insertBefore(o,add||null)}
        sel.value=name;
      }
      syncBanner();
    });
  }
  d.querySelector('#grMSave').onclick=()=>{
    const draftInput={title:d.querySelector('#grMTitle').value.trim()||'Mission',locationName:(d.querySelector('#grMCourse')?.value||'').trim()||'Course TBD',date:d.querySelector('#grMDate').value,teeTime:d.querySelector('#grMTime').value,format:d.querySelector('#grMFormat').value.trim(),participants:[...d.querySelectorAll('[data-member]:checked')].map(x=>x.dataset.member),notes:composeNotes(d.querySelector('#grMNotes').value,guests,warId||(m?warIdOf(m):'')),type:m?.type||'battle'};
    const prepared=typeof window.grPrepareMissionDraft==='function'?window.grPrepareMissionDraft(draftInput,{existing:m}):{ok:true,mission:Object.assign(m||{id:uid('mission'),type:'battle',status:'planned',results:[]},draftInput)};
    if(!prepared.ok){alert(prepared.error||'Could not save Mission.');return}
    const obj=prepared.mission;
    // Preserve preview/live/import tags from existing notes when editing.
    if(m?.notes){
      const keep=[];
      for(const re of [/\[\[GR_PREVIEW:[\s\S]*?\]\]/,/\[\[GR_LIVE:[^\]]*\]\]/,/\[\[GR_IMPORT_FP:[^\]]*\]\]/]){
        const hit=String(m.notes).match(re);if(hit)keep.push(hit[0]);
      }
      obj.notes=composeNotes(d.querySelector('#grMNotes').value,guests,warId||warIdOf(obj));
      if(keep.length)obj.notes+=`${obj.notes?'\n':''}${keep.join('\n')}`;
    }else obj.notes=composeNotes(d.querySelector('#grMNotes').value,guests,warId||warIdOf(obj));
    if(typeof window.grUpsertMission==='function')window.grUpsertMission(p,obj);else if(!m)p.missions.push(obj);else Object.assign(m,obj);
    savePlatoonLocal(p);closeModal();
  };
};

window.grOpenWarEditor=(id='')=>{
  const p=loadPlatoonLocal(),w=id?(p.missions||[]).find(x=>x.id===id&&x.type==='war'):null;
  const d=modal(`<div class="dialog-head"><div><div class="eyebrow">WAR</div><h2>${w?'Edit War':'New War'}</h2></div><button class="icon-button" onclick="grCloseModal()">✕</button></div><label>War Name<input id="grWTitle" value="${E(w?.title||'')}"></label><div class="grid two"><label>Start<input id="grWStart" type="date" value="${E(w?.date||'')}"></label><label>End<input id="grWEnd" type="date" value="${E(w?warEndOf(w):'')}"></label></div><label>Scoring<select id="grWScore"><option ${w?.format==='Points'?'selected':''}>Points</option><option ${w?.format==='Cumulative net'?'selected':''}>Cumulative net</option><option ${w?.format==='Cumulative gross'?'selected':''}>Cumulative gross</option><option ${w?.format==='Match-play points'?'selected':''}>Match-play points</option><option ${w?.format==='Team points'?'selected':''}>Team points</option></select></label><label>Notes<input id="grWNotes" value="${E(w?cleanNotes(w.notes):'')}"></label><div class="dialog-actions sticky-actions"><button class="button secondary" onclick="grCloseModal()">Cancel</button><button class="button primary" id="grWSave">Save War</button></div>`);
  d.querySelector('#grWSave').onclick=()=>{const obj=w||{id:uid('war'),type:'war',status:'planned',participants:[],results:[]};obj.title=d.querySelector('#grWTitle').value.trim()||'War';obj.date=d.querySelector('#grWStart').value;obj.teeTime='';obj.locationName='Multi-course';obj.format=d.querySelector('#grWScore').value;obj.notes=composeNotes(d.querySelector('#grWNotes').value,[],'',d.querySelector('#grWEnd').value);if(!w)p.missions.push(obj);savePlatoonLocal(p);closeModal()};
};

window.grLockMission=id=>{
  const p=loadPlatoonLocal();
  const out=typeof window.grLockMissionForPreview==='function'?window.grLockMissionForPreview(p,id):null;
  if(out&&!out.ok){alert(out.error||'Could not lock Mission.');return}
  if(!out){const m=(p.missions||[]).find(x=>x.id===id);if(!m)return;m.status='ready'}
  savePlatoonLocal(p);
  window.grViewMission(id);
};
window.grStartMission=id=>{
  const p=loadPlatoonLocal();
  const out=typeof window.grStartMissionLive==='function'?window.grStartMissionLive(p,id):null;
  if(out&&!out.ok){alert(out.error||'Could not start Mission.');return}
  savePlatoonLocal(p);
};
window.grReopenMission=id=>{
  if(!confirm('Return this Mission to Draft? Preview lock clears. Official results stay untouched.'))return;
  const p=loadPlatoonLocal();
  const out=typeof window.grReopenMissionDraft==='function'?window.grReopenMissionDraft(p,id):null;
  if(out&&!out.ok){alert(out.error||'Could not reopen Mission.');return}
  savePlatoonLocal(p);
};
window.grViewMission=id=>{
  const p=loadPlatoonLocal(),src=(p.missions||[]).find(x=>x.id===id);if(!src)return;
  const m=typeof window.grReadOnlyMission==='function'?(window.grReadOnlyMission(src)||src):src;
  const pre=previewFor(p,m),phase=phaseOf(m);
  const eyebrow=phase==='completed'?'AFTER ACTION REPORT':phase==='in_progress'?'IN PROGRESS':'PRE-MISSION INTEL';
  const body=phase==='completed'?`<div class="gr-summary gr-after-action">${missionSummaryMarkup(m)}</div>`:previewMarkup(pre);
  modal(`<div class="dialog-head"><div><div class="eyebrow">${eyebrow}</div><h2>${E(m.title||'Mission')}</h2></div><button class="icon-button" onclick="grCloseModal()">✕</button></div><div class="gr-event-banner"><div class="gr-event-course">${E(courseLabel(m.locationName))}</div><div class="gr-event-facts"><span class="gr-event-fact">📅 ${E(fmtDate(m.date))}</span><span class="gr-event-fact">⏱ ${E(fmtTime(m.teeTime))}</span><span class="gr-event-fact">${E(m.format||'')}</span><span class="gr-event-fact">${statusTag(m)}</span></div></div>${body}<div class="dialog-actions sticky-actions"><button class="button secondary" onclick="grCloseModal()">Close</button>${phase==='draft'?`<button class="button primary" onclick="grCloseModal();grLockMission('${E(m.id)}')">Create Preview / Lock</button>`:''}${phase==='ready'?`<button class="button primary" onclick="grCloseModal();grStartMission('${E(m.id)}')">Start Round</button>`:''}${phase!=='completed'?`<button class="button secondary" onclick="grCloseModal();grUploadScores('${E(m.id)}')">Import Scores</button>`:''}</div>`);
};
window.grUploadScores=id=>{if(typeof openMissionImport==='function')openMissionImport(id);else alert('Score import is unavailable.')};

window.grDeleteMission=id=>{
  if(typeof window.grRemoveMission==='function')return window.grRemoveMission(id);
  const p=loadPlatoonLocal(),m=(p.missions||[]).find(x=>x.id===id);if(!m)return;
  if(!confirm(`Delete ${m.title||'this Mission'}?\n\nThis permanently removes the Mission and its Platoon results. Your personal Golf Recon rounds are not deleted.`))return;
  (async()=>{
    try{
      if(typeof callPlatoonFunction==='function'){
        const out=await callPlatoonFunction({action:'delete_mission',mission_id:id});
        if(out?.platoon&&typeof writePlatoonLocal==='function')writePlatoonLocal(out.platoon);
        else{p.missions=(p.missions||[]).filter(x=>x.id!==id);if(typeof writePlatoonLocal==='function')writePlatoonLocal(p);else savePlatoonLocal(p)}
      }else{p.missions=(p.missions||[]).filter(x=>x.id!==id);savePlatoonLocal(p)}
      document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close()}catch{}});
      renderGroups();
    }catch(e){alert(`Delete failed: ${e?.message||e}`)}
  })();
};

if(!document.body.dataset.grPlatoonShellBound){
  document.body.dataset.grPlatoonShellBound='1';
  document.addEventListener('click',e=>{
    const tab=e.target.closest('[data-gr-subnav]');
    if(tab){e.preventDefault();goSubpage(tab.dataset.grSubnav||'home');return}
    if(e.target.closest('[data-platoon-home]')){platoonSubpage='home';renderGroups();return}
    if(e.target.closest('[data-cal-prev]')){const c=monthStart();calendarCursor=new Date(c.getFullYear(),c.getMonth()-1,1);renderGroups();return}
    if(e.target.closest('[data-cal-next]')){const c=monthStart();calendarCursor=new Date(c.getFullYear(),c.getMonth()+1,1);renderGroups();return}
    const mb=e.target.closest('[data-mission]');
    if(mb&&window.grViewMission){e.preventDefault();window.grViewMission(mb.dataset.mission)}
  });
}

try{groupsView=groupsV15}catch{window.groupsView=groupsV15}
window.grGroupsView=groupsV15;
const refresh=()=>{try{if(typeof state!=='undefined'&&state.view==='groups'&&typeof render==='function')render()}catch{}};
setTimeout(refresh,0);
})();
