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
const MISSION_FORMATS=[
  'Stroke play (gross)',
  'Stroke play (net)',
  'Stableford',
  'Match play',
  'Best Ball / Fourball',
  'Scramble',
  'Alternate Shot / Foursomes',
  'Skins',
  'Nassau',
  'Points',
  'Wolf',
  'Other'
];
const TEE_TIME_PRESETS=['07:00','07:30','08:00','08:30','09:00','09:30','10:00','11:00','12:00','13:00','14:00'];
function isoDate(y,m,d){return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function calendarView(){
  const p=loadPlatoonLocal(),cur=monthStart(),y=cur.getFullYear(),m=cur.getMonth(),first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();
  const missions=(p.missions||[]).filter(x=>x.type!=='war'&&x.date),map={};
  missions.forEach(x=>{const d=new Date(x.date+'T12:00:00');if(d.getFullYear()===y&&d.getMonth()===m)(map[d.getDate()]||=[]).push(x)});
  let cells='';
  for(let i=0;i<first;i++)cells+='<div class="gr-cal-pad" aria-hidden="true"></div>';
  for(let d=1;d<=days;d++){
    const items=map[d]||[],iso=isoDate(y,m,d),busy=items.length>0;
    cells+=`<button type="button" class="gr-cal-day ${busy?'has-missions':''}" data-cal-iso="${E(iso)}" aria-label="Schedule mission on ${E(iso)}"><div class="gr-cal-daynum">${d}</div>${items.map(x=>`<span class="gr-cal-mission" data-mission="${E(x.id)}">⛳ ${E(x.title||x.locationName||'Mission')}</span>`).join('')}${busy?'':`<span class="gr-cal-add">+ Mission</span>`}</button>`;
  }
  const label=cur.toLocaleString(undefined,{month:'long',year:'numeric'});
  return `${subHead('Calendar',p.name||'My Time')}<div class="card gr-cal-card"><div class="gr-cal-nav"><button class="icon-button" type="button" data-cal-prev aria-label="Previous month">‹</button><strong>${E(label)}</strong><button class="icon-button" type="button" data-cal-next aria-label="Next month">›</button></div><p class="muted gr-cal-hint">Tap a day to schedule a Mission. Tap an existing Mission to open it.</p><div class="gr-cal-dows">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div>${x}</div>`).join('')}</div><div class="gr-cal-grid">${cells}</div></div>`;
}
function blogView(){const p=loadPlatoonLocal();return `${subHead('Blog',(p.name||'My Time')+' Clubhouse')}<div class="card"><div class="empty" style="padding:34px 12px">No posts yet.</div></div>`}
function courseMenuName(c){
  if(typeof courseMenuLabel==='function')return courseMenuLabel(c);
  const n=c?.baseName||c?.name||'Course';
  return c?.tees?`${n} · ${c.tees}`:n;
}
function courseSelectMarkup(currentName,currentId){
  const curName=String(currentName||'').trim();
  const curId=String(currentId||'').trim();
  const opts=[];
  try{
    if(typeof db!=='undefined'&&Array.isArray(db.courses)){
      const list=db.courses.slice().sort((a,b)=>courseMenuName(a).localeCompare(courseMenuName(b)));
      for(const c of list){
        const selected=curId?String(c.id)===curId:(curName&&(c.name===curName||c.baseName===curName||courseMenuName(c)===curName));
        opts.push(`<option value="id:${E(c.id)}" ${selected?'selected':''}>${E(courseMenuName(c))}</option>`);
      }
    }
  }catch{}
  try{
    (loadPlatoonLocal().missions||[]).forEach(m=>{
      const n=String(m?.locationName||'').trim();
      if(!n||n==='Course TBD'||n==='Multi-course')return;
      if(opts.some(o=>o.includes(`>${E(n)}<`)||o.includes(`value="name:${E(n)}"`)))return;
      if(typeof db!=='undefined'&&Array.isArray(db.courses)&&db.courses.some(c=>c.name===n||c.baseName===n||courseMenuName(c)===n))return;
      opts.push(`<option value="name:${E(n)}" ${(!curId&&curName===n)?'selected':''}>${E(n)}</option>`);
    });
  }catch{}
  return `<select id="grMCourse" class="gr-mission-select"><option value="">Select course…</option>${opts.join('')}<option value="__gr_add_course__">＋ Add new course…</option></select>`;
}
function formatSelectMarkup(current){
  const cur=String(current||'Stroke play (net)').trim();
  const known=MISSION_FORMATS.includes(cur);
  const opts=MISSION_FORMATS.map(f=>`<option value="${E(f)}" ${(known?cur===f:(f==='Other'))?'selected':''}>${E(f)}</option>`).join('');
  return `<select id="grMFormatPick" class="gr-mission-select">${opts}</select><input id="grMFormatOther" class="gr-format-other" style="${known?'display:none':''}" value="${E(known?'':cur)}" placeholder="Custom format">`;
}
function resolveCourseSelection(raw){
  const v=String(raw||'').trim();
  if(!v||v==='__gr_add_course__')return {courseId:'',locationName:''};
  if(v.startsWith('id:')){
    const id=v.slice(3);
    try{
      const c=(typeof db!=='undefined'?db.courses:[]).find(x=>String(x.id)===id);
      if(c)return {courseId:c.id,locationName:courseMenuName(c)};
    }catch{}
    return {courseId:id,locationName:id};
  }
  if(v.startsWith('name:'))return {courseId:'',locationName:v.slice(5)};
  return {courseId:'',locationName:v};
}
function readMissionFormat(root){
  const pick=root.querySelector('#grMFormatPick')?.value||'';
  if(pick==='Other')return String(root.querySelector('#grMFormatOther')?.value||'').trim()||'Other';
  return pick;
}
function slugifyCourse(s){return String(s||'course').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'course'}
function ensureCourseInDb({name,tees,holes,par,rating,slope}){
  if(typeof db==='undefined'||!Array.isArray(db.courses))return null;
  const holesN=Number(holes)||18;
  const segment=holesN===18?'18 holes':'9 holes';
  let id=slugifyCourse(`${name}-${tees||'tees'}-${segment}`);
  let n=2,base=id;
  while(db.courses.some(c=>c.id===id))id=`${base}-${n++}`;
  const pars=Array(holesN).fill(null);
  const holeNumbers=Array.from({length:holesN},(_,i)=>i+1);
  const c={
    id,name,baseName:name,tees:tees||'Unknown',yardage:0,
    slope:Number.isFinite(Number(slope))?Number(slope):null,
    rating:Number.isFinite(Number(rating))?Number(rating):null,
    par:Number.isFinite(Number(par))?Number(par):null,
    pars,holeNumbers,handicaps:Array(holesN).fill(null),segment,imported:false,manual:true
  };
  db.courses.push(c);
  // Keep in-session course memory; server course catalog sync is a later pass.
  try{if(typeof state!=='undefined'&&!state.selectedCourseId)state.selectedCourseId=c.id}catch{}
  return c;
}
const uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const fmtTime=v=>{if(!v)return 'TBD';const [h,m]=String(v).slice(0,5).split(':').map(Number),d=new Date();d.setHours(h,m||0,0,0);return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})};
const fmtDate=v=>v?new Date(v+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}):'Date TBD';
function dateTile(v){if(!v)return '<div class="gr-date"><div class="d">—</div><div class="w">TBD</div></div>';const d=new Date(v+'T12:00:00');return `<div class="gr-date"><div class="m">${d.toLocaleString(undefined,{month:'short'}).toUpperCase()}</div><div class="d">${d.getDate()}</div><div class="w">${d.toLocaleString(undefined,{weekday:'short'}).toUpperCase()}</div></div>`}
function cleanNotes(v){return String(v||'').replace(/\n?\[\[GR_GUESTS:[\s\S]*?\]\]/g,'').replace(/\n?\[\[GR_WAR:[^\]]+\]\]/g,'').replace(/\n?\[\[GR_WAR_END:[^\]]*\]\]/g,'').replace(/\n?\[\[GR_PREVIEW:[\s\S]*?\]\]/g,'').replace(/\n?\[\[GR_LIVE:[^\]]*\]\]/g,'').replace(/\n?\[\[GR_IMPORT_FP:[^\]]*\]\]/g,'').trim()}
function guestsFromNotes(notes){
  const x=String(notes||'').match(/\[\[GR_GUESTS:([\s\S]*?)\]\]/);
  if(!x)return [];
  try{return (JSON.parse(x[1])||[]).map(g=>String(g||'').trim()).filter(Boolean)}catch{return []}
}
function guestsOf(m){
  const fromArr=Array.isArray(m?.guests)?m.guests.map(g=>String(g||'').trim()).filter(Boolean):null;
  const fromNotes=guestsFromNotes(m?.notes);
  // Prefer a non-empty guests array; otherwise fall back to notes tag (legacy / sync).
  if(fromArr&&fromArr.length)return fromArr;
  if(fromNotes.length)return fromNotes;
  return fromArr||[];
}
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
  // Prefer stored brief when present; otherwise rebuild so copy stays witty.
  if(stored&&(stored.brief||stored.narrative))return stored;
  if(typeof window.grBuildMissionPreview==='function')return window.grBuildMissionPreview(p,m);
  const same=(p.missions||[]).filter(x=>x.id!==m.id&&x.type!=='war'&&courseLabel(x.locationName)===courseLabel(m.locationName)&&x.status==='completed');
  const names=peopleOf(p,m).map(x=>x.name);
  const guests=guestsOf(m);
  const open=names.length
    ? `Tee sheet at ${courseLabel(m.locationName)} features ${names.length} hopeful${names.length===1?'':'s'} who somehow all swear this is "just a friendly."`
    : `Tee sheet at ${courseLabel(m.locationName)} is somehow empty — bold strategy.`;
  const cast=names.length?`On the card: ${names.join(', ')}.`:`Nobody checked in.`;
  const hist=same.length?`${same.length} prior Platoon round${same.length===1?'':'s'} here, and the lessons remain optional.`:`First Platoon Mission at ${courseLabel(m.locationName)} — legends loading.`;
  const jab=guests.length?`Guests (${guests.join(', ')}) are here as witnesses / scapegoats.`:`Expect early bravado and a late debate about conditions.`;
  const narrative=`${open} ${cast} ${hist} ${jab} Lock it, laugh first, and remember My Time Points don't care about your warm-up.`;
  return {
    battlefield:same.length?`${same.length} prior Platoon round${same.length===1?'':'s'} at ${courseLabel(m.locationName)}.`:`First Platoon Mission at ${courseLabel(m.locationName)}.`,
    watch:names.length?names.slice(0,4).join(' · '):'Field TBD',
    intel:[],
    brief:narrative,
    narrative
  };
}
function previewMarkup(pre){
  const intel=Array.isArray(pre?.intel)?pre.intel:[];
  const graph=String(pre?.brief||pre?.narrative||'').trim();
  const body=graph
    ? `<p class="gr-preview-brief">${E(graph)}</p>`
    : (intel.length?intel.map(x=>`<p>${E(x)}</p>`).join(''):`<p>${E(pre?.battlefield||'')}</p><p>${E(pre?.watch||'')}</p>`);
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
  return `<div class="gr-platoon-standings"><div class="gr-standings-title">${E(season)} My Time Points</div>${rows.map((r,i)=>`<div class="gr-platoon-standing-row"><span><b>${i+1}</b> ${E(r.name)}</span><strong>${Number(r.points||0)}</strong></div>`).join('')}</div>`;
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
  const table=rows.length?`<div class="gr-war-standings-label">War Standings</div><table class="gr-leaderboard"><thead><tr><th>Player</th><th>Played</th><th>Pts</th><th>${avgHead}</th></tr></thead><tbody>${rows.map((r,i)=>{const avg=mode.toLowerCase().includes('gross')?(r.avgGross!=null?Math.round(r.avgGross*10)/10:'—'):(r.avgNet!=null?Math.round(r.avgNet*10)/10:'—');return `<tr><td>${i+1}. ${E(r.name)}</td><td>${r.played||0}</td><td>${r.points||0}</td><td>${avg}</td></tr>`}).join('')}</tbody></table>`:'';
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
    : `<div class="card gr-empty-upcoming"><strong>No upcoming Missions</strong><span class="muted">Schedule the next round with + Mission, or tap a day on Calendar.</span></div>`;
  const completedBody=complete.length
    ? `<div class="gr-stack">${complete.map((m,i)=>completedMissionAccordion(p,m,i===0)).join('')}</div>`
    : `<div class="card gr-empty-upcoming"><strong>No completed Missions yet</strong><span class="muted">Finished rounds will stack here with standings and AAR.</span></div>`;
  const pastBtn=typeof window.grImportPastMission==='function'?`<button class="button secondary" data-gr-past-import="1" onclick="grImportPastMission()">📥 Import Past Mission</button>`:'';
  const home=`<div class="gr-platoons-home gr-clubhouse-landing">
    <section class="card gr-platoon-hq gr-clubhouse-hero">
      <div class="gr-clubhouse-brand">
        <div class="eyebrow">CLUBHOUSE</div>
        <div class="gr-platoon-name">${E(p.name||'My Time')}</div>
        <div class="gr-platoon-motto">${E(p.motto||'The flash board for the group.')}</div>
        <div class="gr-hq-actions">
          <button class="button secondary" onclick="grOpenSetup()">⚙ Setup</button>
          ${pastBtn}
          <button class="button primary" onclick="grOpenOperation()">+ Mission</button>
        </div>
      </div>
      <div class="gr-clubhouse-logo-wrap">${p.logoData?`<img class="gr-platoon-logo" src="${E(p.logoData)}" alt="Platoon logo">`:'<div class="gr-logo-placeholder">PLATOON<br>LOGO</div>'}</div>
      <div class="gr-clubhouse-board-wrap">${platoonStandingsMarkup(p)}</div>
    </section>
    ${wars.map(w=>warCard(p,w)).join('')}
    <section class="gr-section gr-upcoming-flash" id="grUpcomingMissions">
      <div class="gr-section-head"><div><div class="eyebrow">NEXT UP</div><h2>Upcoming Missions</h2></div></div>
      ${upcomingBody}
    </section>
    <section class="gr-section" id="grCompletedMissions">
      <div class="gr-section-head"><div><div class="eyebrow">ARCHIVE</div><h2>Completed Missions</h2></div></div>
      ${completedBody}
    </section>
  </div>`;
  return withSubNav(home);
}

function modal(inner){let d=document.getElementById('grPlatoonDialog');if(!d){d=document.createElement('dialog');d.id='grPlatoonDialog';document.body.appendChild(d)}d.innerHTML=`<div class="dialog-card">${inner}</div>`;d.showModal();return d}
function closeModal(){document.getElementById('grPlatoonDialog')?.close()}
window.grOpenOperation=()=>{modal(`<div class="dialog-head"><div><div class="eyebrow">NEW MISSION</div><h2>What are you creating?</h2></div><button class="icon-button" onclick="grCloseModal()">✕</button></div><div class="gr-choice-grid"><button class="card gr-choice" type="button" onclick="grCloseModal();grOpenMissionEditor()"><strong>Single Mission</strong><span class="muted">One competitive round — league night, Saturday game, outing</span></button><button class="card gr-choice" type="button" onclick="grCloseModal();grOpenWarEditor()"><strong>War</strong><span class="muted">Multiple Missions under one season / league series</span></button></div>`)};
window.grCloseModal=closeModal;
function compressImageFile(file,{max=1280,quality=.72}={}){
  return new Promise((resolve,reject)=>{
    const img=new Image(),r=new FileReader();
    r.onerror=()=>reject(r.error||new Error('Read failed'));
    r.onload=()=>{
      img.onload=()=>{
        const c=document.createElement('canvas');
        const scale=Math.min(1,max/Math.max(img.width,img.height));
        c.width=Math.max(1,Math.round(img.width*scale));
        c.height=Math.max(1,Math.round(img.height*scale));
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        resolve(c.toDataURL('image/jpeg',quality));
      };
      img.onerror=()=>reject(new Error('Image decode failed'));
      img.src=r.result;
    };
    r.readAsDataURL(file);
  });
}
function clubhousePhotosOf(p){
  return Array.isArray(p?.clubhousePhotos)?p.clubhousePhotos.filter(x=>x&&x.dataUrl).slice(0,8):[];
}
function renderClubhousePhotoThumbs(photos){
  if(!photos.length)return '<div class="muted" style="font-size:11px">No platoon photos yet — stock course shots still rotate.</div>';
  return `<div class="gr-clubhouse-thumbs">${photos.map(ph=>`<div class="gr-clubhouse-thumb" data-photo-id="${E(ph.id)}"><img src="${E(ph.dataUrl)}" alt=""><button type="button" class="gr-clubhouse-thumb-del" data-del-photo="${E(ph.id)}" title="Remove">✕</button></div>`).join('')}</div>`;
}

window.grOpenSetup=()=>{
  const p=loadPlatoonLocal();
  let photos=clubhousePhotosOf(p).map(x=>({...x}));
  const d=modal(`<div class="dialog-head"><div><div class="eyebrow">PLATOON</div><h2>Setup</h2></div><button class="icon-button" onclick="grCloseModal()">✕</button></div>
    <label>Name<input id="grPName" value="${E(p.name||'')}"></label>
    <label>Motto<input id="grPMotto" value="${E(p.motto||'')}"></label>
    <div class="grid two">
      <label>Season<input id="grPSeason" type="number" value="${E(p.season||new Date().getFullYear())}"></label>
      <label>Visibility<select id="grPVis"><option ${p.visibility==='Private'?'selected':''}>Private</option><option ${p.visibility==='Invite only'?'selected':''}>Invite only</option></select></label>
    </div>
    <label class="gr-logo-upload">${p.logoData?'Change Platoon Logo':'Upload Platoon Logo'}<input id="grPLogo" type="file" accept="image/*"></label>
    <div class="gr-clubhouse-photos-setup">
      <div class="eyebrow" style="margin-top:14px">CLUBHOUSE PHOTOS</div>
      <p class="muted" style="font-size:11px;margin:6px 0 8px">Mix your group shots into the background rotation with the stock course/lodge pics. Up to 8 photos (compressed on device).</p>
      <div id="grClubhouseThumbs">${renderClubhousePhotoThumbs(photos)}</div>
      <label class="gr-logo-upload" style="margin-top:8px">Add clubhouse photos<input id="grPClubPhotos" type="file" accept="image/*" multiple></label>
    </div>
    <div class="dialog-actions"><button class="button secondary" onclick="grCloseModal()">Cancel</button><button class="button primary" id="grPSave">Save</button></div>`);
  const thumbs=d.querySelector('#grClubhouseThumbs');
  const refreshThumbs=()=>{thumbs.innerHTML=renderClubhousePhotoThumbs(photos)};
  d.querySelector('#grPLogo').onchange=async e=>{
    const f=e.target.files?.[0];if(!f)return;
    try{d.dataset.logo=await compressImageFile(f,{max:256,quality:.82})}catch(err){alert(err.message||'Logo upload failed')}
  };
  d.querySelector('#grPClubPhotos').onchange=async e=>{
    const files=[...(e.target.files||[])];
    e.target.value='';
    for(const f of files){
      if(photos.length>=8){alert('Max 8 clubhouse photos for now.');break}
      try{
        const dataUrl=await compressImageFile(f,{max:1280,quality:.7});
        photos.push({id:`ph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,dataUrl,createdAt:new Date().toISOString()});
      }catch(err){alert(err.message||'Photo upload failed')}
    }
    refreshThumbs();
  };
  thumbs.onclick=e=>{
    const del=e.target.closest('[data-del-photo]');
    if(!del)return;
    photos=photos.filter(x=>String(x.id)!==String(del.getAttribute('data-del-photo')));
    refreshThumbs();
  };
  d.querySelector('#grPSave').onclick=()=>{
    p.name=d.querySelector('#grPName').value.trim()||'My Time';
    p.motto=d.querySelector('#grPMotto').value.trim();
    p.season=Number(d.querySelector('#grPSeason').value)||new Date().getFullYear();
    p.visibility=d.querySelector('#grPVis').value;
    if(d.dataset.logo)p.logoData=d.dataset.logo;
    p.clubhousePhotos=photos.slice(0,8);
    savePlatoonLocal(p);
    if(typeof window.grRefreshAtmos==='function')window.grRefreshAtmos();
    closeModal();
  };
};

window.grOpenMissionEditor=(id='',warId='',opts={})=>{
  const p=loadPlatoonLocal();
  const m=id?(p.missions||[]).find(x=>x.id===id):null;
  const linkedWarId=warId||(m?warIdOf(m):'')||'';
  const war=linkedWarId?(p.missions||[]).find(x=>x.id===linkedWarId&&x.type==='war'):null;
  const wars=(p.missions||[]).filter(x=>x.type==='war');
  const gs=Array.isArray(opts.guests)?opts.guests:(m?guestsOf(m):[]);
  const memberIds=Array.isArray(opts.participants)?opts.participants:(m?.participants||[]);
  const baseNotes=opts.notes!=null?String(opts.notes):(m?cleanNotes(m.notes):'');
  const presetDate=opts.date||m?.date||today();
  const presetTime=String(opts.teeTime||m?.teeTime||'').slice(0,5);
  const presetFormat=opts.format||m?.format||'Stroke play (net)';
  const presetTitle=opts.title!=null?String(opts.title):(m?.title||'');
  const warOptions=`<option value="">None — standalone Mission</option>${wars.map(w=>`<option value="${E(w.id)}" ${String(w.id)===String(linkedWarId)?'selected':''}>${E(w.title||'War')}</option>`).join('')}`;
  const timeChips=TEE_TIME_PRESETS.map(t=>`<button type="button" class="gr-time-chip" data-tee-preset="${t}">${fmtTime(t)}</button>`).join('');
  const d=modal(`<div class="dialog-head"><div><div class="eyebrow">MISSION</div><h2>${m?'Edit Mission':'New Mission'}</h2></div><button class="icon-button" onclick="grCloseModal()">✕</button></div>
    <div class="gr-event-banner"><div class="gr-event-name" id="grBannerTitle">${E(presetTitle||'Event name')}</div><div class="gr-event-course" id="grBannerCourse">${E(courseLabel(m?.locationName))}</div><div class="gr-event-facts"><span class="gr-event-fact" id="grBannerDate">📅 ${E(fmtDate(presetDate))}</span><span class="gr-event-fact" id="grBannerTime">⏱ ${E(fmtTime(presetTime))}</span><span class="gr-event-fact" id="grBannerFormat">${E(presetFormat||'Format TBD')}</span></div></div>
    <label>Event Name<input id="grMTitle" value="${E(presetTitle)}" placeholder="e.g. League Night 4"></label>
    <label>Course${courseSelectMarkup(m?.locationName,m?.courseId)}<span class="muted" style="font-size:10px;font-weight:600">Add new course to save tees, rating, slope &amp; par.</span></label>
    <div id="grCourseMeta" class="gr-course-meta muted" hidden></div>
    <div class="grid two">
      <label>Date<input id="grMDate" class="gr-datetime gr-date-picker" type="date" value="${E(presetDate)}" inputmode="none" autocomplete="off"></label>
      <label>Tee Time<input id="grMTime" class="gr-datetime gr-time-picker" type="time" step="900" value="${E(presetTime)}" inputmode="none" autocomplete="off"></label>
    </div>
    <div class="gr-date-quick"><button type="button" class="gr-time-chip" data-date-preset="today">Today</button><button type="button" class="gr-time-chip" data-date-preset="sat">Next Sat</button><button type="button" class="gr-time-chip" data-date-preset="sun">Next Sun</button></div>
    <div class="gr-time-presets">${timeChips}</div>
    <label>Format${formatSelectMarkup(presetFormat)}</label>
    <label>Attach to War<select id="grMWar" class="gr-mission-select">${warOptions}</select></label>
    <label>Cadets Playing<div class="gr-check-grid">${membersOf(p).map(x=>`<label class="gr-check"><input type="checkbox" data-member="${E(x.id)}" ${memberIds.includes(x.id)?'checked':''}>${E(x.name)}</label>`).join('')}</div></label>
    <label>Guests<div class="gr-guest-add"><input id="grGuestName" placeholder="Guest name"><button class="button secondary" id="grAddGuest" type="button">Add</button></div><div class="gr-guest-list" id="grGuests"></div></label>
    <label>Notes<textarea id="grMNotes" rows="2" placeholder="Optional">${E(baseNotes)}</textarea></label>
    <div class="dialog-actions sticky-actions"><button class="button secondary" onclick="grCloseModal()">Cancel</button><button class="button primary" id="grMSave">Save Mission</button></div>`);

  let guests=[...gs].map(g=>String(g||'').trim()).filter(Boolean);
  const drawGuests=()=>d.querySelector('#grGuests').innerHTML=guests.map((g,i)=>`<span class="gr-guest-pill">${E(g)} <button type="button" data-rmguest="${i}">✕</button></span>`).join('');
  drawGuests();
  const addGuest=()=>{
    const input=d.querySelector('#grGuestName');
    const v=String(input?.value||'').trim();
    if(!v)return;
    if(guests.some(g=>g.toLowerCase()===v.toLowerCase())){input.value='';return}
    guests.push(v);
    input.value='';
    drawGuests();
  };
  d.querySelector('#grGuests').onclick=e=>{const btn=e.target.closest('[data-rmguest]');if(!btn)return;guests.splice(Number(btn.getAttribute('data-rmguest')),1);drawGuests()};
  d.querySelector('#grAddGuest').onclick=e=>{e.preventDefault();addGuest()};
  d.querySelector('#grGuestName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addGuest()}});

  const courseEl=()=>d.querySelector('#grMCourse');
  const syncBanner=()=>{
    const resolved=resolveCourseSelection(courseEl()?.value);
    d.querySelector('#grBannerTitle').textContent=d.querySelector('#grMTitle').value||'Event name';
    d.querySelector('#grBannerCourse').textContent=resolved.locationName||'Course TBD';
    d.querySelector('#grBannerDate').textContent='📅 '+fmtDate(d.querySelector('#grMDate').value);
    d.querySelector('#grBannerTime').textContent='⏱ '+fmtTime(d.querySelector('#grMTime').value);
    d.querySelector('#grBannerFormat').textContent=readMissionFormat(d)||'Format TBD';
  };
  const syncCourseMeta=()=>{
    const meta=d.querySelector('#grCourseMeta');
    const resolved=resolveCourseSelection(courseEl()?.value);
    let c=null;
    try{if(resolved.courseId&&typeof db!=='undefined')c=db.courses.find(x=>String(x.id)===String(resolved.courseId))}catch{}
    if(!c||!meta){if(meta)meta.hidden=true;return}
    const bits=[c.tees?`Tees ${c.tees}`:'',c.par!=null?`Par ${c.par}`:'',c.rating!=null?`Rating ${c.rating}`:'',c.slope!=null?`Slope ${c.slope}`:'',c.segment||''].filter(Boolean);
    meta.textContent=bits.join(' · ')||'Course on file';
    meta.hidden=!bits.length;
  };
  const syncFormatOther=()=>{
    const other=d.querySelector('#grMFormatOther');
    const pick=d.querySelector('#grMFormatPick')?.value;
    if(other)other.style.display=pick==='Other'?'block':'none';
    syncBanner();
  };

  ['grMTitle','grMDate','grMTime','grMFormatOther'].forEach(x=>d.querySelector('#'+x)?.addEventListener('input',syncBanner));
  d.querySelector('#grMFormatPick')?.addEventListener('change',syncFormatOther);
  d.querySelectorAll('[data-tee-preset]').forEach(b=>b.addEventListener('click',()=>{d.querySelector('#grMTime').value=b.dataset.teePreset;syncBanner()}));
  d.querySelectorAll('[data-date-preset]').forEach(b=>b.addEventListener('click',()=>{
    const now=new Date();
    let target=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    if(b.dataset.datePreset==='sat'){const day=target.getDay();const add=((6-day)+7)%7||7;target.setDate(target.getDate()+add)}
    if(b.dataset.datePreset==='sun'){const day=target.getDay();const add=((0-day)+7)%7||7;target.setDate(target.getDate()+add)}
    d.querySelector('#grMDate').value=isoDate(target.getFullYear(),target.getMonth(),target.getDate());
    syncBanner();
  }));

  const openCourseWizard=()=>{
    const snap={
      date:d.querySelector('#grMDate')?.value||presetDate,
      teeTime:d.querySelector('#grMTime')?.value||presetTime,
      warId:String(d.querySelector('#grMWar')?.value||linkedWarId||''),
      title:d.querySelector('#grMTitle')?.value||'',
      format:readMissionFormat(d),
      notes:d.querySelector('#grMNotes')?.value||'',
      guests:[...guests],
      participants:[...d.querySelectorAll('[data-member]:checked')].map(x=>x.dataset.member)
    };
    const wiz=modal(`<div class="dialog-head"><div><div class="eyebrow">COURSE</div><h2>Add course</h2></div><button class="icon-button" id="grCourseCancel" type="button">✕</button></div>
      <p class="muted" style="font-size:12px">Saves into your Golf Recon course list with scorecard basics (par / rating / slope). Hole-by-hole maps can still come from Hole Preview later.</p>
      <label>Course name<input id="grCName" placeholder="Four Oaks Country Club" required></label>
      <div class="grid two"><label>Tees<input id="grCTees" placeholder="White / Blue" value="White"></label><label>Holes<select id="grCHoles"><option value="18">18</option><option value="9">9</option></select></label></div>
      <div class="grid three"><label>Par<input id="grCPar" type="number" inputmode="numeric" placeholder="72"></label><label>Rating<input id="grCRating" type="number" inputmode="decimal" step="0.1" placeholder="71.2"></label><label>Slope<input id="grCSlope" type="number" inputmode="numeric" placeholder="128"></label></div>
      <div class="dialog-actions sticky-actions"><button class="button secondary" id="grCourseCancel2" type="button">Cancel</button><button class="button primary" id="grCourseSave" type="button">Save course</button></div>`);
    const reopen=(extra={})=>{closeModal();window.grOpenMissionEditor(id,snap.warId,{
      date:snap.date,teeTime:snap.teeTime,title:snap.title,format:snap.format,notes:snap.notes,
      guests:snap.guests,participants:snap.participants,...extra
    })};
    wiz.querySelector('#grCourseCancel').onclick=()=>reopen();
    wiz.querySelector('#grCourseCancel2').onclick=()=>reopen();
    wiz.querySelector('#grCourseSave').onclick=()=>{
      const name=String(wiz.querySelector('#grCName').value||'').trim();
      if(!name){alert('Enter a course name.');return}
      const payload={
        name,
        tees:String(wiz.querySelector('#grCTees').value||'').trim()||'Unknown',
        holes:Number(wiz.querySelector('#grCHoles').value)||18,
        par:wiz.querySelector('#grCPar').value,
        rating:wiz.querySelector('#grCRating').value,
        slope:wiz.querySelector('#grCSlope').value
      };
      const created=ensureCourseInDb(payload);
      reopen({
        selectCourseId:created?.id||'',
        selectCourseName:created?courseMenuName(created):name
      });
    };
  };

  const sel=courseEl();
  if(sel){
    if(opts.selectCourseId){
      const val=`id:${opts.selectCourseId}`;
      if(![...sel.options].some(o=>o.value===val)){
        const o=document.createElement('option');o.value=val;o.textContent=opts.selectCourseName||opts.selectCourseId;sel.insertBefore(o,sel.querySelector('option[value="__gr_add_course__"]'));
      }
      sel.value=val;
    }else if(opts.selectCourseName){
      const val=`name:${opts.selectCourseName}`;
      if(![...sel.options].some(o=>o.value===val)){
        const o=document.createElement('option');o.value=val;o.textContent=opts.selectCourseName;sel.insertBefore(o,sel.querySelector('option[value="__gr_add_course__"]'));
      }
      sel.value=val;
    }
    sel.addEventListener('change',()=>{
      if(sel.value==='__gr_add_course__'){openCourseWizard();return}
      syncCourseMeta();syncBanner();
    });
  }
  syncFormatOther();syncCourseMeta();syncBanner();

  d.querySelector('#grMSave').onclick=()=>{
    const resolved=resolveCourseSelection(courseEl()?.value);
    const chosenWar=String(d.querySelector('#grMWar')?.value||'');
    const guestList=guests.map(g=>String(g||'').trim()).filter(Boolean);
    const composed=composeNotes(d.querySelector('#grMNotes').value,guestList,chosenWar);
    const draftInput={
      title:d.querySelector('#grMTitle').value.trim()||'Mission',
      locationName:resolved.locationName||'Course TBD',
      courseId:resolved.courseId||'',
      date:d.querySelector('#grMDate').value,
      teeTime:d.querySelector('#grMTime').value,
      format:readMissionFormat(d),
      participants:[...d.querySelectorAll('[data-member]:checked')].map(x=>x.dataset.member),
      guests:guestList,
      notes:composed,
      type:m?.type||'battle'
    };
    const prepared=typeof window.grPrepareMissionDraft==='function'?window.grPrepareMissionDraft(draftInput,{existing:m}):{ok:true,mission:Object.assign(m||{id:uid('mission'),type:'battle',status:'planned',results:[]},draftInput)};
    if(!prepared.ok){alert(prepared.error||'Could not save Mission.');return}
    const obj=prepared.mission;
    obj.guests=guestList;
    if(m?.notes){
      const keep=[];
      for(const re of [/\[\[GR_PREVIEW:[\s\S]*?\]\]/,/\[\[GR_LIVE:[^\]]*\]\]/,/\[\[GR_IMPORT_FP:[^\]]*\]\]/]){
        const hit=String(m.notes).match(re);if(hit)keep.push(hit[0]);
      }
      obj.notes=composed;
      if(keep.length)obj.notes+=`${obj.notes?'\n':''}${keep.join('\n')}`;
    }else obj.notes=composed;
    obj.courseId=resolved.courseId||obj.courseId||'';
    if(typeof window.grUpsertMission==='function')window.grUpsertMission(p,obj);else if(!m)p.missions.push(obj);else Object.assign(m,obj);
    savePlatoonLocal(p);closeModal();
  };
};

window.grOpenWarEditor=(id='')=>{
  const p=loadPlatoonLocal(),w=id?(p.missions||[]).find(x=>x.id===id&&x.type==='war'):null;
  const d=modal(`<div class="dialog-head"><div><div class="eyebrow">WAR</div><h2>${w?'Edit War':'New War'}</h2></div><button class="icon-button" onclick="grCloseModal()">✕</button></div>
    <label>War Name<input id="grWTitle" value="${E(w?.title||'')}"></label>
    <div class="grid two">
      <label>Start<input id="grWStart" class="gr-datetime gr-date-picker" type="date" value="${E(w?.date||'')}" inputmode="none" autocomplete="off"><div class="gr-date-quick"><button type="button" class="gr-time-chip" data-war-date="grWStart" data-date-preset="today">Today</button><button type="button" class="gr-time-chip" data-war-date="grWStart" data-date-preset="sat">Next Sat</button><button type="button" class="gr-time-chip" data-war-date="grWStart" data-date-preset="sun">Next Sun</button></div></label>
      <label>End<input id="grWEnd" class="gr-datetime gr-date-picker" type="date" value="${E(w?warEndOf(w):'')}" inputmode="none" autocomplete="off"><div class="gr-date-quick"><button type="button" class="gr-time-chip" data-war-date="grWEnd" data-date-preset="today">Today</button><button type="button" class="gr-time-chip" data-war-date="grWEnd" data-date-preset="sat">Next Sat</button><button type="button" class="gr-time-chip" data-war-date="grWEnd" data-date-preset="sun">Next Sun</button></div></label>
    </div>
    <label>Scoring<select id="grWScore" class="gr-mission-select"><option ${w?.format==='Points'?'selected':''}>Points</option><option ${w?.format==='Cumulative net'?'selected':''}>Cumulative net</option><option ${w?.format==='Cumulative gross'?'selected':''}>Cumulative gross</option><option ${w?.format==='Match-play points'?'selected':''}>Match-play points</option><option ${w?.format==='Team points'?'selected':''}>Team points</option></select></label>
    <label>Notes<textarea id="grWNotes" rows="2">${E(w?cleanNotes(w.notes):'')}</textarea></label>
    <div class="dialog-actions sticky-actions"><button class="button secondary" onclick="grCloseModal()">Cancel</button><button class="button primary" id="grWSave">Save War</button></div>`);
  d.querySelectorAll('[data-war-date]').forEach(b=>b.addEventListener('click',()=>{
    const now=new Date();let target=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    if(b.dataset.datePreset==='sat'){const day=target.getDay();const add=((6-day)+7)%7||7;target.setDate(target.getDate()+add)}
    if(b.dataset.datePreset==='sun'){const day=target.getDay();const add=((0-day)+7)%7||7;target.setDate(target.getDate()+add)}
    d.querySelector('#'+b.dataset.warDate).value=isoDate(target.getFullYear(),target.getMonth(),target.getDate());
  }));
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
    const missionChip=e.target.closest('[data-mission]');
    if(missionChip&&window.grViewMission){e.preventDefault();e.stopPropagation();window.grViewMission(missionChip.dataset.mission);return}
    const calDay=e.target.closest('[data-cal-iso]');
    if(calDay&&window.grOpenMissionEditor){e.preventDefault();window.grOpenMissionEditor('','',{date:calDay.dataset.calIso});return}
  });
}

/* App-wide: date/time open native picker; block keyboard typing (no readonly — that breaks pickers) */
(function installPickerOnlyDates(){
  if(document.documentElement.dataset.grPickerOnly)return;
  document.documentElement.dataset.grPickerOnly='1';
  const isDT=el=>el&&el.matches?.('input[type="date"],input[type="time"]');
  const harden=el=>{
    if(!isDT(el)||el.dataset.grPickerBound)return;
    el.dataset.grPickerBound='1';
    el.removeAttribute('readonly');
    el.setAttribute('inputmode','none');
    el.setAttribute('autocomplete','off');
    el.classList.add(el.type==='time'?'gr-time-picker':'gr-date-picker');
  };
  const openPicker=el=>{
    harden(el);
    try{if(typeof el.showPicker==='function')el.showPicker()}catch{}
  };
  document.addEventListener('click',e=>{if(isDT(e.target))openPicker(e.target)},true);
  document.addEventListener('focusin',e=>{if(isDT(e.target)){harden(e.target);try{e.target.showPicker?.()}catch{}}},true);
  document.addEventListener('keydown',e=>{
    if(!isDT(e.target))return;
    if(e.key==='Tab'||e.key==='Escape')return;
    e.preventDefault();
    if(e.key==='Enter'||e.key===' '||e.key==='ArrowDown')openPicker(e.target);
  },true);
  document.addEventListener('beforeinput',e=>{if(isDT(e.target))e.preventDefault()},true);
  const scan=root=>{(root||document).querySelectorAll?.('input[type="date"],input[type="time"]').forEach(harden)};
  scan(document);
  new MutationObserver(muts=>{
    for(const m of muts){
      if(m.type==='childList')m.addedNodes.forEach(n=>{if(n.nodeType===1){harden(n);scan(n)}});
      if(m.type==='attributes'&&isDT(m.target))harden(m.target);
    }
  }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['type']});
})();

try{groupsView=groupsV15}catch{window.groupsView=groupsV15}
window.grGroupsView=groupsV15;
const refresh=()=>{try{if(typeof state!=='undefined'&&state.view==='groups'&&typeof render==='function')render()}catch{}};
setTimeout(refresh,0);
})();
