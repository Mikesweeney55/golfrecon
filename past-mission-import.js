(()=>{
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const uid=()=>`mission-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
function aliasesOf(m){let a=[];if(Array.isArray(m?.aliases))a=m.aliases;else if(typeof m?.aliases==='string')a=m.aliases.split(/[,|]/);else if(typeof m?.nickname==='string')a=m.nickname.split(/[,|]/);return a.map(x=>String(x||'').trim()).filter(Boolean)}
function canonicalMember(p,raw){const n=norm(raw);if(!n)return null;const exact=(p?.members||[]).filter(m=>[m.name,...aliasesOf(m)].map(norm).includes(n));if(exact.length===1)return exact[0];const first=n.split(' ')[0],fm=(p?.members||[]).filter(m=>norm(m.name).split(' ')[0]===first);return fm.length===1?fm[0]:null}
function dialog(inner){let d=document.getElementById('grPastMissionDialog');if(!d){d=document.createElement('dialog');d.id='grPastMissionDialog';document.body.appendChild(d)}d.innerHTML=`<div class="dialog-card">${inner}</div>`;d.showModal();return d}
function close(){document.getElementById('grPastMissionDialog')?.close()}
async function openImport(){
  const p=window.loadPlatoonLocal?.();if(!p)return alert('Platoon data is unavailable.');
  if(typeof window.callPlatoonFunction!=='function'||typeof window.platoonFilePayload!=='function')return alert('Screenshot import is unavailable.');
  const d=dialog(`<div class="dialog-head"><div><div class="eyebrow">HISTORICAL IMPORT</div><h2>Import Past Mission</h2></div><button class="icon-button" data-close type="button">✕</button></div><p class="muted" style="font-size:12px">Upload the event overview plus gross and net/points leaderboard screenshots. Golf Recon will build the completed Mission for you.</p><label class="upload-zone" style="cursor:pointer"><strong>📥 Add screenshots</strong><span>Usually 3 screenshots · overview + gross + net/points</span><input id="grPastFiles" type="file" accept="image/*" multiple></label><label>Round story / anything worth highlighting<textarea id="grPastStory" rows="3" placeholder="Optional — weather, trash talk, crazy shots, side bets, meltdowns…"></textarea></label><div id="grPastOut"></div><div class="dialog-actions"><button class="button secondary" data-cancel type="button">Cancel</button><button class="button primary" id="grPastRead" type="button">Read Screenshots</button></div>`);
  d.querySelector('[data-close]').onclick=close;d.querySelector('[data-cancel]').onclick=close;
  const files=d.querySelector('#grPastFiles'),out=d.querySelector('#grPastOut'),btn=d.querySelector('#grPastRead');
  btn.onclick=async()=>{
    const fs=[...files.files];if(!fs.length){out.innerHTML='<div class="platoon-notice">Add at least one screenshot.</div>';return}
    btn.disabled=true;btn.textContent='Reading…';
    try{
      const images=[];for(const f of fs)images.push(await window.platoonFilePayload(f));
      const parsed=await window.callPlatoonFunction({action:'parse_completed_mission',images});
      const ev=parsed?.event||{},results=Array.isArray(parsed?.results)?parsed.results:[];
      if(!results.length)throw new Error('No player results were found.');
      const roster=(p.members||[]).filter(m=>m.status!=='inactive');
      out.innerHTML=`<div class="platoon-notice" style="margin-top:12px"><strong>Confirm before creating.</strong><br>Edit anything the screenshots did not capture correctly.</div><div class="grid two"><label>Mission name<input id="grPastTitle" value="${esc(ev.title||'Past Mission')}"></label><label>Date<input id="grPastDate" type="date" value="${esc(ev.date||'')}"></label><label>Tee time<input id="grPastTime" type="time" value="${esc((ev.tee_time||'').slice(0,5))}"></label><label>Format<input id="grPastFormat" value="${esc(ev.format||'Stroke Play')}"></label></div><label>Course<input id="grPastCourse" value="${esc(ev.course_name||'')}"></label><div style="margin-top:14px"><div class="eyebrow">PLAYERS & RESULTS</div>${results.map((r,i)=>{const m=canonicalMember(p,r.player_name);return `<div class="gr-past-result" data-i="${i}" style="border:1px solid var(--line);border-radius:12px;padding:9px;margin-top:7px"><div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px"><strong>${esc(r.player_name||'Player')}</strong><span>${finite(r.net)?`Net ${Number(r.net)}`:'Net —'} · ${finite(r.gross)?`Gross ${Number(r.gross)}`:'Gross —'}${finite(r.raw_points)?` · ${Number(r.raw_points)} pts`:''}</span></div><label style="margin-top:7px">Match to Platoon player<select data-match><option value="">Choose player…</option>${roster.map(x=>`<option value="${esc(x.id)}" ${m?.id===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label></div>`}).join('')}</div>${Array.isArray(parsed?.warnings)&&parsed.warnings.length?`<div class="platoon-notice" style="margin-top:10px">${parsed.warnings.map(x=>esc(x)).join('<br>')}</div>`:''}<div class="dialog-actions"><button class="button secondary" id="grPastBack" type="button">Back</button><button class="button primary" id="grPastCreate" type="button">Create Completed Mission</button></div>`;
      btn.style.display='none';
      out.querySelector('#grPastBack').onclick=()=>{out.innerHTML='';btn.style.display='';btn.disabled=false;btn.textContent='Read Screenshots'};
      out.querySelector('#grPastCreate').onclick=async()=>{
        const title=out.querySelector('#grPastTitle').value.trim()||'Past Mission',date=out.querySelector('#grPastDate').value,teeTime=out.querySelector('#grPastTime').value,locationName=out.querySelector('#grPastCourse').value.trim()||'Course TBD',format=out.querySelector('#grPastFormat').value.trim()||'Stroke Play';
        if(!date)return alert('Confirm the round date before creating the Mission.');
        const participants=[],saved=[];
        for(const row of out.querySelectorAll('.gr-past-result')){
          const i=Number(row.dataset.i),r=results[i],memberId=row.querySelector('[data-match]')?.value;if(!memberId)continue;
          const member=roster.find(x=>x.id===memberId);if(!member)continue;participants.push(member.id);saved.push({player_name:member.name,gross:finite(r.gross)?Number(r.gross):null,net:finite(r.net)?Number(r.net):null,finish_position:finite(r.finish_position)?Number(r.finish_position):null,raw_points:finite(r.raw_points)?Number(r.raw_points):null,eagle_count:finite(r.eagle_count)?Number(r.eagle_count):null});
        }
        if(!saved.length)return alert('Match at least one player before creating the Mission.');
        const story=d.querySelector('#grPastStory')?.value.trim()||'';
        const mission={id:uid(),date,teeTime,type:'battle',courseId:'',locationName,title,format,notes:'',status:'completed',participants:[...new Set(participants)],results:saved};if(story)mission.recap_note=story;
        p.missions=p.missions||[];p.missions.push(mission);
        const createBtn=out.querySelector('#grPastCreate');createBtn.disabled=true;createBtn.textContent='Saving…';
        try{await Promise.resolve(window.savePlatoonLocal(p));close();setTimeout(()=>{if(typeof window.render==='function')window.render();else location.reload()},50);alert(`Created completed Mission: ${title}`)}catch(e){createBtn.disabled=false;createBtn.textContent='Create Completed Mission';alert(e?.message||String(e))}
      };
    }catch(e){out.innerHTML=`<div class="platoon-notice">${esc(e?.message||String(e))}</div>`;btn.disabled=false;btn.textContent='Read Screenshots'}
  };
}
window.grImportPastMission=openImport;
function inject(){const a=document.querySelector('.gr-hq-actions');if(!a||a.querySelector('[data-gr-past-import]'))return;const b=document.createElement('button');b.type='button';b.className='button secondary';b.dataset.grPastImport='1';b.textContent='📥 Import Past Mission';b.onclick=openImport;a.appendChild(b)}
new MutationObserver(inject).observe(document.body,{childList:true,subtree:true});setTimeout(inject,0);setTimeout(inject,500);setTimeout(inject,1200);
})();
