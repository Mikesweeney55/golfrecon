(()=>{
'use strict';
if(!document.getElementById('grPastMissionMobileFix')){
  const style=document.createElement('style');
  style.id='grPastMissionMobileFix';
  style.textContent=`
#grPastMissionDialog{width:min(720px,calc(100vw - 20px))!important;max-height:calc(100dvh - 20px)!important;overflow:hidden!important;padding:0!important}
#grPastMissionDialog .dialog-card{max-height:calc(100dvh - 20px)!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important;touch-action:pan-y!important;padding-bottom:calc(28px + env(safe-area-inset-bottom))!important}
#grPastMissionDialog input,#grPastMissionDialog select,#grPastMissionDialog textarea{width:100%!important;min-width:0!important;max-width:100%!important}
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
const DEFAULT_ALIASES={mike:['Mike','Mike S.','Sweeney'],ryan:['Ryan','Ryan S.','Sully'],steve:['Steve','Stephen'],charlie:['Charlie','Chuck'],kevin:['Kevin','Kevin C.','Cunny'],josh:['Josh','Joshua','Mannke']};
function aliasesOf(m){let a=[];if(Array.isArray(m?.aliases))a=m.aliases;else if(typeof m?.aliases==='string')a=m.aliases.split(/[,|]/);else if(typeof m?.nickname==='string')a=m.nickname.split(/[,|]/);a=a.map(x=>String(x||'').trim()).filter(Boolean);if(!a.length){const first=norm(m?.name).split(' ')[0];a=DEFAULT_ALIASES[first]||[]}return [...new Set(a)]}
function canonicalMember(p,raw){const n=norm(raw);if(!n)return null;const exact=(p?.members||[]).filter(m=>[m.name,...aliasesOf(m)].map(norm).includes(n));if(exact.length===1)return exact[0];const first=n.split(' ')[0];const aliasFirst=(p?.members||[]).filter(m=>[m.name,...aliasesOf(m)].map(norm).some(v=>v.split(' ')[0]===first));if(aliasFirst.length===1)return aliasFirst[0];return null}
function dialog(inner){let d=document.getElementById('grPastMissionDialog');if(!d){d=document.createElement('dialog');d.id='grPastMissionDialog';document.body.appendChild(d)}d.innerHTML=`<div class="dialog-card">${inner}</div>`;d.showModal();return d}
function close(){document.getElementById('grPastMissionDialog')?.close()}
function fmtBytes(n){if(!Number.isFinite(n))return'';if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(1)} KB`;return`${(n/1048576).toFixed(1)} MB`}
function cleanCourseName(v){return String(v||'').replace(/\s*\([^)]*(?:\.\.\.|…)[^)]*\)\s*/g,' ').replace(/\s*\?{2,}\s*$/,'').replace(/\s{2,}/g,' ').trim()}
async function compactImageFile(file,maxDim=1600,quality=.82){
  try{
    const bmp=await createImageBitmap(file),scale=Math.min(1,maxDim/Math.max(bmp.width,bmp.height));
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
function withTimeout(promise,ms){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('The screenshot reader timed out. Please try again; the files were not saved or changed.')),ms))])}
async function openImport(){
  const p=window.loadPlatoonLocal?.();if(!p)return alert('Platoon data is unavailable.');
  if(typeof window.callPlatoonFunction!=='function')return alert('Screenshot import is unavailable.');
  const d=dialog(`<div class="dialog-head"><div><div class="eyebrow">HISTORICAL IMPORT</div><h2>Import Past Mission</h2></div><button class="icon-button" data-close type="button">✕</button></div><p class="muted" style="font-size:12px">Upload the event overview plus gross and net/points leaderboard screenshots. Golf Recon will build the completed Mission for you.</p><label class="upload-zone" style="cursor:pointer"><strong>📥 Add screenshots</strong><span>Usually 3 screenshots · overview + gross + net/points</span><input id="grPastFiles" type="file" accept="image/*" multiple></label><div id="grPastFilesList" class="file-list"></div><label>Round story / anything worth highlighting<textarea id="grPastStory" rows="3" placeholder="Optional — weather, trash talk, crazy shots, side bets, meltdowns…"></textarea></label><div id="grPastProgress"></div><div id="grPastOut"></div><div class="dialog-actions"><button class="button secondary" data-cancel type="button">Cancel</button><button class="button primary" id="grPastRead" type="button">Read Screenshots</button></div>`);
  d.querySelector('[data-close]').onclick=close;d.querySelector('[data-cancel]').onclick=close;
  const files=d.querySelector('#grPastFiles'),fileList=d.querySelector('#grPastFilesList'),progress=d.querySelector('#grPastProgress'),out=d.querySelector('#grPastOut'),btn=d.querySelector('#grPastRead');
  files.onchange=()=>{const fs=[...files.files];fileList.innerHTML=fs.length?`<div class="platoon-notice" style="margin:8px 0"><strong>${fs.length} screenshot${fs.length===1?'':'s'} ready</strong>${fs.map((f,i)=>`<div style="margin-top:4px">${i+1}. ${esc(f.name)} <span class="muted">· ${fmtBytes(f.size)}</span></div>`).join('')}</div>`:'';progress.innerHTML='';out.innerHTML=''};
  btn.onclick=async()=>{
    const fs=[...files.files];if(!fs.length){out.innerHTML='<div class="platoon-notice">Add at least one screenshot.</div>';return}
    btn.disabled=true;btn.textContent='Reading…';out.innerHTML='';
    try{
      const images=[];
      for(let i=0;i<fs.length;i++){
        progress.innerHTML=`<div class="platoon-notice" style="margin-top:10px">Preparing screenshot ${i+1} of ${fs.length}…</div>`;
        images.push(await compactImageFile(fs[i]));
      }
      progress.innerHTML=`<div class="platoon-notice" style="margin-top:10px"><strong>Reading ${fs.length} screenshot${fs.length===1?'':'s'}…</strong><br><span class="muted">This can take 20–60 seconds. Keep this window open.</span></div>`;
      const parsed=await withTimeout(window.callPlatoonFunction({action:'parse_completed_mission',images}),90000);
      progress.innerHTML='';
      const ev=parsed?.event||{},results=Array.isArray(parsed?.results)?parsed.results:[];
      if(!results.length)throw new Error('No player results were found.');
      const roster=(p.members||[]).filter(m=>m.status!=='inactive');
      out.innerHTML=`<div class="platoon-notice" style="margin-top:12px"><strong>Confirm before creating.</strong><br>Edit anything the screenshots did not capture correctly.</div><div class="grid two"><label>Mission name<input id="grPastTitle" value="${esc(ev.title||'Past Mission')}"></label><label>Date<input id="grPastDate" type="date" value="${esc(ev.date||'')}"></label><label>Tee time<input id="grPastTime" type="time" value="${esc((ev.tee_time||'').slice(0,5))}"></label><label>Format<input id="grPastFormat" value="${esc(ev.format||'Stroke Play')}"></label></div><label>Course<input id="grPastCourse" value="${esc(cleanCourseName(ev.course_name||''))}"></label><div style="margin-top:14px"><div class="eyebrow">PLAYERS & RESULTS</div>${results.map((r,i)=>{const m=canonicalMember(p,r.player_name);return `<div class="gr-past-result" data-i="${i}" style="border:1px solid var(--line);border-radius:12px;padding:9px;margin-top:7px"><div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px"><strong>${esc(r.player_name||'Player')}</strong><span>${finite(r.net)?`Net ${Number(r.net)}`:'Net —'} · ${finite(r.gross)?`Gross ${Number(r.gross)}`:'Gross —'}${finite(r.raw_points)?` · ${Number(r.raw_points)} pts`:''}</span></div><label style="margin-top:7px">Match to Platoon player<select data-match><option value="">Choose player…</option>${roster.map(x=>`<option value="${esc(x.id)}" ${m?.id===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label></div>`}).join('')}</div>${Array.isArray(parsed?.warnings)&&parsed.warnings.length?`<div class="platoon-notice" style="margin-top:10px">${parsed.warnings.map(x=>esc(x)).join('<br>')}</div>`:''}<div class="dialog-actions"><button class="button secondary" id="grPastBack" type="button">Back</button><button class="button primary" id="grPastCreate" type="button">Create Completed Mission</button></div>`;
      btn.style.display='none';
      out.querySelector('#grPastBack').onclick=()=>{out.innerHTML='';progress.innerHTML='';btn.style.display='';btn.disabled=false;btn.textContent='Read Screenshots'};
      out.querySelector('#grPastCreate').onclick=async()=>{
        const title=out.querySelector('#grPastTitle').value.trim()||'Past Mission',date=out.querySelector('#grPastDate').value,teeTime=out.querySelector('#grPastTime').value,locationName=out.querySelector('#grPastCourse').value.trim()||'Course TBD',format=out.querySelector('#grPastFormat').value.trim()||'Stroke Play';
        if(!date)return alert('Confirm the round date before creating the Mission.');
        const participants=[],saved=[];
        for(const row of out.querySelectorAll('.gr-past-result')){
          const i=Number(row.dataset.i),r=results[i],memberId=row.querySelector('[data-match]')?.value;if(!memberId)continue;
          const member=roster.find(x=>x.id===memberId);if(!member)continue;participants.push(member.id);saved.push({player_name:member.name,gross:finite(r.gross)?Number(r.gross):null,net:finite(r.net)?Number(r.net):null,finish_position:finite(r.finish_position)?Number(r.finish_position):null,raw_points:finite(r.raw_points)?Number(r.raw_points):null,eagle_count:finite(r.eagle_count)?Number(r.eagle_count):null});
        }
        if(!saved.length)return alert('Match at least one player before creating the Mission.');
        if(saved.length<results.length){const missing=[...out.querySelectorAll('.gr-past-result')].filter(row=>!row.querySelector('[data-match]')?.value).map(row=>results[Number(row.dataset.i)]?.player_name).filter(Boolean);return alert(`Match every player before creating the Mission.${missing.length?` Still unmatched: ${missing.join(', ')}`:''}`)}
        const story=d.querySelector('#grPastStory')?.value.trim()||'';
        const mission={id:uid(),date,teeTime,type:'battle',courseId:'',locationName,title,format,notes:story,status:'completed',participants:[...new Set(participants)],results:saved};if(story)mission.recap_note=story;
        p.missions=p.missions||[];p.missions.push(mission);
        const createBtn=out.querySelector('#grPastCreate');createBtn.disabled=true;createBtn.textContent='Saving…';
        try{await Promise.resolve(window.savePlatoonLocal(p));close();setTimeout(()=>{if(typeof window.render==='function')window.render();else location.reload()},50);alert(`Created completed Mission: ${title}`)}catch(e){p.missions=p.missions.filter(x=>x.id!==mission.id);createBtn.disabled=false;createBtn.textContent='Create Completed Mission';alert(e?.message||String(e))}
      };
    }catch(e){progress.innerHTML='';out.innerHTML=`<div class="platoon-notice" style="margin-top:10px"><strong>Could not read the screenshots.</strong><br>${esc(e?.message||String(e))}</div>`;btn.disabled=false;btn.textContent='Try Again'}
  };
}
window.grImportPastMission=openImport;
function inject(){const a=document.querySelector('.gr-hq-actions');if(!a||a.querySelector('[data-gr-past-import]'))return;const b=document.createElement('button');b.type='button';b.className='button secondary';b.dataset.grPastImport='1';b.textContent='📥 Import Past Mission';b.onclick=openImport;a.appendChild(b)}
new MutationObserver(inject).observe(document.body,{childList:true,subtree:true});setTimeout(inject,0);setTimeout(inject,500);setTimeout(inject,1200);
})();
