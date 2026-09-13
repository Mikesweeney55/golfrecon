(()=>{
'use strict';

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const clone=v=>{try{return JSON.parse(JSON.stringify(v))}catch{return null}};
const getP=()=>{try{return loadPlatoonLocal()}catch{return null}};
const getM=id=>{const p=getP();return p?(p.missions||[]).find(m=>m.id===id):null};

const DEFAULT_ALIASES={
  mike:['Mike','Mike S.','Sweeney'],
  ryan:['Ryan','Ryan S.','Sully'],
  steve:['Steve','Stephen'],
  charlie:['Charlie','Chuck'],
  kevin:['Kevin','Kevin C.','Cunny'],
  josh:['Josh','Joshua','Mannke']
};
function aliasesOf(m){
  let a=[];
  if(Array.isArray(m?.aliases))a=m.aliases;
  else if(typeof m?.aliases==='string')a=m.aliases.split(/[,|]/);
  else if(typeof m?.nickname==='string')a=m.nickname.split(/[,|]/);
  a=a.map(x=>String(x||'').trim()).filter(Boolean);
  if(!a.length){const first=norm(m?.name).split(' ')[0];a=DEFAULT_ALIASES[first]||[]}
  return [...new Set(a)];
}
function canonicalMember(p,raw){
  const n=norm(raw);if(!n)return null;
  const exact=[];
  for(const m of (p?.members||[])){
    const vals=[m.name,...aliasesOf(m)].map(norm).filter(Boolean);
    if(vals.includes(n))exact.push(m);
  }
  if(exact.length===1)return exact[0];
  const first=n.split(' ')[0];
  const firstMatches=(p?.members||[]).filter(m=>norm(m.name).split(' ')[0]===first);
  return firstMatches.length===1?firstMatches[0]:null;
}
function displayName(p,raw){return canonicalMember(p,raw)?.name||raw||'Player'}
function memberById(p,id){return (p?.members||[]).find(m=>m.id===id)||null}
function detailDisplayName(p,r){return memberById(p,r?.hole_detail_canonical_id)?.name||displayName(p,r?.player_name)}
function rosterForMission(p,m){
  const ids=new Set(Array.isArray(m?.participants)?m.participants:[]);
  return (p?.members||[]).filter(x=>!ids.size||ids.has(x.id)).map(x=>({id:x.id,name:x.name,aliases:aliasesOf(x)}));
}

function cleanHoles(holes){
  const map=new Map();
  for(const h of (Array.isArray(holes)?holes:[])){
    const hole=Number(h?.hole);if(!Number.isInteger(hole)||hole<1||hole>18)continue;
    map.set(hole,{hole,par:finite(h?.par)?Number(h.par):null,score:finite(h?.score)?Number(h.score):null});
  }
  return [...map.values()].sort((a,b)=>a.hole-b.hole);
}
function holeSig(holes){return cleanHoles(holes).map(h=>`${h.hole}:${h.par??''}:${h.score??''}`).join('|')}
function detailStats(r){
  const holes=cleanHoles(r?.holes).filter(h=>finite(h.score));
  const birds=holes.filter(h=>finite(h.par)&&h.score===h.par-1);
  const eagles=holes.filter(h=>finite(h.par)&&h.score<=h.par-2);
  const pars=holes.filter(h=>finite(h.par)&&h.score===h.par);
  const bogeys=holes.filter(h=>finite(h.par)&&h.score===h.par+1);
  const doubles=holes.filter(h=>finite(h.par)&&h.score>=h.par+2);
  const worst=[...holes].filter(h=>finite(h.par)).sort((a,b)=>(b.score-b.par)-(a.score-a.par))[0]||null;
  const frontH=holes.filter(h=>h.hole<=9),backH=holes.filter(h=>h.hole>=10);
  const front=frontH.length===9?frontH.reduce((s,h)=>s+h.score,0):null;
  const back=backH.length===9?backH.reduce((s,h)=>s+h.score,0):null;
  return {holes,birds,eagles,pars,bogeys,doubles,worst,front,back};
}
function standings(m){
  const rows=Array.isArray(m?.results)?m.results.map((r,i)=>({...r,_i:i})):[];
  return rows.sort((a,b)=>{
    const ap=finite(a.finish_position)?Number(a.finish_position):999,bp=finite(b.finish_position)?Number(b.finish_position):999;
    if(ap!==bp)return ap-bp;
    const an=finite(a.net)?Number(a.net):999,bn=finite(b.net)?Number(b.net):999;
    return an-bn||a._i-b._i;
  });
}
function summaryMarkup(p,m){
  const rows=standings(m);if(!rows.length)return '<div class="gr155-empty">No results yet.</div>';
  const net=[...rows].filter(r=>finite(r.net)).sort((a,b)=>Number(a.net)-Number(b.net));
  const gross=[...rows].filter(r=>finite(r.gross)).sort((a,b)=>Number(a.gross)-Number(b.gross));
  const pts=[...rows].filter(r=>finite(r.raw_points)).sort((a,b)=>Number(b.raw_points)-Number(a.raw_points));
  const detail=rows.map(r=>({r,s:detailStats(r)}));
  const birdLead=[...detail].filter(x=>x.s.birds.length).sort((a,b)=>b.s.birds.length-a.s.birds.length)[0];
  const clean=[...detail].filter(x=>x.s.holes.length).sort((a,b)=>a.s.doubles.length-b.s.doubles.length)[0];
  const back=[...detail].filter(x=>x.s.back!==null).sort((a,b)=>a.s.back-b.s.back)[0];
  const blow=[...detail].filter(x=>x.s.doubles.length).sort((a,b)=>b.s.doubles.length-a.s.doubles.length)[0];
  const cards=[];
  if(net[0])cards.push(`<div class="gr155-kpi"><span>Low Net</span><strong>${esc(displayName(p,net[0].player_name))} · ${Number(net[0].net)}</strong></div>`);
  if(gross[0])cards.push(`<div class="gr155-kpi"><span>Low Gross</span><strong>${esc(displayName(p,gross[0].player_name))} · ${Number(gross[0].gross)}</strong></div>`);
  if(pts[0]&&Number(pts[0].raw_points)>0)cards.push(`<div class="gr155-kpi"><span>Points</span><strong>${esc(displayName(p,pts[0].player_name))} · ${Number(pts[0].raw_points)}</strong></div>`);
  if(birdLead)cards.push(`<div class="gr155-kpi"><span>Birdies</span><strong>${esc(detailDisplayName(p,birdLead.r))} · ${birdLead.s.birds.length}</strong></div>`);
  const recon=[];
  if(net[0]){const margin=net[1]?Number(net[1].net)-Number(net[0].net):null;recon.push(`${displayName(p,net[0].player_name)} won low net at ${Number(net[0].net)}${margin>0?`, ${margin} shot${margin===1?'':'s'} clear of ${displayName(p,net[1].player_name)}`:''}.`)}
  if(gross[0])recon.push(`${displayName(p,gross[0].player_name)} posted low gross at ${Number(gross[0].gross)}.`);
  if(birdLead){const hs=birdLead.s.birds.map(h=>h.hole).join(', ');recon.push(`${detailDisplayName(p,birdLead.r)} led the birdies with ${birdLead.s.birds.length}${hs?` on hole${birdLead.s.birds.length===1?'':'s'} ${hs}`:''}.`)}
  if(clean)recon.push(`${detailDisplayName(p,clean.r)} kept the cleanest card with ${clean.s.doubles.length} double-or-worse hole${clean.s.doubles.length===1?'':'s'}.`);
  if(back)recon.push(`${detailDisplayName(p,back.r)} had the best back nine at ${back.s.back}.`);
  if(blow&&blow.s.doubles.length>=2)recon.push(`${detailDisplayName(p,blow.r)} took the most damage: ${blow.s.doubles.length} double-or-worse holes.`);
  const body=rows.map((r,i)=>`<tr><td>${finite(r.finish_position)?Number(r.finish_position):i+1}</td><td>${esc(displayName(p,r.player_name))}</td><td>${finite(r.net)?Number(r.net):'—'}</td><td>${finite(r.gross)?Number(r.gross):'—'}</td><td>${finite(r.raw_points)?Number(r.raw_points):'—'}</td></tr>`).join('');
  return `<div class="gr155-results-wrap"><table class="gr155-results-table"><thead><tr><th>Pos</th><th>Player</th><th>Net</th><th>Gross</th><th>Pts</th></tr></thead><tbody>${body}</tbody></table>${cards.length?`<div class="gr155-kpis">${cards.join('')}</div>`:''}<div class="gr155-recon"><div class="gr155-recon-title">ROUND RECON</div>${recon.map(x=>`<div class="gr155-recon-line">${esc(x)}</div>`).join('')}</div></div>`;
}

function missionIdFromCard(card){
  const direct=card.querySelector('[data-gr-add-results]')?.dataset.grAddResults;if(direct)return direct;
  for(const b of card.querySelectorAll('button')){const s=b.getAttribute('onclick')||'';let m=s.match(/grOpenMissionEditor\(['\"]([^'\"]+)/);if(m)return m[1];m=s.match(/grViewMission\(['\"]([^'\"]+)/);if(m)return m[1]}
  return '';
}
function enhanceCard(card){
  const id=missionIdFromCard(card),p=getP(),m=p?(p.missions||[]).find(x=>x.id===id):null;if(!m)return;
  card.querySelectorAll('.gr155-upload-status').forEach(x=>x.remove());
  const meta=card.querySelector('.gr-meta');if(meta)meta.remove();
  const course=card.querySelector('.gr-mission-course');if(course&&!card.querySelector('.gr155-format')){const f=document.createElement('div');f.className='gr155-format';f.textContent=m.format||'Format TBD';course.insertAdjacentElement('afterend',f)}
  if(m.status==='completed'){
    const s=card.querySelector('.gr-summary'),markup=summaryMarkup(p,m);if(s&&s.dataset.grRecon!=='1'){s.innerHTML=markup;s.dataset.grRecon='1'}
    const actions=card.querySelector('.gr-mini-actions');if(actions){let b=actions.querySelector('[data-gr-add-results]');if(!b){b=document.createElement('button');b.type='button';b.className='button secondary';b.dataset.grAddResults=id;b.textContent='📸 Add Results';actions.appendChild(b)}b.onclick=e=>{e.preventDefault();e.stopPropagation();openChooser(id)}}
  }
}
function enhanceAll(){document.querySelectorAll('.gr-mission').forEach(enhanceCard);document.querySelectorAll('.gr155-upload-status').forEach(x=>x.remove())}

function openHoleImport(id){
  const p=getP(),m=p?(p.missions||[]).find(x=>x.id===id):null;if(!m)return;
  if(!Array.isArray(m.results)||!m.results.length){alert('Upload Official Results first.');return}
  if(typeof platoonDialog!=='function'||typeof callPlatoonFunction!=='function'||typeof platoonFilePayload!=='function'){alert('Hole-by-hole import is unavailable.');return}
  const locked=clone(m.results);
  const d=platoonDialog(`<div class="dialog-head"><div><div class="eyebrow">HOLE-BY-HOLE DETAIL</div><h2>${esc(m.title||m.locationName||'Mission')}</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div><div class="platoon-notice"><strong>Confirm each player before saving.</strong><br>Official gross, net, finish and points stay locked.</div><label class="upload-zone" style="cursor:pointer"><strong>Add player scorecard screenshots</strong><span>Four screenshots are OK · each image may show two players · front/back halves will be merged</span><input id="gr155HoleFiles" type="file" accept="image/*" multiple></label><div id="gr155HoleOut"></div><div class="dialog-actions"><button class="button secondary" type="button" onclick="closePlatoonDialog()">Cancel</button><button class="button primary" id="gr155HoleParse" type="button">Read Scorecards</button></div>`);
  const input=d.querySelector('#gr155HoleFiles'),out=d.querySelector('#gr155HoleOut'),btn=d.querySelector('#gr155HoleParse');
  btn.onclick=async()=>{
    const files=[...input.files];if(!files.length){out.innerHTML='<div class="platoon-notice">Add at least one screenshot.</div>';return}
    btn.disabled=true;btn.textContent='Reading…';
    try{
      const images=[];for(const f of files)images.push(await platoonFilePayload(f));
      const parsed=await callPlatoonFunction({action:'parse_hole_details',mission:{date:m.date,locationName:m.locationName,title:m.title,roster:rosterForMission(p,m)},images});
      const details=(parsed?.players||[]).map(x=>({raw:x.player_name,member:canonicalMember(p,x.player_name),holes:cleanHoles(x.holes)}));
      const roster=rosterForMission(p,m);
      out.innerHTML=details.map((x,i)=>`<div class="gr155-hole-player ${x.member?'':'warn'}"><div><strong>${esc(x.raw||'Unknown')}</strong><span>${x.holes.length} holes</span></div><label style="margin-top:7px">Confirm player<select data-gr155-match="${i}"><option value="">Choose player…</option>${roster.map(r=>`<option value="${esc(r.id)}" ${x.member?.id===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label></div>`).join('')+`<div class="dialog-actions"><button class="button primary" id="gr155HoleSave" type="button">Save Hole-by-Hole</button></div>`;
      const save=out.querySelector('#gr155HoleSave');
      if(save)save.onclick=async()=>{
        const grouped=new Map();
        for(let i=0;i<details.length;i++){
          const d0=details[i];if(!d0.holes.length)continue;
          const memberId=out.querySelector(`[data-gr155-match="${i}"]`)?.value;
          const member=memberById(p,memberId);if(!member)continue;
          const g=grouped.get(member.id)||{member,raw:[],holes:[]};
          g.raw.push(d0.raw);
          g.holes=cleanHoles([...(g.holes||[]),...d0.holes]);
          grouped.set(member.id,g);
        }
        let saved=0;
        for(const g of grouped.values()){
          const target=locked.find(r=>canonicalMember(p,r.player_name)?.id===g.member.id);if(!target)continue;
          for(const other of locked){
            if(other!==target&&other.hole_detail_canonical_id===g.member.id){
              delete other.holes;delete other.hole_detail_saved_at;delete other.hole_detail_source_name;delete other.hole_detail_canonical_id;
            }
          }
          target.holes=g.holes;
          target.hole_detail_saved_at=new Date().toISOString();
          target.hole_detail_source_name=[...new Set(g.raw.filter(Boolean))].join(' + ');
          target.hole_detail_canonical_id=g.member.id;
          saved++;
        }
        if(!saved){alert('Choose the correct player before saving.');return}
        m.results=locked;
        try{await Promise.resolve(savePlatoonLocal(p));d.close();setTimeout(()=>{document.querySelectorAll('.gr-summary').forEach(x=>delete x.dataset.grRecon);enhanceAll()},0);alert(`Saved hole-by-hole detail for ${saved} player${saved===1?'':'s'}.`)}catch{}
      };
    }catch(e){out.innerHTML=`<div class="platoon-notice">${esc(e?.message||String(e))}</div>`}
    finally{btn.disabled=false;btn.textContent='Read Scorecards'}
  };
}
function openChooser(id){
  const m=getM(id);if(!m)return;
  let d=document.getElementById('gr155ResultsChooser');if(!d){d=document.createElement('dialog');d.id='gr155ResultsChooser';document.body.appendChild(d)}
  d.innerHTML=`<div class="dialog-card"><div class="dialog-head"><div><div class="eyebrow">MISSION RESULTS</div><h2>${esc(m.title||m.locationName||'Mission')}</h2></div><button class="icon-button" data-close type="button">✕</button></div><div class="gr155-choice-grid"><button class="card gr155-choice" data-official type="button"><strong>🏆 Official Results</strong><span>Leaderboard, gross, net, finish and points</span></button><button class="card gr155-choice" data-detail type="button"><strong>📸 Hole-by-Hole Detail</strong><span>Match scorecards through the Platoon master roster</span></button></div></div>`;
  d.querySelector('[data-close]').onclick=()=>d.close();d.querySelector('[data-official]').onclick=()=>{d.close();if(typeof openMissionImport==='function')openMissionImport(id)};d.querySelector('[data-detail]').onclick=()=>{d.close();openHoleImport(id)};d.showModal();
}
window.grUploadScores=openChooser;

const baseView=window.grViewMission;
if(baseView)window.grViewMission=id=>{baseView(id);setTimeout(()=>{const p=getP(),m=p?(p.missions||[]).find(x=>x.id===id):null,d=document.getElementById('grPlatoonDialog');if(m?.status==='completed'&&d?.open){d.querySelectorAll('.gr155-upload-status').forEach(x=>x.remove());const s=d.querySelector('.gr-summary.gr-after-action');if(s)s.innerHTML=summaryMarkup(p,m)}},20)};

const baseSetup=window.grOpenSetup;
window.grOpenSetup=()=>{
  const p=getP();if(!p||typeof platoonDialog!=='function'){if(baseSetup)baseSetup();return}
  const d=platoonDialog(`<div class="dialog-head"><div><div class="eyebrow">PLATOON</div><h2>Setup</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div><label>Name<input id="grPName2" value="${esc(p.name||'')}"></label><label>Motto<input id="grPMotto2" value="${esc(p.motto||'')}"></label><div class="grid two"><label>Season<input id="grPSeason2" type="number" value="${esc(p.season||new Date().getFullYear())}"></label><label>Visibility<select id="grPVis2"><option ${p.visibility==='Private'?'selected':''}>Private</option><option ${p.visibility==='Invite only'?'selected':''}>Invite only</option></select></label></div><div class="gr155-roster-head"><div><div class="eyebrow">MASTER ROSTER</div><div class="muted" style="font-size:10px">Chief-editable names used for screenshot recognition. Recognition names can be comma-separated.</div></div><button class="button secondary" id="grAddRoster" type="button">+ Player</button></div><div id="grRosterRows" class="gr155-roster"></div><div class="dialog-actions"><button class="button secondary" type="button" onclick="closePlatoonDialog()">Cancel</button><button class="button primary" id="grPSave2" type="button">Save</button></div>`);
  const rows=d.querySelector('#grRosterRows');
  const draw=()=>{rows.innerHTML=(p.members||[]).map((m,i)=>`<div class="gr155-roster-row" data-i="${i}"><label>Name<input data-name value="${esc(m.name||'')}"></label><label>Recognize as<input data-alias value="${esc(aliasesOf(m).join(', '))}" placeholder="Kevin, Kevin C., Cunny"></label></div>`).join('')};draw();
  d.querySelector('#grAddRoster').onclick=()=>{p.members=p.members||[];p.members.push({id:'cadet-'+Date.now(),name:'New Player',role:'cadet',linked:false,aliases:[]});draw()};
  d.querySelector('#grPSave2').onclick=async()=>{
    p.name=d.querySelector('#grPName2').value.trim()||'My Time';p.motto=d.querySelector('#grPMotto2').value.trim();p.season=Number(d.querySelector('#grPSeason2').value)||new Date().getFullYear();p.visibility=d.querySelector('#grPVis2').value;
    [...rows.querySelectorAll('.gr155-roster-row')].forEach(row=>{const m=p.members[Number(row.dataset.i)];if(!m)return;m.name=row.querySelector('[data-name]').value.trim()||m.name;m.aliases=row.querySelector('[data-alias]').value.split(',').map(x=>x.trim()).filter(Boolean);m.nickname=m.aliases.join(', ')});
    try{await Promise.resolve(savePlatoonLocal(p));d.close()}catch{}
  };
};

function styles(){if(document.getElementById('gr155DevStyles'))return;const s=document.createElement('style');s.id='gr155DevStyles';s.textContent=`
.gr155-format{font-size:10px;color:var(--muted);font-weight:750;margin-top:2px}.gr155-results-wrap{margin-top:8px}.gr155-results-table{width:100%;border-collapse:collapse;font-size:11px}.gr155-results-table th,.gr155-results-table td{padding:7px 6px;border-bottom:1px solid rgba(255,255,255,.07);text-align:right}.gr155-results-table th:first-child,.gr155-results-table td:first-child,.gr155-results-table th:nth-child(2),.gr155-results-table td:nth-child(2){text-align:left}.gr155-results-table th{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}.gr155-results-table td:nth-child(2){font-weight:800}.gr155-empty{text-align:center;color:var(--muted);padding:14px}.gr155-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px}.gr155-kpi{border:1px solid var(--line);background:#101914;border-radius:11px;padding:9px}.gr155-kpi span{display:block;font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em}.gr155-kpi strong{display:block;margin-top:3px;font-size:12px}.gr155-recon{margin-top:11px}.gr155-recon-title{font-size:9px;font-weight:900;letter-spacing:.12em;color:var(--accent);margin-bottom:6px}.gr155-recon-line{font-size:11px;line-height:1.35;color:#dce6e1;padding:7px 8px;border-left:2px solid rgba(184,234,104,.42);background:rgba(255,255,255,.025);margin-top:5px}.gr155-choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.gr155-choice{text-align:left;color:inherit}.gr155-choice strong{display:block;margin-bottom:5px}.gr155-choice span{font-size:11px;color:var(--muted)}.gr155-hole-player{border:1px solid var(--line);border-radius:10px;padding:9px;margin-top:7px}.gr155-hole-player.warn{border-color:rgba(255,176,32,.45)}.gr155-hole-player>div:first-child{display:flex;justify-content:space-between;gap:8px}.gr155-hole-mini{font-size:10px;color:var(--muted);margin-top:4px}.gr155-roster-head{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-top:18px}.gr155-roster{display:grid;gap:8px;margin-top:8px}.gr155-roster-row{display:grid;grid-template-columns:minmax(120px,.8fr) minmax(180px,1.4fr);gap:8px}.gr155-roster-row label{margin-top:0}@media(max-width:700px){.gr155-choice-grid,.gr155-roster-row{grid-template-columns:1fr}.gr155-results-table{font-size:10px}.gr155-results-table th,.gr155-results-table td{padding:6px 4px}}
`;document.head.appendChild(s)}
styles();
let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhanceAll()})}
new MutationObserver(ms=>{if(ms.some(mu=>[...mu.addedNodes].some(n=>n?.nodeType===1&&(n.matches?.('.gr-mission')||n.querySelector?.('.gr-mission')))))queue()}).observe(document.body,{childList:true,subtree:true});
setTimeout(queue,0);setTimeout(queue,300);setTimeout(queue,900);
})();
