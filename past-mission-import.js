(()=>{
'use strict';
if(!document.getElementById('grPastMissionMobileFix')){
  const style=document.createElement('style');
  style.id='grPastMissionMobileFix';
  style.textContent=`
#grPastMissionDialog{width:min(720px,calc(100vw - 20px))!important;max-height:calc(100dvh - 20px)!important;overflow:hidden!important;padding:0!important}
#grPastMissionDialog .dialog-card{max-height:calc(100dvh - 20px)!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important;touch-action:pan-y!important;padding-bottom:calc(28px + env(safe-area-inset-bottom))!important}
#grPastMissionDialog input,#grPastMissionDialog select,#grPastMissionDialog textarea{width:100%!important;min-width:0!important;max-width:100%!important}
.gr-league-toggle{display:flex;flex-wrap:wrap;gap:8px}
.gr-league-toggle .button{flex:1 1 140px}
.gr-tag.gr-league-on{border:1px solid rgba(212,175,106,.4);color:var(--accent,#d4af6a);background:rgba(212,175,106,.1)}
.gr-tag.gr-league-off{border:1px solid rgba(255,255,255,.12);color:#a8b8b0;background:rgba(255,255,255,.04)}
@media(max-width:700px){
  #grPastMissionDialog{width:calc(100vw - 16px)!important;max-height:calc(100dvh - 16px)!important}
  #grPastMissionDialog .dialog-card{max-height:calc(100dvh - 16px)!important;padding:18px 14px calc(34px + env(safe-area-inset-bottom))!important}
  #grPastMissionDialog .grid.two{grid-template-columns:1fr!important}
  #grPastMissionDialog .dialog-actions{position:sticky!important;bottom:0!important;background:#16221d!important;padding:12px 0 4px!important;z-index:5!important}
}
`;
  document.head.appendChild(style);
}
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const uid=()=>`mission-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
function aliasesOf(m){return typeof window.grAliasesOf==='function'?window.grAliasesOf(m):[]}
function canonicalMember(p,raw){return typeof window.grCanonicalMember==='function'?window.grCanonicalMember(p,raw):null}
let pastImportSession=0,pastImportRead=0,pastImportBusy=false,pastImportAbort=null;
function destroyDialog(){
  const d=document.getElementById('grPastMissionDialog');
  if(!d)return;
  try{d.close()}catch{}
  try{d.remove()}catch{}
}
function dialog(inner){
  // Always rebuild from scratch so the next import can't inherit the previous confirm form
  // (Safari/Chrome will otherwise restore values into stable #grPast* ids).
  destroyDialog();
  const d=document.createElement('dialog');
  d.id='grPastMissionDialog';
  d.setAttribute('data-gr-import-session',String(pastImportSession));
  document.body.appendChild(d);
  d.innerHTML=`<div class="dialog-card">${inner}</div>`;
  d.showModal();
  return d;
}
function close(){
  try{pastImportAbort?.abort()}catch{}
  pastImportAbort=null;
  pastImportBusy=false;
  pastImportSession++; // invalidate any in-flight confirm paint / create handlers
  destroyDialog();
}
function fmtBytes(n){if(!Number.isFinite(n))return'';if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(1)} KB`;return`${(n/1048576).toFixed(1)} MB`}
function cleanCourseName(v){return typeof window.grCleanCourseName==='function'?window.grCleanCourseName(v):String(v||'').trim()}
function courseScore(a,b){
  if(typeof window.courseNameScore==='function')return window.courseNameScore(a,b);
  const na=norm(a),nb=norm(b);if(!na||!nb)return 0;
  if(na===nb)return 100;if(na.includes(nb)||nb.includes(na))return 88;
  const A=new Set(na.split(' ').filter(Boolean)),B=new Set(nb.split(' ').filter(Boolean));
  let hit=0;for(const x of A)if(B.has(x))hit++;
  return A.size||B.size?Math.round(100*hit/Math.max(A.size,B.size)):0;
}
function rankedCoursesForRaw(raw){
  const cleaned=cleanCourseName(raw);
  let list=[];
  try{list=(typeof db!=='undefined'&&Array.isArray(db.courses))?db.courses.slice():[]}catch{list=[]}
  const scored=list.map(c=>{
    const label=typeof window.courseMenuLabel==='function'?window.courseMenuLabel(c):(c.baseName||c.name||'');
    const score=Math.max(courseScore(cleaned,c.name),courseScore(cleaned,c.baseName),courseScore(cleaned,label),courseScore(raw,c.name));
    return {c,label,score};
  }).filter(x=>x.score>=55).sort((a,b)=>b.score-a.score||String(a.label).localeCompare(String(b.label)));
  const seen=new Set(scored.map(x=>x.c.id));
  const rest=list.filter(c=>!seen.has(c.id)).map(c=>({
    c,label:typeof window.courseMenuLabel==='function'?window.courseMenuLabel(c):(c.baseName||c.name||''),score:0
  })).sort((a,b)=>String(a.label).localeCompare(String(b.label)));
  return {cleaned,best:scored[0]||null,options:[...scored,...rest]};
}
function courseConfirmMarkup(raw){
  const {cleaned,best,options}=rankedCoursesForRaw(raw);
  const opts=options.map(x=>`<option value="id:${esc(x.c.id)}" ${best&&best.c.id===x.c.id?'selected':''}>${esc(x.label)}${x.score>=88?' ✓':''}</option>`).join('');
  const otherSelected=!best;
  return `<label>Course <span class="muted" style="font-weight:600">(confirm)</span>
    <select id="grPastCoursePick" class="gr-mission-select" autocomplete="off">
      <option value="">Select course…</option>
      ${opts||'<option value="" disabled>No Golf Recon courses yet</option>'}
      <option value="__other__" ${otherSelected?'selected':''}>Other / type below…</option>
    </select>
    <input id="grPastCourse" value="${esc(cleaned)}" placeholder="Course name" style="${otherSelected?'':'display:none'};margin-top:7px" autocomplete="off" autocorrect="off" spellcheck="false">
    ${best?`<div class="muted" style="font-size:var(--fs-data);margin-top:4px">Matched “${esc(cleaned)}” → <strong>${esc(best.label)}</strong>. Change if wrong.</div>`
      :`<div class="muted" style="font-size:var(--fs-data);margin-top:4px">Cleaned to “${esc(cleaned)}”. Pick a Golf Recon course or keep the typed name.</div>`}
  </label>`;
}
function guestPool(p){return typeof window.grGuestPoolOf==='function'?window.grGuestPoolOf(p):[]}
function findGuest(p,raw){
  const key=norm(raw);
  if(!key)return null;
  return guestPool(p).find(g=>norm(g.name)===key||(g.aliases||[]).some(a=>norm(a)===key))||null;
}
function matchSelectHtml(p,roster,r){
  const m=canonicalMember(p,r.player_name);
  const gHit=findGuest(p,r.player_name);
  const memberOpts=roster.map(x=>`<option value="member:${esc(x.id)}" ${m?.id===x.id?'selected':''}>${esc(x.name)}</option>`).join('');
  const pool=guestPool(p);
  const guestOpts=pool.map(g=>`<option value="guest:${esc(g.id)}" ${(!m&&gHit&&gHit.id===g.id)?'selected':''}>${esc(g.name)} (Guest)</option>`).join('');
  return `<select data-match>
    <option value="">Choose player…</option>
    <optgroup label="Members">${memberOpts||'<option value="" disabled>No members</option>'}</optgroup>
    <optgroup label="Guest pool">${guestOpts||'<option value="" disabled>No guests yet</option>'}</optgroup>
    <option value="__add_guest__">➕ Add as guest…</option>
  </select>`;
}
function refreshGuestOptions(root,p){
  const pool=guestPool(p);
  root.querySelectorAll('[data-match]').forEach(s=>{
    let og=s.querySelector('optgroup[label="Guest pool"]');
    if(!og){
      og=document.createElement('optgroup');
      og.label='Guest pool';
      const addOpt=[...s.options].find(o=>o.value==='__add_guest__');
      s.insertBefore(og,addOpt||null);
    }
    [...og.querySelectorAll('option')].forEach(o=>o.remove());
    if(!pool.length){
      const empty=document.createElement('option');
      empty.value='';empty.disabled=true;empty.textContent='No guests yet';
      og.appendChild(empty);
      return;
    }
    for(const g of pool){
      const o=document.createElement('option');
      o.value=`guest:${g.id}`;
      o.textContent=`${g.name} (Guest)`;
      og.appendChild(o);
    }
  });
}
function withTimeout(promise,ms,message){
  let timer=null;
  return Promise.race([
    Promise.resolve(promise).finally(()=>{if(timer)clearTimeout(timer)}),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message||'The screenshot reader timed out. Please try again; the files were not saved or changed.')),ms)})
  ]);
}
function dataUrlToPayload(dataUrl){
  const m=String(dataUrl||'').match(/^data:([^;]+);base64,(.+)$/);
  if(!m||!m[2])throw new Error('Image conversion failed.');
  return {type:m[1]||'image/jpeg',data:m[2]};
}
async function compactImageFile(file,maxDim=1600,quality=.82){
  // Prefer shared HEIC-aware compressor so iPhone screenshots don't hang OCR.
  if(typeof window.grCompressImageFile==='function'){
    const dataUrl=await withTimeout(
      window.grCompressImageFile(file,{max:maxDim,quality}),
      45000,
      `Could not prepare ${file?.name||'screenshot'} (timed out). Export as JPG and try again.`
    );
    return dataUrlToPayload(dataUrl);
  }
  try{
    const bmp=await withTimeout(createImageBitmap(file),20000,`Could not prepare ${file?.name||'screenshot'} (timed out).`);
    const scale=Math.min(1,maxDim/Math.max(bmp.width,bmp.height));
    const w=Math.max(1,Math.round(bmp.width*scale)),h=Math.max(1,Math.round(bmp.height*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(bmp,0,0,w,h);bmp.close?.();
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Image conversion failed.')),'image/jpeg',quality));
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');r.onerror=()=>reject(r.error||new Error('Image read failed.'));r.readAsDataURL(blob)});
    return {type:'image/jpeg',data};
  }catch(e){
    if(typeof window.platoonFilePayload==='function')return window.platoonFilePayload(file);
    throw e;
  }
}
function cleanHolesLocal(holes){
  if(typeof window.grCleanHoles==='function')return window.grCleanHoles(holes);
  const map=new Map();
  for(const h of (Array.isArray(holes)?holes:[])){
    const hole=Number(h?.hole);if(!Number.isInteger(hole)||hole<1||hole>18)continue;
    map.set(hole,{hole,par:finite(h?.par)?Number(h.par):null,score:finite(h?.score)?Number(h.score):null});
  }
  return [...map.values()].sort((a,b)=>a.hole-b.hole);
}
function resultRow(playerName,r){
  const holes=cleanHolesLocal(r?.holes);
  const payload={
    player_name:playerName,
    handicap:r?.handicap,
    gross:r?.gross,net:r?.net,finish_position:r?.finish_position,raw_points:r?.raw_points,eagle_count:r?.eagle_count,
    holes
  };
  if(typeof window.grNormalizeOfficialResultRow==='function')return window.grNormalizeOfficialResultRow(payload);
  return {
    player_name:playerName,
    handicap:finite(r?.handicap)?Number(r.handicap):null,
    gross:finite(r?.gross)?Number(r.gross):null,
    net:finite(r?.net)?Number(r.net):null,
    finish_position:finite(r?.finish_position)?Number(r.finish_position):null,
    raw_points:finite(r?.raw_points)?Number(r.raw_points):null,
    eagle_count:finite(r?.eagle_count)?Number(r.eagle_count):null,
    ...(holes.length?{holes}:{})
  };
}
function resetFileInput(input){
  if(!input)return;
  try{input.value=''}catch{}
}
async function openImport(){
  const p=window.loadPlatoonLocal?.();if(!p)return alert('Platoon data is unavailable.');
  if(typeof window.callPlatoonFunction!=='function')return alert('Screenshot import is unavailable.');
  // New dialog session cancels any in-flight read so reused DOM can't look hung / show stale confirm.
  try{pastImportAbort?.abort()}catch{}
  pastImportAbort=null;
  pastImportBusy=false;
  const session=++pastImportSession;
  const d=dialog(`<form id="grPastImportForm" autocomplete="off" onsubmit="return false"><div class="dialog-head"><div><div class="eyebrow">HISTORICAL IMPORT</div><h2>Import Past Mission</h2></div><button class="icon-button" data-close type="button">✕</button></div><p class="muted" style="font-size:var(--fs-data)">Upload the event overview, net/points leaderboard, and expanded gross scorecards (front 9 + back 9). Hole-by-hole scores attach to each player’s Mission result and seed their personal round without wiping later detail.</p><label class="upload-zone" style="cursor:pointer"><strong>📥 Add screenshots</strong><span>Overview + net LB + expanded gross cards (front/back 9)</span><input id="grPastFiles" type="file" accept="image/*" multiple></label><div id="grPastFilesList" class="file-list"></div><label>Round story / anything worth highlighting<textarea id="grPastStory" name="gr-past-story-${session}" rows="3" placeholder="Optional — weather, trash talk, crazy shots, side bets, meltdowns…" autocomplete="off"></textarea></label><div id="grPastProgress"></div><div id="grPastOut"></div><div class="dialog-actions" id="grPastReadActions"><button class="button secondary" data-cancel type="button">Cancel</button><button class="button primary" id="grPastRead" type="button">Read Screenshots</button></div></form>`);
  d.querySelector('[data-close]').onclick=close;d.querySelector('[data-cancel]').onclick=close;
  const files=d.querySelector('#grPastFiles'),fileList=d.querySelector('#grPastFilesList'),progress=d.querySelector('#grPastProgress'),out=d.querySelector('#grPastOut'),btn=d.querySelector('#grPastRead'),story=d.querySelector('#grPastStory'),readActions=d.querySelector('#grPastReadActions');
  const clearConfirm=()=>{progress.innerHTML='';out.innerHTML=''};
  files.onchange=()=>{const fs=[...files.files];fileList.innerHTML=fs.length?`<div class="platoon-notice" style="margin:8px 0"><strong>${fs.length} screenshot${fs.length===1?'':'s'} ready</strong>${fs.map((f,i)=>`<div style="margin-top:4px">${i+1}. ${esc(f.name)} <span class="muted">· ${fmtBytes(f.size)}</span></div>`).join('')}</div>`:'';clearConfirm();if(readActions)readActions.style.display='';if(btn){btn.style.display='';btn.disabled=false;btn.textContent='Read Screenshots'}};
  btn.onclick=async()=>{
    const fs=[...files.files];if(!fs.length){out.innerHTML='<div class="platoon-notice">Add at least one screenshot.</div>';return}
    if(pastImportBusy||session!==pastImportSession)return;
    pastImportBusy=true;
    try{pastImportAbort?.abort()}catch{}
    const ctrl=typeof AbortController!=='undefined'?new AbortController():null;
    pastImportAbort=ctrl;
    const readId=++pastImportRead;
    // "current" = this dialog/read still owns the UI. Do NOT fold signal.aborted into this —
    // timeout aborts the signal, and we still need to show an error + re-enable Try Again.
    const current=()=>session===pastImportSession&&readId===pastImportRead;
    let timedOut=false;
    let heartbeat=null;
    const startedAt=Date.now();
    const setProgress=(title,detail='')=>{
      if(!current())return;
      const secs=Math.max(0,Math.round((Date.now()-startedAt)/1000));
      progress.innerHTML=`<div class="platoon-notice" style="margin-top:10px"><strong>${title}</strong><br><span class="muted">${detail||`Elapsed ${secs}s`}</span><div style="margin-top:8px"><button type="button" class="button secondary" id="grPastStopRead">Stop</button></div></div>`;
      progress.querySelector('#grPastStopRead')?.addEventListener('click',()=>{
        try{ctrl?.abort()}catch{}
        if(current()){
          progress.innerHTML='';
          out.innerHTML=`<div class="platoon-notice" style="margin-top:10px"><strong>Stopped.</strong><br>Screenshots were not saved. Tap Try Again when ready.</div>`;
          btn.disabled=false;btn.textContent='Try Again';
        }
      },{once:true});
    };
    const restoreReadBtn=()=>{
      if(!current()||!btn?.isConnected)return;
      if(btn.style.display==='none')return;
      btn.disabled=false;
      if(btn.textContent==='Reading…'||btn.textContent==='Preparing…')btn.textContent='Try Again';
    };
    btn.disabled=true;btn.textContent='Reading…';clearConfirm();
    // Capture file fingerprints now so a later confirm can't accidentally come from a different pick.
    const fileStamp=fs.map(f=>`${f.name}:${f.size}:${f.lastModified||0}`).join('|');
    try{
      const images=[];
      for(let i=0;i<fs.length;i++){
        if(!current())return;
        if(ctrl?.signal?.aborted)throw Object.assign(new Error('Canceled.'),{name:'AbortError'});
        setProgress(`Preparing screenshot ${i+1} of ${fs.length}…`,'Compressing for the reader…');
        // Leaner OCR payload — big PNGs after a few imports were stalling mobile uploads.
        images.push(await compactImageFile(fs[i],1280,.72));
      }
      if(!current())return;
      if(ctrl?.signal?.aborted)throw Object.assign(new Error('Canceled.'),{name:'AbortError'});
      // Guard: file input changed mid-prepare.
      const stampNow=[...files.files].map(f=>`${f.name}:${f.size}:${f.lastModified||0}`).join('|');
      if(stampNow!==fileStamp)throw new Error('Screenshots changed while reading. Tap Read Screenshots again.');
      setProgress(`Reading ${fs.length} screenshot${fs.length===1?'':'s'}…`,'Usually 20–60 seconds. You can Stop and retry.');
      heartbeat=setInterval(()=>{
        if(!current()||ctrl?.signal?.aborted)return;
        const secs=Math.max(0,Math.round((Date.now()-startedAt)/1000));
        setProgress(`Reading ${fs.length} screenshot${fs.length===1?'':'s'}…`,`Still working · ${secs}s elapsed`);
      },1000);
      const timeoutMs=75000;
      let timer=null;
      if(ctrl)timer=setTimeout(()=>{timedOut=true;try{ctrl.abort()}catch{}},timeoutMs);
      let parsed;
      try{
        parsed=await window.callPlatoonFunction(
          {action:'parse_completed_mission',images,import_session:session,read_id:readId},
          {signal:ctrl?.signal,timeoutMessage:'The screenshot reader timed out. Please try again with fewer or clearer screenshots.'}
        );
      }finally{if(timer)clearTimeout(timer);if(heartbeat){clearInterval(heartbeat);heartbeat=null}}
      if(!current())return;
      if(ctrl?.signal?.aborted)throw Object.assign(new Error(timedOut?'The screenshot reader timed out. Please try again with fewer or clearer screenshots.':'Canceled.'),{name:'AbortError'});
      // Deep-clone so later mutations / reused objects can't leak into the next confirm.
      parsed=JSON.parse(JSON.stringify(parsed||{}));
      progress.innerHTML='';
      const ev=parsed?.event||{},results=Array.isArray(parsed?.results)?parsed.results:[];
      if(!results.length)throw new Error('No player results were found.');
      const roster=(p.members||[]).filter(m=>m.status!=='inactive');
      const teeMarkup=typeof window.grTeeTimeWheelMarkup==='function'
        ? window.grTeeTimeWheelMarkup('grPastTime',(ev.tee_time||'').slice(0,5))
        : `<input id="grPastTime" class="gr-datetime gr-time-picker" type="time" step="600" value="${esc((ev.tee_time||'').slice(0,5))}" inputmode="none" autocomplete="off">`;
      const formatIds={pickId:'grPastFormatPick',otherId:'grPastFormatOther'};
      const formatMarkup=typeof window.grFormatSelectMarkup==='function'
        ? window.grFormatSelectMarkup(ev.format||'Stroke Play',formatIds)
        : `<input id="grPastFormat" value="${esc(ev.format||'Stroke Play')}" autocomplete="off">`;
      let missionPhotos=[];
      const photoMax=Number(window.grMissionPhotosMax)||3;
      const titleVal=String(ev.title||'Past Mission');
      const dateVal=String(ev.date||'');
      out.innerHTML=`<div class="platoon-notice" style="margin-top:12px"><strong>Confirm before creating.</strong><br>Edit anything the screenshots did not capture correctly. Use <strong>Add as guest</strong> for non-members — they go in the guest pool.</div><div class="grid two"><label>Mission name<input id="grPastTitle" name="gr-past-title-${session}-${readId}" value="${esc(titleVal)}" autocomplete="off" autocorrect="off" spellcheck="false"></label><label>Date<input id="grPastDate" name="gr-past-date-${session}-${readId}" class="gr-datetime gr-date-picker" type="date" value="${esc(dateVal)}" inputmode="none" autocomplete="off"><div class="gr-date-quick"><button type="button" class="gr-time-chip" data-past-date="grPastDate" data-date-preset="today">Today</button><button type="button" class="gr-time-chip" data-past-date="grPastDate" data-date-preset="sat">Next Sat</button><button type="button" class="gr-time-chip" data-past-date="grPastDate" data-date-preset="sun">Next Sun</button></div></label><label>Tee time <span class="muted" style="font-weight:600">(10 min)</span>${teeMarkup}</label><label>Format${formatMarkup}</label></div>${courseConfirmMarkup(ev.course_name||'')}<div class="gr-league-points-toggle" style="margin-top:12px"><div class="eyebrow">MY TIME ⛳ POINTS</div><p class="muted" style="font-size:var(--fs-data);margin:4px 0 8px">Include this round’s 18Birdies points in the season cup average?</p><div class="gr-league-toggle" role="group" aria-label="League points"><button type="button" class="button primary" id="grPastLeagueYes" data-league="1" aria-pressed="true">Include in total</button><button type="button" class="button secondary" id="grPastLeagueNo" data-league="0" aria-pressed="false">Don’t count</button></div></div><div class="gr-mission-photos-setup" style="margin-top:12px"><div class="eyebrow">MISSION PHOTOS</div><p class="muted" style="font-size:var(--fs-data);margin:4px 0 6px">Optional — up to ${photoMax} for the Mission summary.</p><div id="grPastPhotoThumbs"></div><label class="gr-logo-upload" style="margin:6px 0 0;cursor:pointer;display:inline-block"><strong>📷 Add photos</strong><input id="grPastPhotos" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif" multiple></label><div id="grPastPhotoStatus" class="muted" style="font-size:var(--fs-data);margin-top:4px"></div></div><div style="margin-top:14px"><div class="eyebrow">PLAYERS & RESULTS</div>${results.map((r,i)=>{const hc=finite(r.handicap)?`HCP ${Number(r.handicap)}`:'';const holeN=Array.isArray(r.holes)?r.holes.filter(h=>finite(h?.score)).length:0;const holeBit=holeN?`${holeN} holes`:'no holes yet';return `<div class="gr-past-result" data-i="${i}" style="border:1px solid var(--line);border-radius:12px;padding:9px;margin-top:7px"><div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px"><strong>${esc(r.player_name||'Player')}${hc?` <span class="muted" style="font-weight:600">· ${hc}</span>`:''}</strong><span>${finite(r.net)?`Net ${Number(r.net)}`:'Net —'} · ${finite(r.gross)?`Gross ${Number(r.gross)}`:'Gross —'}${finite(r.raw_points)?` · ${Number(r.raw_points)} pts`:''} · ${holeBit}</span></div><label style="margin-top:7px">Match to Platoon player${matchSelectHtml(p,roster,r)}</label></div>`}).join('')}</div>${Array.isArray(parsed?.warnings)&&parsed.warnings.length?`<div class="platoon-notice" style="margin-top:10px">${parsed.warnings.map(x=>esc(x)).join('<br>')}</div>`:''}<div class="dialog-actions"><button class="button secondary" id="grPastBack" type="button">Back</button><button class="button primary" id="grPastCreate" type="button">Create Completed Mission</button></div>`;
      if(!current()){out.innerHTML='';return}
      btn.style.display='none';
      if(readActions)readActions.style.display='none';
      // Force values after paint — defeats browser autofill restoring the previous import.
      const titleEl=out.querySelector('#grPastTitle');if(titleEl)titleEl.value=titleVal;
      const dateEl=out.querySelector('#grPastDate');if(dateEl)dateEl.value=dateVal;
      if(typeof window.grWireTeeTimeWheel==='function')window.grWireTeeTimeWheel(out,'grPastTime');
      if(typeof window.grWireFormatSelect==='function')window.grWireFormatSelect(out,formatIds);
      let leaguePoints=true;
      const syncLeagueToggle=()=>{
        const yes=out.querySelector('#grPastLeagueYes');
        const no=out.querySelector('#grPastLeagueNo');
        if(yes){yes.className=leaguePoints?'button primary':'button secondary';yes.setAttribute('aria-pressed',leaguePoints?'true':'false')}
        if(no){no.className=!leaguePoints?'button primary':'button secondary';no.setAttribute('aria-pressed',!leaguePoints?'true':'false')}
      };
      out.querySelector('#grPastLeagueYes')?.addEventListener('click',()=>{leaguePoints=true;syncLeagueToggle()});
      out.querySelector('#grPastLeagueNo')?.addEventListener('click',()=>{leaguePoints=false;syncLeagueToggle()});
      syncLeagueToggle();
      const coursePick=out.querySelector('#grPastCoursePick');
      const courseInput=out.querySelector('#grPastCourse');
      const syncCourseOther=()=>{
        if(!coursePick||!courseInput)return;
        const other=coursePick.value==='__other__'||!coursePick.value;
        courseInput.style.display=other?'':'none';
        if(!other&&coursePick.value.startsWith('id:')){
          const id=coursePick.value.slice(3);
          try{
            const c=(typeof db!=='undefined'?db.courses:[]).find(x=>String(x.id)===String(id));
            if(c)courseInput.value=typeof window.courseMenuLabel==='function'?window.courseMenuLabel(c):(c.baseName||c.name||courseInput.value);
          }catch{}
        }
      };
      coursePick?.addEventListener('change',syncCourseOther);
      syncCourseOther();
      const photoThumbs=out.querySelector('#grPastPhotoThumbs');
      const photoStatus=out.querySelector('#grPastPhotoStatus');
      const refreshPastPhotos=()=>{
        if(photoThumbs)photoThumbs.innerHTML=typeof window.grRenderMissionPhotoThumbs==='function'
          ? window.grRenderMissionPhotoThumbs(missionPhotos,{editable:true})
          : '';
      };
      refreshPastPhotos();
      let photoBusy=false;
      out.querySelector('#grPastPhotos')?.addEventListener('change',async e=>{
        const picked=[...(e.target.files||[])];
        e.target.value='';
        if(!picked.length||photoBusy||!current()||ctrl?.signal?.aborted)return;
        const compress=typeof window.grCompressImageFile==='function'?window.grCompressImageFile:null;
        if(!compress){if(photoStatus)photoStatus.textContent='Photo upload unavailable.';return}
        photoBusy=true;
        let added=0,failed=0,hitMax=false;
        if(photoStatus)photoStatus.textContent='Adding photos…';
        try{
          for(const f of picked){
            if(!current()||ctrl?.signal?.aborted)return;
            if(missionPhotos.length>=photoMax){hitMax=true;break}
            try{
              const dataUrl=await withTimeout(compress(f,{max:960,quality:.62}),45000,`Could not read ${f?.name||'photo'} (timed out). Try JPG.`);
              missionPhotos.push({id:`mph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,dataUrl,createdAt:new Date().toISOString()});
              added++;
              refreshPastPhotos();
            }catch(err){failed++;console.warn('Past import photo skipped',f?.name,err)}
          }
        }finally{photoBusy=false}
        if(!current())return;
        if(photoStatus){
          if(hitMax&&!added)photoStatus.textContent=`Max ${photoMax} mission photos.`;
          else if(added&&failed)photoStatus.textContent=`Added ${added}. Skipped ${failed}.`;
          else if(failed&&!added)photoStatus.textContent=`Couldn't read ${failed} photo${failed===1?'':'s'}. Try JPG.`;
          else if(added)photoStatus.textContent=`Added ${added} photo${added===1?'':'s'}.`;
          else photoStatus.textContent='';
        }
      });
      photoThumbs?.addEventListener('click',e=>{
        const del=e.target.closest('[data-del-mission-photo]');
        if(!del)return;
        missionPhotos=missionPhotos.filter(x=>String(x.id)!==String(del.getAttribute('data-del-mission-photo')));
        refreshPastPhotos();
      });
      out.querySelectorAll('[data-match]').forEach(sel=>{
        sel.addEventListener('change',()=>{
          if(sel.value!=='__add_guest__')return;
          const row=sel.closest('.gr-past-result');
          const i=Number(row?.dataset.i);
          const suggested=String(results[i]?.player_name||'').trim();
          const name=prompt('Add guest name',suggested||'');
          if(!name||!String(name).trim()){sel.value='';return}
          const aliases=suggested&&norm(suggested)!==norm(name)?[suggested]:[];
          const g=typeof window.grUpsertGuestPool==='function'
            ? window.grUpsertGuestPool(p,String(name).trim(),{aliases})
            : {id:'gst-'+Date.now(),name:String(name).trim()};
          refreshGuestOptions(out,p);
          sel.value=`guest:${g.id}`;
        });
      });
      out.querySelectorAll('[data-past-date]').forEach(b=>b.addEventListener('click',()=>{
        const now=new Date();let target=new Date(now.getFullYear(),now.getMonth(),now.getDate());
        if(b.dataset.datePreset==='sat'){const day=target.getDay();const add=((6-day)+7)%7||7;target.setDate(target.getDate()+add)}
        if(b.dataset.datePreset==='sun'){const day=target.getDay();const add=((0-day)+7)%7||7;target.setDate(target.getDate()+add)}
        const el=out.querySelector('#'+b.dataset.pastDate);if(el)el.value=`${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}-${String(target.getDate()).padStart(2,'0')}`;
      }));
      out.querySelector('#grPastBack').onclick=()=>{
        if(session!==pastImportSession)return;
        // Drop this confirm + the prior file pick so the next Read can't silently reuse old screenshots.
        clearConfirm();
        resetFileInput(files);
        if(fileList)fileList.innerHTML='';
        if(story)story.value='';
        if(readActions)readActions.style.display='';
        btn.style.display='';btn.disabled=false;btn.textContent='Read Screenshots';
      };
      out.querySelector('#grPastCreate').onclick=async()=>{
        if(!current()){
          alert('This confirm screen is out of date. Close and import again.');
          return;
        }
        const title=out.querySelector('#grPastTitle').value.trim()||'Past Mission';
        const date=out.querySelector('#grPastDate').value;
        const teeTime=out.querySelector('#grPastTime').value;
        let courseId='';
        let locationName='Course TBD';
        const pick=out.querySelector('#grPastCoursePick')?.value||'';
        const typed=out.querySelector('#grPastCourse')?.value.trim()||'';
        if(pick.startsWith('id:')){
          courseId=pick.slice(3);
          try{
            const c=(typeof db!=='undefined'?db.courses:[]).find(x=>String(x.id)===String(courseId));
            locationName=c?(typeof window.courseMenuLabel==='function'?window.courseMenuLabel(c):(c.baseName||c.name||typed)):typed;
          }catch{locationName=typed||'Course TBD'}
        }else{
          locationName=typed||cleanCourseName(ev.course_name||'')||'Course TBD';
        }
        if(!locationName)locationName='Course TBD';

        const format=typeof window.grReadMissionFormat==='function'
          ? (window.grReadMissionFormat(out,formatIds)||'Stroke play (net)')
          : (out.querySelector('#grPastFormat')?.value.trim()||'Stroke Play');
        if(!date)return alert('Confirm the round date before creating the Mission.');
        const participants=[],guests=[],saved=[];
        const pool=guestPool(p);
        for(const row of out.querySelectorAll('.gr-past-result')){
          const i=Number(row.dataset.i),r=results[i],raw=row.querySelector('[data-match]')?.value||'';
          if(!raw||raw==='__add_guest__')continue;
          if(raw.startsWith('member:')){
            const memberId=raw.slice(7);
            const member=roster.find(x=>x.id===memberId);if(!member)continue;
            participants.push(member.id);
            saved.push(resultRow(member.name,r));
          }else if(raw.startsWith('guest:')){
            const gid=raw.slice(6);
            const g=pool.find(x=>String(x.id)===String(gid));
            const gName=g?.name||String(results[i]?.player_name||'Guest').trim();
            if(!gName)continue;
            if(typeof window.grUpsertGuestPool==='function')window.grUpsertGuestPool(p,gName);
            guests.push(gName);
            saved.push(resultRow(gName,r));
          }
        }
        if(!saved.length)return alert('Match at least one player before creating the Mission.');
        if(saved.length<results.length){
          const missing=[...out.querySelectorAll('.gr-past-result')]
            .filter(row=>{const v=row.querySelector('[data-match]')?.value||'';return !v||v==='__add_guest__'})
            .map(row=>results[Number(row.dataset.i)]?.player_name).filter(Boolean);
          return alert(`Match every player before creating the Mission.${missing.length?` Still unmatched: ${missing.join(', ')}`:''}`);
        }
        const story=d.querySelector('#grPastStory')?.value.trim()||'';
        const guestList=[...new Set(guests.map(g=>String(g||'').trim()).filter(Boolean))];
        const photos=(typeof window.grCleanMissionPhotos==='function'?window.grCleanMissionPhotos(missionPhotos):missionPhotos.slice(0,photoMax));
        const built=typeof window.grBuildCompletedMissionFromImport==='function'
          ? window.grBuildCompletedMissionFromImport({id:uid(),date,teeTime,courseId,locationName,title,format,notes:story,recap_note:story,participants,guests:guestList,results:saved,photos,league_points:leaguePoints})
          : {ok:true,mission:{id:uid(),date,teeTime,type:'battle',courseId,locationName,title,format,notes:story,status:'completed',participants:[...new Set(participants)],guests:guestList,results:saved,photos,league_points:leaguePoints,recap_note:story||undefined}};
        if(!built.ok){alert(built.error||'Could not create Mission.');return}
        const mission=built.mission;
        mission.league_points=leaguePoints;
        if(guestList.length){
          mission.guests=guestList;
          if(!/\[\[GR_GUESTS:/.test(String(mission.notes||''))){
            mission.notes=`${mission.notes||''}${mission.notes?'\n':''}[[GR_GUESTS:${JSON.stringify(guestList)}]]`;
          }
        }
        mission.photos=photos;
        if(typeof window.grUpsertMission==='function')window.grUpsertMission(p,mission);
        else{p.missions=p.missions||[];p.missions.push(mission)}
        if(typeof window.grWriteMissionPhotosSide==='function')window.grWriteMissionPhotosSide(p,mission.id,photos);
        // Hole seeds → After Action / birdie-eagle tracking + personal claim (blank fields only).
        if(typeof window.grAttachScorecardSeeds==='function')window.grAttachScorecardSeeds(mission,p);
        let claimed=0;
        if(typeof window.grClaimMissionScorecardsIntoPersonalDb==='function'){
          const claim=window.grClaimMissionScorecardsIntoPersonalDb(p);
          claimed=Number(claim?.claimed||0)||0;
        }
        const createBtn=out.querySelector('#grPastCreate');createBtn.disabled=true;createBtn.textContent='Saving…';
        try{
          await Promise.resolve(window.savePlatoonLocal(p));
          if(session!==pastImportSession)return;
          close();
          setTimeout(()=>{if(typeof window.render==='function')window.render();else location.reload()},50);
          const holePlayers=(mission.results||[]).filter(r=>Array.isArray(r.holes)&&r.holes.length).length;
          alert(`Created completed Mission: ${title}${holePlayers?`\nHole-by-hole saved for ${holePlayers} player${holePlayers===1?'':'s'}.`:''}${claimed?`\nSeeded ${claimed} personal round${claimed===1?'':'s'} (blank fields only).`:''}`);
        }catch(e){
          if(session!==pastImportSession)return;
          p.missions=p.missions.filter(x=>x.id!==mission.id);
          createBtn.disabled=false;createBtn.textContent='Create Completed Mission';
          alert(e?.message||String(e));
        }
      };
    }catch(e){
      if(heartbeat){clearInterval(heartbeat);heartbeat=null}
      // Superseded by a newer dialog/read — drop quietly.
      if(!current())return;
      progress.innerHTML='';
      const canceled=e?.name==='AbortError'&&!timedOut;
      if(canceled){
        out.innerHTML=`<div class="platoon-notice" style="margin-top:10px"><strong>Stopped.</strong><br>Screenshots were not saved. Tap Try Again when ready.</div>`;
      }else{
        const msg=timedOut
          ? 'The screenshot reader timed out. Please try again with fewer or clearer screenshots.'
          : (e?.message||String(e));
        out.innerHTML=`<div class="platoon-notice" style="margin-top:10px"><strong>Could not read the screenshots.</strong><br>${esc(msg)}</div>`;
      }
      restoreReadBtn();
    }finally{
      if(heartbeat){clearInterval(heartbeat);heartbeat=null}
      if(pastImportAbort===ctrl)pastImportAbort=null;
      pastImportBusy=false;
      // Always recover the Read button after timeout/cancel — do not require !aborted.
      restoreReadBtn();
    }
  };
}
window.grImportPastMission=openImport;
function inject(){const a=document.querySelector('.gr-hq-actions');if(!a||a.querySelector('[data-gr-past-import]'))return;const b=document.createElement('button');b.type='button';b.className='button secondary';b.dataset.grPastImport='1';b.textContent='📥 Import Past Mission';b.onclick=openImport;a.appendChild(b)}
new MutationObserver(inject).observe(document.body,{childList:true,subtree:true});setTimeout(inject,0);setTimeout(inject,500);setTimeout(inject,1200);
})();
