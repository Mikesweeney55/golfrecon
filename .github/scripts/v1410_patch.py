from pathlib import Path

p=Path('index.html')
s=p.read_text()
assert 'Golf Recon v14.9 Beta' in s
assert 'function groupsView(){' in s
assert 'function scoreDifferential(r){' in s
assert 'function gameKeysPregameHtml(){' in s

s=s.replace('Golf Recon v14.9 Beta','Golf Recon v14.10 Beta')
s=s.replace('v14.9 Beta','v14.10 Beta')

css=r'''
/* v14.10 Platoons interaction layer */
.platoon-command-actions{display:flex;gap:8px;flex-wrap:wrap;position:relative;z-index:2}
.platoon-motto{font-size:15px;font-weight:750;color:#dbe8e1;margin-top:5px}
.platoon-adminline{font-size:10px;color:var(--muted);margin-top:9px;display:flex;gap:12px;flex-wrap:wrap}
.platoon-adminline strong{color:#eaf2ee}
.calendar-day{position:relative;text-align:left;cursor:pointer;width:100%;color:inherit;font:inherit}
button.calendar-day{appearance:none}
.calendar-day:hover{border-color:rgba(184,234,104,.32);background:rgba(184,234,104,.035)}
.calendar-mission{display:block;margin-top:5px;border-radius:6px;padding:3px 4px;font-size:7px;font-weight:900;line-height:1.05;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:rgba(184,234,104,.10);border:1px solid rgba(184,234,104,.20);color:#dff7ba}
.calendar-mission.battle{background:rgba(255,226,114,.08);border-color:rgba(255,226,114,.25);color:#ffe272}.calendar-mission.war{background:rgba(255,77,79,.09);border-color:rgba(255,77,79,.28);color:#ff9d9d}
.mission-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.mission-actions .button{padding:9px 12px;font-size:11px}
.mission-hero-line{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.mission-hero-title{font-size:20px;font-weight:900;margin:6px 0 4px}.mission-meta{font-size:11px;color:var(--muted)}
.platoon-modal{width:min(620px,calc(100% - 24px));max-height:calc(100dvh - 28px)}.platoon-modal .dialog-card{max-height:calc(100dvh - 28px);overflow:auto;-webkit-overflow-scrolling:touch}.platoon-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.platoon-form-grid label{margin-top:0}.platoon-roster-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}.platoon-roster-check{display:flex;gap:7px;align-items:center;border:1px solid var(--line);background:#101914;border-radius:10px;padding:8px;font-size:11px}.platoon-roster-check input{width:auto;margin:0}.platoon-results-table{width:100%;border-collapse:collapse;margin-top:10px;font-size:11px}.platoon-results-table th,.platoon-results-table td{padding:7px 5px;border-bottom:1px solid var(--line);text-align:left}.platoon-results-table th{color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.06em}.platoon-file-list{font-size:10px;color:var(--muted);margin-top:8px}.platoon-notice{font-size:10px;color:var(--muted);padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:#101914;margin-top:10px}
.platoon-role{font-size:8px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;padding:3px 6px;border-radius:999px;border:1px solid var(--line);color:var(--muted)}.platoon-role.chief{color:var(--accent);border-color:rgba(184,234,104,.30)}.platoon-role.co_chief{color:#7edbff;border-color:rgba(126,219,255,.28)}
@media(max-width:700px){.platoon-command-actions{margin-top:12px}.platoon-form-grid{grid-template-columns:1fr}.platoon-roster-checks{grid-template-columns:1fr 1fr}.calendar-day{min-height:46px}.calendar-mission{font-size:6px}}
'''
assert '/* v14.10 Platoons interaction layer */' not in s
s=s.replace('</style>',css+'\n</style>',1)

block=r'''const PLATOON_LOCAL_KEY='golfreconPlatoonV1410';
function platoonDefault(){
  const chief=db.player?.name||db.player?.username||'Golfer';
  return {id:'my-time-local',name:'My Time',motto:"It's Not About The Golf",season:new Date().getFullYear(),visibility:'Private',chief,coChief:'',members:[
    {id:'chief',name:chief,linked:true,role:'chief'},
    {id:'sully',name:'Sully',linked:false,role:'cadet'},
    {id:'steve',name:'Steve',linked:false,role:'cadet'},
    {id:'chuck',name:'Chuck',linked:false,role:'cadet'},
    {id:'cunny',name:'Cunny',linked:false,role:'cadet'},
    {id:'mannke',name:'Mannke',linked:false,role:'cadet'}
  ],missions:[]};
}
function loadPlatoonLocal(){
  const d=platoonDefault();
  try{
    const x=JSON.parse(localStorage.getItem(PLATOON_LOCAL_KEY)||'null');
    if(!x)return d;
    const p={...d,...x};
    p.members=Array.isArray(x.members)&&x.members.length?x.members:d.members;
    p.missions=Array.isArray(x.missions)?x.missions:[];
    return p;
  }catch{return d}
}
function savePlatoonLocal(p){try{localStorage.setItem(PLATOON_LOCAL_KEY,JSON.stringify(p))}catch{} render()}
function platoonRoleLabel(r){return r==='chief'?'Platoon Chief':r==='co_chief'?'Co-Chief':r==='member'?'Member':'Cadet'}
function platoonMissionTypeLabel(v){return v==='war'?'War':v==='battle'?'Battle':'Skirmish'}
function platoonMissionDate(v){if(!v)return 'Date TBD';const d=new Date(v+'T12:00:00');return d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'})}
function platoonMember(p,id){return (p.members||[]).find(x=>String(x.id)===String(id))}
function platoonDialog(html){
  document.getElementById('platoonDynamicDialog')?.remove();
  const d=document.createElement('dialog');d.id='platoonDynamicDialog';d.className='platoon-modal';d.innerHTML=`<div class="dialog-card">${html}</div>`;document.body.appendChild(d);d.addEventListener('close',()=>d.remove());d.showModal();return d;
}
function closePlatoonDialog(){document.getElementById('platoonDynamicDialog')?.close()}
function openPlatoonSetup(){
  const p=loadPlatoonLocal();
  const coOptions=['<option value="">No Co-Chief selected</option>',...(p.members||[]).filter(m=>m.role!=='chief').map(m=>`<option value="${safeText(m.id)}" ${p.coChief===m.id?'selected':''}>${safeText(m.name)}</option>`)].join('');
  const d=platoonDialog(`<div class="dialog-head"><div><div class="eyebrow">PLATOON SETUP</div><h2 style="margin:5px 0 0">${safeText(p.name)}</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div>
    <div class="platoon-form-grid" style="margin-top:16px"><label>Platoon name<input id="platoonSetupName" value="${safeText(p.name)}"></label><label>Season<input id="platoonSetupSeason" type="number" min="2020" max="2100" value="${Number(p.season)||new Date().getFullYear()}"></label></div>
    <label>Motto<input id="platoonSetupMotto" value="${safeText(p.motto||'')}" placeholder="Optional"></label>
    <div class="platoon-form-grid"><label>Platoon Chief<input value="${safeText(p.chief||'')}" disabled></label><label>Co-Chief<select id="platoonSetupCoChief">${coOptions}</select></label></div>
    <label>Add a cadet<input id="platoonSetupNewCadet" placeholder="Name"></label>
    <div class="platoon-notice">The Platoon Chief has full control. The Co-Chief can create and manage Missions, participants and result imports.</div>
    <div class="dialog-actions"><button class="button secondary" type="button" onclick="closePlatoonDialog()">Cancel</button><button class="button primary" id="savePlatoonSetupBtn" type="button">Save Setup</button></div>`);
  d.querySelector('#savePlatoonSetupBtn').onclick=()=>{
    p.name=String(d.querySelector('#platoonSetupName').value||'').trim()||'My Time';
    p.motto=String(d.querySelector('#platoonSetupMotto').value||'').trim();
    p.season=Number(d.querySelector('#platoonSetupSeason').value)||new Date().getFullYear();
    p.coChief=String(d.querySelector('#platoonSetupCoChief').value||'');
    p.members=(p.members||[]).map(m=>({...m,role:m.role==='chief'?'chief':(p.coChief===m.id?'co_chief':(m.linked?'member':'cadet'))}));
    const newCadet=String(d.querySelector('#platoonSetupNewCadet').value||'').trim();
    if(newCadet && !p.members.some(m=>m.name.toLowerCase()===newCadet.toLowerCase()))p.members.push({id:'cadet-'+Date.now(),name:newCadet,linked:false,role:'cadet'});
    savePlatoonLocal(p);d.close();
  };
}
function openMissionEditor(date='',missionId=''){
  const p=loadPlatoonLocal(),existing=(p.missions||[]).find(m=>m.id===missionId)||null;
  const selected=new Set(existing?.participants||[]);
  const courses=sortedCourses();
  const courseOpts=['<option value="">Choose course</option>',...courses.map(c=>`<option value="${safeText(c.id)}" ${(existing?.courseId===c.id)?'selected':''}>${safeText(courseMenuLabel(c))}</option>`)].join('');
  const memberChecks=(p.members||[]).map(m=>`<label class="platoon-roster-check"><input type="checkbox" data-mission-member="${safeText(m.id)}" ${selected.has(m.id)?'checked':''}><span>${safeText(m.name)}</span></label>`).join('');
  const d=platoonDialog(`<div class="dialog-head"><div><div class="eyebrow">MISSION CONTROL</div><h2 style="margin:5px 0 0">${existing?'Edit Mission':'Create Mission'}</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div>
    <div class="platoon-form-grid" style="margin-top:16px"><label>Date<input id="missionDate" type="date" value="${safeText(existing?.date||date||'')}"></label><label>Tee time<input id="missionTime" type="time" value="${safeText(existing?.teeTime||'')}"></label></div>
    <div class="platoon-form-grid"><label>Mission level<select id="missionType"><option value="skirmish" ${existing?.type==='skirmish'?'selected':''}>Skirmish</option><option value="battle" ${existing?.type==='battle'||!existing?'selected':''}>Battle</option><option value="war" ${existing?.type==='war'?'selected':''}>War</option></select></label><label>Course<select id="missionCourse">${courseOpts}</select></label></div>
    <label>Other location<input id="missionLocation" value="${safeText(existing?.locationName&&!existing?.courseId?existing.locationName:'')}" placeholder="Use if the course is not in Golf Recon"></label>
    <div class="platoon-form-grid"><label>Title<input id="missionTitle" value="${safeText(existing?.title||'')}" placeholder="Optional"></label><label>Format<input id="missionFormat" value="${safeText(existing?.format||'')}" placeholder="Skins, stroke play, teams..."></label></div>
    <label>Rules / notes<textarea id="missionNotes" style="min-height:84px;background:#0e1714;color:var(--text);border:1px solid var(--line);border-radius:12px;padding:11px">${safeText(existing?.notes||'')}</textarea></label>
    <div class="eyebrow" style="margin-top:14px">CADETS</div><div class="platoon-roster-checks">${memberChecks}</div>
    <div class="dialog-actions"><button class="button secondary" type="button" onclick="closePlatoonDialog()">Cancel</button><button class="button primary" id="saveMissionBtn" type="button">Save Mission</button></div>`);
  d.querySelector('#saveMissionBtn').onclick=()=>{
    const dt=String(d.querySelector('#missionDate').value||'');if(!dt){alert('Choose a Mission date.');return}
    const cid=String(d.querySelector('#missionCourse').value||'');const c=courses.find(x=>x.id===cid);const other=String(d.querySelector('#missionLocation').value||'').trim();
    if(!c&&!other){alert('Choose a course or enter a location.');return}
    const participants=[...d.querySelectorAll('[data-mission-member]:checked')].map(x=>x.dataset.missionMember);
    const row={id:existing?.id||'mission-'+Date.now(),date:dt,teeTime:String(d.querySelector('#missionTime').value||''),type:String(d.querySelector('#missionType').value||'battle'),courseId:c?.id||'',locationName:c?courseMenuLabel(c):other,title:String(d.querySelector('#missionTitle').value||'').trim(),format:String(d.querySelector('#missionFormat').value||'').trim(),notes:String(d.querySelector('#missionNotes').value||'').trim(),participants,status:existing?.status||'planned',results:existing?.results||null};
    if(existing)Object.assign(existing,row);else p.missions.push(row);
    savePlatoonLocal(p);d.close();
  };
}
function openMissionDetail(id){
  const p=loadPlatoonLocal(),m=(p.missions||[]).find(x=>x.id===id);if(!m)return;
  const players=(m.participants||[]).map(pid=>platoonMember(p,pid)?.name).filter(Boolean);
  const results=Array.isArray(m.results)?m.results:[];
  const table=results.length?`<table class="platoon-results-table"><thead><tr><th>Cadet</th><th>Gross</th><th>Net</th><th>Pos</th><th>Pts</th></tr></thead><tbody>${results.map(r=>`<tr><td>${safeText(r.player_name)}</td><td>${r.gross??'—'}</td><td>${r.net??'—'}</td><td>${r.finish_position??'—'}</td><td>${r.raw_points??'—'}</td></tr>`).join('')}</tbody></table>`:'<div class="platoon-notice">No Mission results imported yet.</div>';
  platoonDialog(`<div class="dialog-head"><div><div class="eyebrow">${platoonMissionTypeLabel(m.type).toUpperCase()} · ${safeText(String(m.status||'planned').toUpperCase())}</div><h2 style="margin:5px 0 0">${safeText(m.title||m.locationName)}</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div>
    <div class="mission-meta" style="margin-top:9px">${safeText(platoonMissionDate(m.date))}${m.teeTime?` · ${safeText(m.teeTime)}`:''} · ${safeText(m.locationName)}</div>
    ${m.format?`<div class="platoon-notice"><strong>Format:</strong> ${safeText(m.format)}</div>`:''}${m.notes?`<div class="platoon-notice">${safeText(m.notes)}</div>`:''}
    <div class="eyebrow" style="margin-top:15px">CADETS</div><div class="muted" style="font-size:11px;margin-top:5px">${players.length?safeText(players.join(' · ')):'No participants selected.'}</div>
    <div class="eyebrow" style="margin-top:16px">RESULTS</div>${table}
    <div class="mission-actions"><button class="button secondary" type="button" onclick="closePlatoonDialog();openMissionEditor('${safeText(m.date)}','${safeText(m.id)}')">Edit Mission</button><button class="button primary" type="button" onclick="closePlatoonDialog();openMissionImport('${safeText(m.id)}')">Import Mission Results</button></div>`);
}
async function platoonFilePayload(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve({type:file.type||'image/jpeg',data:String(r.result||'').split(',')[1]||''});r.onerror=reject;r.readAsDataURL(file)})}
async function callPlatoonFunction(payload,retry=true){
  const session=await ensureAuthSession();if(!session?.access_token)throw new Error('Please sign in again.');
  const res=await fetch(`${SUPABASE_URL}/functions/v1/platoon-import`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify(payload)});
  const body=await res.json().catch(()=>({error:'Invalid server response'}));
  if(res.status===401&&retry&&authSession?.refresh_token){try{await refreshAuthSession();return callPlatoonFunction(payload,false)}catch{}}
  if(!res.ok)throw new Error(body.error||body.message||`Platoon request failed (${res.status})`);return body;
}
function openMissionImport(id){
  const p=loadPlatoonLocal(),m=(p.missions||[]).find(x=>x.id===id);if(!m)return;
  const d=platoonDialog(`<div class="dialog-head"><div><div class="eyebrow">MISSION RESULTS IMPORT</div><h2 style="margin:5px 0 0">${safeText(m.title||m.locationName)}</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div>
    <div class="platoon-notice">Upload the 18Birdies event/league results screen. This import is separate from a golfer's detailed Golf Recon round.</div>
    <label class="upload-zone" style="cursor:pointer"><strong>Add results screenshots</strong><span>Gross · Net · Finish · Points</span><input id="platoonImportFiles" type="file" accept="image/*" multiple></label>
    <div id="platoonImportFileList" class="platoon-file-list"></div><div id="platoonImportOutput"></div>
    <div class="dialog-actions"><button class="button secondary" type="button" onclick="closePlatoonDialog()">Cancel</button><button class="button primary" id="parsePlatoonResultsBtn" type="button">Parse Results</button></div>`);
  const input=d.querySelector('#platoonImportFiles'),list=d.querySelector('#platoonImportFileList'),out=d.querySelector('#platoonImportOutput'),btn=d.querySelector('#parsePlatoonResultsBtn');
  input.onchange=()=>{list.textContent=[...input.files].map(f=>f.name).join(' · ')};
  btn.onclick=async()=>{
    const files=[...input.files];if(!files.length){out.innerHTML='<div class="platoon-notice">Add at least one screenshot.</div>';return}
    btn.disabled=true;btn.textContent='Parsing…';out.innerHTML='<div class="platoon-notice">Reading Mission results…</div>';
    try{
      const images=[];for(const f of files)images.push(await platoonFilePayload(f));
      const parsed=await callPlatoonFunction({action:'parse_results',mission:{date:m.date,locationName:m.locationName,title:m.title},images});
      const rows=parsed.results||[];
      out.innerHTML=`<div class="platoon-notice">Confidence ${Math.round(100*(parsed.confidence||0))}%${(parsed.warnings||[]).length?` · ${safeText(parsed.warnings.join(' · '))}`:''}</div><table class="platoon-results-table"><thead><tr><th>Player</th><th>Gross</th><th>Net</th><th>Pos</th><th>Pts</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${safeText(r.player_name)}</td><td>${r.gross??'—'}</td><td>${r.net??'—'}</td><td>${r.finish_position??'—'}</td><td>${r.raw_points??'—'}</td></tr>`).join('')}</tbody></table><div class="dialog-actions"><button class="button primary" id="saveParsedMissionResults" type="button">Save Results</button></div>`;
      out.querySelector('#saveParsedMissionResults').onclick=()=>{m.results=rows;m.status='completed';savePlatoonLocal(p);d.close();};
    }catch(e){out.innerHTML=`<div class="platoon-notice" style="border-color:rgba(255,77,79,.35);color:#ffadad">${safeText(e.message||String(e))}</div>`}finally{btn.disabled=false;btn.textContent='Parse Results'}
  };
}
function groupsView(){
  const p=loadPlatoonLocal(),now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const missions=(p.missions||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const nextMission=missions.find(m=>m.date>=today&&m.status!=='cancelled');
  const year=now.getFullYear(),month=now.getMonth(),monthName=now.toLocaleString(undefined,{month:'long',year:'numeric'}),firstDay=new Date(year,month,1).getDay(),daysInMonth=new Date(year,month+1,0).getDate(),prevDays=new Date(year,month,0).getDate();
  const cells=[];for(let i=firstDay-1;i>=0;i--)cells.push(`<div class="calendar-day muted-day">${prevDays-i}</div>`);
  for(let d=1;d<=daysInMonth;d++){
    const iso=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,dayMissions=missions.filter(m=>m.date===iso),first=dayMissions[0];
    cells.push(`<button type="button" class="calendar-day ${d===now.getDate()?'today':''}" onclick="${first?`openMissionDetail('${first.id}')`:`openMissionEditor('${iso}')`}">${d}${first?`<span class="calendar-mission ${first.type}">${platoonMissionTypeLabel(first.type)} · ${safeText(first.title||first.locationName)}</span>`:''}${dayMissions.length>1?`<span class="calendar-mission">+${dayMissions.length-1} more</span>`:''}</button>`);
  }
  let n=1;while(cells.length%7)cells.push(`<div class="calendar-day muted-day">${n++}</div>`);
  const chief=(p.members||[]).find(m=>m.role==='chief'),co=(p.members||[]).find(m=>m.role==='co_chief');
  const roster=(p.members||[]).map(m=>`<div class="roster-row"><div><div class="roster-name">${safeText(m.name)}</div><div class="roster-role">${m.linked?'Golf Recon linked':'Cadet profile'}</div></div><span class="platoon-role ${m.role}">${safeText(platoonRoleLabel(m.role))}</span></div>`).join('');
  const missionCard=nextMission?`<section class="card mission-card"><div class="mission-banner"><span class="mission-tag ${nextMission.type}">${platoonMissionTypeLabel(nextMission.type)}</span></div><div class="mission-empty"><div class="mission-hero-line"><div><div class="mission-hero-title">${safeText(nextMission.title||nextMission.locationName)}</div><div class="mission-meta">${safeText(platoonMissionDate(nextMission.date))}${nextMission.teeTime?` · ${safeText(nextMission.teeTime)}`:''} · ${safeText(nextMission.locationName)}</div></div></div><div class="mission-actions"><button class="button primary" type="button" onclick="openMissionDetail('${safeText(nextMission.id)}')">Open Mission</button><button class="button secondary" type="button" onclick="openMissionEditor()">Create Mission</button></div></div></section>`:`<section class="card mission-card"><div class="mission-banner"><span class="mission-tag battle">MISSION CONTROL</span></div><div class="mission-empty"><strong>No upcoming mission scheduled.</strong><div class="mission-actions"><button class="button primary" type="button" onclick="openMissionEditor()">Create Mission</button></div></div></section>`;
  const resultCount=missions.filter(m=>Array.isArray(m.results)&&m.results.length).length;
  return `<div class="section-head"><div><div class="eyebrow">PLATOON HQ</div><h2>${safeText(p.name)}</h2></div><div class="platoon-command-actions"><button class="button secondary" type="button" onclick="openPlatoonSetup()">⚙ Setup</button><button class="button primary" type="button" onclick="openMissionEditor()">+ Mission</button></div></div>
  <div class="platoon-shell"><section class="card platoon-command"><div class="platoon-command-head"><div><div class="eyebrow">${safeText(p.name.toUpperCase())} · ACTIVE PLATOON</div><div class="platoon-title">${safeText(p.name)}</div>${p.motto?`<div class="platoon-motto">${safeText(p.motto)}</div>`:''}<div class="platoon-adminline"><span><strong>Platoon Chief</strong> ${safeText(chief?.name||p.chief||'—')}</span><span><strong>Co-Chief</strong> ${safeText(co?.name||'Not assigned')}</span></div></div></div><div class="platoon-status"><span class="badge">${Number(p.season)||new Date().getFullYear()} season</span><span class="badge">${(p.members||[]).length} cadets</span><span class="badge">${safeText(p.visibility||'Private')}</span></div><div class="platoon-kpis"><div class="platoon-kpi"><strong>${nextMission?safeText(platoonMissionTypeLabel(nextMission.type)):'—'}</strong><span>Next Mission</span></div><div class="platoon-kpi"><strong>${missions.length}</strong><span>Missions</span></div><div class="platoon-kpi"><strong>${resultCount}</strong><span>Results Loaded</span></div><div class="platoon-kpi"><strong>—</strong><span>Club Eagles</span></div></div></section>
    ${missionCard}
    <div class="platoon-grid"><section class="card calendar-card"><div class="platoon-section-title"><div><div class="eyebrow">MISSION CALENDAR</div><h3>${monthName}</h3></div><span class="muted">Select a date to add a Mission</span></div><div class="calendar-grid">${['S','M','T','W','T','F','S'].map(x=>`<div class="calendar-dow">${x}</div>`).join('')}${cells.join('')}</div></section><section class="card"><div class="platoon-section-title"><div><div class="eyebrow">CADETS</div><h3>Roster</h3></div><span class="muted">Chief · Co-Chief · Cadets</span></div><div class="roster-list">${roster}</div></section></div>
    <div class="platoon-grid"><section class="card"><div class="platoon-section-title"><div><div class="eyebrow">MY TIME CUP</div><h3>Mission levels</h3></div></div><div class="cup-snapshot"><div class="cup-cell"><strong>Skirmish</strong><span>Low points</span><span class="mission-tag skirmish">LOW</span></div><div class="cup-cell"><strong>Battle</strong><span>Medium points</span><span class="mission-tag battle">MED</span></div><div class="cup-cell"><strong>War</strong><span>High points</span><span class="mission-tag war">HIGH</span></div></div></section><section class="card"><div class="eagle-lockup"><div class="eagle-mark">🦅</div><div><div class="eyebrow">CLUB EAGLE</div><h3>Platoon honors</h3><div class="muted">Eagles will link back to their Mission summary.</div></div></div><div class="empty" style="padding:18px 0 4px">No eagle records loaded yet.</div></section></div>
    <section class="card"><div class="platoon-section-title"><div><div class="eyebrow">PLATOON FEED</div><h3>Clubhouse</h3></div><span class="muted">Posts · photos · video · comments</span></div><div class="empty" style="padding:20px 0">No posts yet.</div></section>
  </div>`;
}'''

start=s.index('function groupsView(){')
end=s.index('function scoreDifferential(r){',start)
s=s[:start]+block+'\n\n'+s[end:]

old="if(globalCourseBar)globalCourseBar.style.display=state.view==='pregame'?'none':'grid';"
assert old in s
s=s.replace(old,"if(globalCourseBar)globalCourseBar.style.display=['pregame','groups'].includes(state.view)?'none':'grid';",1)

p.write_text(s)
