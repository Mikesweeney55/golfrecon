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
function aliasesOf(m){return typeof window.grAliasesOf==='function'?window.grAliasesOf(m):(function(){let a=[];if(Array.isArray(m?.aliases))a=m.aliases;else if(typeof m?.aliases==='string')a=m.aliases.split(/[,|]/);else if(typeof m?.nickname==='string')a=m.nickname.split(/[,|]/);a=a.map(x=>String(x||'').trim()).filter(Boolean);if(!a.length){const first=norm(m?.name).split(' ')[0];a=DEFAULT_ALIASES[first]||[]}return [...new Set(a)]}())}
function canonicalMember(p,raw){return typeof window.grCanonicalMember==='function'?window.grCanonicalMember(p,raw):null}
function displayName(p,raw){return typeof window.grDisplayName==='function'?window.grDisplayName(p,raw):(canonicalMember(p,raw)?.name||raw||'Player')}
function memberById(p,id){return (p?.members||[]).find(m=>m.id===id)||null}
function detailDisplayName(p,r){return memberById(p,r?.hole_detail_canonical_id)?.name||displayName(p,r?.player_name)}
function rosterForMission(p,m){
  const ids=new Set(Array.isArray(m?.participants)?m.participants:[]);
  return (p?.members||[]).filter(x=>!ids.size||ids.has(x.id)).map(x=>({id:x.id,name:x.name,aliases:aliasesOf(x)}));
}

function cleanHoles(holes){return typeof window.grCleanHoles==='function'?window.grCleanHoles(holes):(function(){const map=new Map();for(const h of (Array.isArray(holes)?holes:[])){const hole=Number(h?.hole);if(!Number.isInteger(hole)||hole<1||hole>18)continue;map.set(hole,{hole,par:finite(h?.par)?Number(h.par):null,score:finite(h?.score)?Number(h.score):null})}return [...map.values()].sort((a,b)=>a.hole-b.hole)}())}
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
  if(typeof window.grMissionStandingsRows==='function')return window.grMissionStandingsRows(m);
  const rows=Array.isArray(m?.results)?m.results.map((r,i)=>({...r,_i:i})):[];
  return rows.sort((a,b)=>{
    const ap=finite(a.finish_position)?Number(a.finish_position):999,bp=finite(b.finish_position)?Number(b.finish_position):999;
    if(ap!==bp)return ap-bp;
    const an=finite(a.net)?Number(a.net):999,bn=finite(b.net)?Number(b.net):999;
    return an-bn||a._i-b._i;
  });
}
function lowLeaders(rows,key){
  const vals=rows.filter(r=>finite(r[key])).map(r=>Number(r[key]));
  if(!vals.length)return[];
  const best=Math.min(...vals);
  return rows.filter(r=>finite(r[key])&&Number(r[key])===best);
}
function detailHigh(detail,getter){
  const vals=detail.map(getter).filter(Number.isFinite);
  if(!vals.length)return[];
  const best=Math.max(...vals);
  return best>0?detail.filter(x=>getter(x)===best):[];
}
function detailLow(detail,getter){
  const vals=detail.map(getter).filter(Number.isFinite);
  if(!vals.length)return[];
  const best=Math.min(...vals);
  return detail.filter(x=>getter(x)===best);
}
function namesOf(p,rows,detail=false){
  return rows.map(x=>detail?detailDisplayName(p,x.r||x):displayName(p,(x.r||x).player_name)).join(' & ');
}
function missionNarrative(p,m,rows,detail,birds,back,clean){
  const lines=[],net=lowLeaders(rows,'net');
  const note=String(m?.recap_note||m?.notes||'').trim();if(note)lines.push(`From the field: ${note}`);
  if(net.length){
    const score=Number(net[0].net);
    if(net.length>1)lines.push(`${namesOf(p,net)} finished dead even at net ${score}. Nobody gets to talk too much.`);
    else{
      const runner=rows.filter(r=>finite(r.net)&&r!==net[0]).sort((a,b)=>Number(a.net)-Number(b.net))[0];
      const margin=runner?Number(runner.net)-score:null;
      lines.push(`${displayName(p,net[0].player_name)} grabbed low net at ${score}${margin>0?`, ${margin} shot${margin===1?'':'s'} clear of ${displayName(p,runner.player_name)}`:''}. Mission accomplished; complaints can wait until the parking lot.`);
    }
  }
  if(birds.length){
    const birdBits=birds.map(x=>`${detailDisplayName(p,x.r)} struck on ${x.s.birds.map(h=>`#${h.hole}`).join(', ')}`).join('; ');
    lines.push(`${birdBits}.${birds.length>1?' Birdie belt stays in the case — nobody gets it outright.':''}`);
  }
  if(back.length)lines.push(`${namesOf(p,back,true)} closed the strongest with a ${back[0].s.back} on the back. Somebody finally read the mission brief.`);
  if(clean.length)lines.push(`${namesOf(p,clean,true)} kept the card most civilized with ${clean[0].s.doubles.length} double-or-worse hole${clean[0].s.doubles.length===1?'':'s'}.`);
  if(!detail.some(x=>x.s.holes.length))lines.push('Hole-by-hole detail is still limited, so this recap stays with the official results.');
  return lines.slice(0,5);
}
function summaryMarkup(p,m){
  if(typeof window.grMissionRecapMarkup==='function')return window.grMissionRecapMarkup(p,m);
  return '<div class="gr155-empty">No results yet.</div>';
}
function fmtRecapDate(v){if(!v)return '';try{return new Date(v+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}catch{return String(v)}}
function platoonRecapMarkup(p){return typeof window.grPlatoonRecapMarkup==='function'?window.grPlatoonRecapMarkup(p):'<div class="gr155-empty">Platoon recap unavailable.</div>'}
function enhancePlatoonRecap(){}

function missionIdFromCard(card){
  const direct=card.querySelector('[data-gr-add-results]')?.dataset.grAddResults;if(direct)return direct;
  for(const b of card.querySelectorAll('button')){const s=b.getAttribute('onclick')||'';let m=s.match(/grOpenMissionEditor\(['\"]([^'\"]+)/);if(m)return m[1];m=s.match(/grViewMission\(['\"]([^'\"]+)/);if(m)return m[1]}
  return '';
}
function enhanceCard(card){
  // Add Results + HQ recap are rendered by platoons-v15-real.js (audit Phases 2–3).
  card.querySelectorAll('.gr155-upload-status').forEach(x=>x.remove());
}
function enhanceAll(){document.querySelectorAll('.gr-mission').forEach(enhanceCard)}

function openHoleImport(id){
  const p=getP(),m=p?(p.missions||[]).find(x=>x.id===id):null;if(!m)return;
  if(!Array.isArray(m.results)||!m.results.length){alert('Upload Official Results first.');return}
  if(typeof platoonDialog!=='function'||typeof callPlatoonFunction!=='function'||typeof platoonFilePayload!=='function'){alert('Hole-by-hole import is unavailable.');return}
  const locked=typeof window.grLockOfficialResults==='function'?window.grLockOfficialResults(m):(clone(m.results)||[]);
  const d=platoonDialog(`<div class="dialog-head"><div><div class="eyebrow">HOLE-BY-HOLE DETAIL</div><h2>${esc(m.title||m.locationName||'Mission')}</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div><div class="platoon-notice"><strong>Confirm each player before saving.</strong><br>Official gross, net, finish and points stay locked.</div><label>Round story / anything worth highlighting<textarea id="gr155RecapNote" style="min-height:82px" placeholder="Crazy shot, trash talk, weather, side story, anything memorable...">${esc(m.recap_note||'')}</textarea><span class="muted" style="font-size:9px">This will help shape the After Action Report.</span></label><label class="upload-zone" style="cursor:pointer"><strong>Add player scorecard screenshots</strong><span>Four screenshots are OK · each image may show two players · front/back halves will be merged</span><input id="gr155HoleFiles" type="file" accept="image/*" multiple></label><div id="gr155HoleOut"></div><div class="dialog-actions"><button class="button secondary" type="button" onclick="closePlatoonDialog()">Cancel</button><button class="button primary" id="gr155HoleParse" type="button">Read Scorecards</button></div>`);
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
        const merged=typeof window.grMergeHoleDetailsOntoOfficial==='function'
          ? window.grMergeHoleDetailsOntoOfficial(locked,[...grouped.values()],p)
          : {ok:false,saved:0,results:locked};
        if(!merged.ok){alert('Choose the correct player before saving.');return}
        // Official gross/net/finish/points remain from locked snapshot; only hole detail attaches.
        m.results=merged.results;m.recap_note=String(d.querySelector('#gr155RecapNote')?.value||'').trim();
        try{await Promise.resolve(savePlatoonLocal(p));d.close();setTimeout(()=>{if(typeof render==='function')render();else enhanceAll()},0);alert(`Saved hole-by-hole detail for ${merged.saved} player${merged.saved===1?'':'s'}.`)}catch{}
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

// After Action / standings markup is owned by grMissionRecapMarkup (via real.js grViewMission).

// Setup UI (logo, clubhouse photos, roster) lives in platoons-v15-real.js grOpenSetup.
// Do not replace that dialog here — an earlier override hid the photo upload.

function styles(){if(document.getElementById('gr155DevStyles'))return;const s=document.createElement('style');s.id='gr155DevStyles';s.textContent=`
.gr155-format{font-size:10px;color:var(--muted);font-weight:750;margin-top:2px}.gr155-results-wrap{margin-top:8px}.gr155-results-table{width:100%;border-collapse:collapse;font-size:11px}.gr155-results-table th,.gr155-results-table td{padding:7px 6px;border-bottom:1px solid rgba(255,255,255,.07);text-align:right}.gr155-results-table th:first-child,.gr155-results-table td:first-child,.gr155-results-table th:nth-child(2),.gr155-results-table td:nth-child(2){text-align:left}.gr155-results-table th{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}.gr155-results-table td:nth-child(2){font-weight:800}.gr155-empty{text-align:center;color:var(--muted);padding:14px}.gr155-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px}.gr155-kpi{border:1px solid var(--line);background:#101914;border-radius:11px;padding:9px}.gr155-kpi span{display:block;font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em}.gr155-kpi strong{display:block;margin-top:3px;font-size:12px}.gr155-recon{margin-top:11px}.gr155-recon-title{font-size:9px;font-weight:900;letter-spacing:.12em;color:var(--accent);margin-bottom:6px}.gr155-recon-line{font-size:11px;line-height:1.35;color:#dce6e1;padding:7px 8px;border-left:2px solid rgba(184,234,104,.42);background:rgba(255,255,255,.025);margin-top:5px}.gr155-choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.gr155-choice{text-align:left;color:inherit}.gr155-choice strong{display:block;margin-bottom:5px}.gr155-choice span{font-size:11px;color:var(--muted)}.gr155-hole-player{border:1px solid var(--line);border-radius:10px;padding:9px;margin-top:7px}.gr155-hole-player.warn{border-color:rgba(255,176,32,.45)}.gr155-hole-player>div:first-child{display:flex;justify-content:space-between;gap:8px}.gr155-hole-mini{font-size:10px;color:var(--muted);margin-top:4px}.gr155-roster-head{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-top:18px}.gr155-roster{display:grid;gap:8px;margin-top:8px}.gr155-roster-row{display:grid;grid-template-columns:minmax(120px,.8fr) minmax(180px,1.4fr);gap:8px}.gr155-roster-row label{margin-top:0}@media(max-width:700px){.gr155-choice-grid,.gr155-roster-row{grid-template-columns:1fr}.gr155-results-table{font-size:10px}.gr155-results-table th,.gr155-results-table td{padding:6px 4px}}
`;document.head.appendChild(s)}
function recapStyles(){if(document.getElementById('gr155RecapStyles'))return;const s=document.createElement('style');s.id='gr155RecapStyles';s.textContent=`.gr155-recap-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}.gr155-recap-block{border:1px solid var(--line);background:#101914;border-radius:14px;padding:12px;min-width:0}.gr155-recap-title{font-size:9px;font-weight:950;letter-spacing:.12em;color:var(--accent);margin-bottom:9px}.gr155-recap-row{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:10.5px}.gr155-recap-row:last-child{border-bottom:0}.gr155-recap-row span:last-child{white-space:nowrap;font-weight:800}.gr155-recap-hi{padding:7px 0;border-bottom:1px solid rgba(255,255,255,.06)}.gr155-recap-hi span{display:block;font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.gr155-recap-hi strong{display:block;font-size:11px;margin-top:2px}.gr155-recap-copy p{font-size:13px;line-height:1.45;margin:0 0 10px;color:#dce6e1}.gr155-recap-copy p:last-child{margin-bottom:0}.gr155-platoon-recap{margin-top:14px}.gr155-intel-wide{grid-column:1/-1}.gr155-eagle-hero{display:flex;align-items:center;gap:10px;padding:4px 0 9px;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:3px}.gr155-eagle-hero>span{font-size:30px}.gr155-eagle-hero strong{display:block;font-size:22px;color:var(--accent);line-height:1}.gr155-eagle-hero small{display:block;font-size:7px;color:var(--muted);letter-spacing:.1em;margin-top:3px}.gr155-eagle-row span:last-child{color:var(--accent)}.gr155-record{padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)}.gr155-record:last-child{border-bottom:0}.gr155-record-label{display:block;font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}.gr155-record strong{display:block;font-size:12px}.gr155-record small{display:block;font-size:10px;color:#c5d4cd;margin-top:2px;line-height:1.3}.gr155-record-future{opacity:.75}@media(max-width:900px){.gr155-recap-grid{grid-template-columns:1fr 1fr}.gr155-intel-wide{grid-column:1/-1}}@media(max-width:700px){.gr155-platoon-recap{margin-right:0}.gr155-recap-grid{grid-template-columns:1fr}.gr155-recap-block{padding:11px}.gr155-recap-row{font-size:11px}.gr155-recap-copy p{font-size:13.5px}}`;document.head.appendChild(s)}
styles();recapStyles();
window.grOpenResultsChooser=openChooser;
window.grOpenHoleImport=openHoleImport;
// No MutationObserver — HQ / Add Results / standings owned by real.js + grMissionRecapMarkup.
})();
