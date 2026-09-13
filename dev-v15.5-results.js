(()=>{
'use strict';

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const safeDetailImport=typeof window.grUploadScores==='function'?window.grUploadScores:null;
const baseViewMission=typeof window.grViewMission==='function'?window.grViewMission:null;

function getPlatoon(){try{return typeof loadPlatoonLocal==='function'?loadPlatoonLocal():null}catch{return null}}
function getMission(id){const p=getPlatoon();return p?(p.missions||[]).find(m=>m.id===id):null}
function hasOfficial(m){return !!(m&&Array.isArray(m.results)&&m.results.length)}
function hasDetail(m){return !!(m&&(m.scorecardDetail?.savedAt||m.supplementalScorecards?.savedAt||(Array.isArray(m.results)&&m.results.some(r=>Array.isArray(r.holes)&&r.holes.length))))}
function finite(v){return Number.isFinite(Number(v))}
function num(v){return finite(v)?Number(v):null}
function birdies(r){for(const k of ['birdie_count','birdies','birdieCount']){if(finite(r?.[k]))return Number(r[k])}if(Array.isArray(r?.holes)){const n=r.holes.filter(h=>finite(h?.par)&&finite(h?.score)&&Number(h.score)<Number(h.par)).length;return n}return null}

function standings(m){
  const rows=Array.isArray(m?.results)?m.results.map((r,i)=>({...r,_i:i})):[];
  return rows.sort((a,b)=>{
    const ap=num(a.finish_position),bp=num(b.finish_position);
    if(ap!==null||bp!==null)return (ap??999)-(bp??999)||(num(a.net)??999)-(num(b.net)??999)||a._i-b._i;
    const an=num(a.net),bn=num(b.net);
    if(an!==null||bn!==null)return (an??999)-(bn??999)||a._i-b._i;
    return a._i-b._i;
  });
}

function recapText(m){
  const rows=Array.isArray(m?.results)?m.results:[];
  if(!rows.length)return 'Official results have not been uploaded yet.';
  const net=[...rows].filter(r=>finite(r.net)).sort((a,b)=>Number(a.net)-Number(b.net));
  const gross=[...rows].filter(r=>finite(r.gross)).sort((a,b)=>Number(a.gross)-Number(b.gross));
  const pts=[...rows].filter(r=>finite(r.raw_points)).sort((a,b)=>Number(b.raw_points)-Number(a.raw_points));
  const birds=[...rows].map(r=>({r,n:birdies(r)})).filter(x=>x.n!==null).sort((a,b)=>b.n-a.n);
  const parts=[];
  if(net[0]){
    let s=`${net[0].player_name||'Leader'} took low net at ${Number(net[0].net)}`;
    if(net[1]){
      const margin=Number(net[1].net)-Number(net[0].net);
      s+=margin>0?`, ${margin} shot${margin===1?'':'s'} clear of ${net[1].player_name}`:` in a tie with ${net[1].player_name}`;
    }
    parts.push(s+'.');
  }
  if(gross[0])parts.push(`${gross[0].player_name||'Leader'} posted low gross at ${Number(gross[0].gross)}.`);
  if(pts[0]&&Number(pts[0].raw_points)>0)parts.push(`${pts[0].player_name||'Leader'} led the points with ${Number(pts[0].raw_points)}.`);
  if(birds[0]&&birds[0].n>0)parts.push(`${birds[0].r.player_name||'Leader'} led the birdies with ${birds[0].n}.`);
  if(hasOfficial(m)&&hasDetail(m))parts.push('Both result uploads are complete, so the Mission record is locked in.');
  return parts.join(' ')||'Mission complete.';
}

function resultsMarkup(m){
  const rows=standings(m);
  const body=rows.length?rows.map((r,i)=>{
    const pos=finite(r.finish_position)?Number(r.finish_position):i+1;
    return `<tr><td>${pos}</td><td>${esc(r.player_name||'Player')}</td><td>${finite(r.net)?Number(r.net):'—'}</td><td>${finite(r.gross)?Number(r.gross):'—'}</td><td>${finite(r.raw_points)?Number(r.raw_points):'—'}</td></tr>`;
  }).join(''):'<tr><td colspan="5" class="gr155-empty">No official results yet</td></tr>';
  return `<div class="gr155-results-wrap"><table class="gr155-results-table"><thead><tr><th>Pos</th><th>Player</th><th>Net</th><th>Gross</th><th>Pts</th></tr></thead><tbody>${body}</tbody></table><div class="gr155-recap">${esc(recapText(m))}</div></div>`;
}

function uploadStatusMarkup(m){
  return `<div class="gr155-upload-status"><span class="gr155-upload-chip ${hasOfficial(m)?'done':''}">${hasOfficial(m)?'✓':'○'} Official Results</span><span class="gr155-upload-chip ${hasDetail(m)?'done':''}">${hasDetail(m)?'✓':'○'} Hole-by-Hole</span></div>`;
}

function missionIdFromCard(card){
  const direct=card.querySelector('[data-gr-add-results]')?.dataset.grAddResults;
  if(direct)return direct;
  for(const b of card.querySelectorAll('button')){
    const s=b.getAttribute('onclick')||'';
    let m=s.match(/grOpenMissionEditor\(['\"]([^'\"]+)/);if(m)return m[1];
    m=s.match(/grViewMission\(['\"]([^'\"]+)/);if(m)return m[1];
  }
  return '';
}

function ensureFormatInline(card,m){
  const meta=card.querySelector('.gr-meta');
  if(meta)meta.remove();
  const course=card.querySelector('.gr-mission-course');
  if(course&&!card.querySelector('.gr155-format')){
    const f=document.createElement('div');f.className='gr155-format';f.textContent=m?.format||'Format TBD';course.insertAdjacentElement('afterend',f);
  }
}

function enhanceMissionCard(card){
  const id=missionIdFromCard(card);if(!id)return;
  const m=getMission(id);if(!m)return;
  ensureFormatInline(card,m);
  if(m.status!=='completed')return;
  const head=card.querySelector('.gr-mission-head');
  if(head){card.querySelector('.gr155-upload-status')?.remove();head.insertAdjacentHTML('afterend',uploadStatusMarkup(m));}
  const summary=card.querySelector('.gr-summary');if(summary)summary.innerHTML=resultsMarkup(m);
  const actions=card.querySelector('.gr-mini-actions');
  if(actions){
    let b=actions.querySelector('[data-gr-add-results]');
    if(!b){b=document.createElement('button');b.type='button';b.className='button secondary';b.dataset.grAddResults=id;b.textContent='📸 Add Results';actions.appendChild(b)}
    b.onclick=e=>{e.preventDefault();e.stopPropagation();openResultsChooser(id)};
  }
}

function enhanceMissionDialog(id){
  const m=getMission(id);if(!m||m.status!=='completed')return;
  const d=document.getElementById('grPlatoonDialog');if(!d||!d.open)return;
  const summary=d.querySelector('.gr-summary.gr-after-action');if(summary)summary.innerHTML=uploadStatusMarkup(m)+resultsMarkup(m);
}

function normalizeName(v){return String(v||'').trim().toLowerCase()}
function cleanHoles(holes){
  const byHole=new Map();
  for(const h of Array.isArray(holes)?holes:[]){
    const hole=Number(h?.hole);if(!Number.isInteger(hole)||hole<1||hole>18)continue;
    const par=finite(h?.par)?Number(h.par):null,score=finite(h?.score)?Number(h.score):null;
    byHole.set(hole,{hole,par,score});
  }
  return [...byHole.values()].sort((a,b)=>a.hole-b.hole);
}
function holeStats(holes){
  const valid=cleanHoles(holes).filter(h=>finite(h.score));
  const scored=valid.length;
  const front=valid.filter(h=>h.hole<=9).reduce((n,h)=>n+Number(h.score),0);
  const back=valid.filter(h=>h.hole>=10).reduce((n,h)=>n+Number(h.score),0);
  const frontCount=valid.filter(h=>h.hole<=9).length,backCount=valid.filter(h=>h.hole>=10).length;
  const birds=valid.filter(h=>finite(h.par)&&Number(h.score)<Number(h.par)).length;
  const pars=valid.filter(h=>finite(h.par)&&Number(h.score)===Number(h.par)).length;
  const bogeys=valid.filter(h=>finite(h.par)&&Number(h.score)===Number(h.par)+1).length;
  const doubles=valid.filter(h=>finite(h.par)&&Number(h.score)>=Number(h.par)+2).length;
  return {scored,front:frontCount?front:null,back:backCount?back:null,birds,pars,bogeys,doubles};
}
function holePreviewMarkup(parsed,m){
  const official=new Map((m.results||[]).map(r=>[normalizeName(r.player_name),r]));
  const players=Array.isArray(parsed?.players)?parsed.players:[];
  const rows=players.map(player=>{
    const holes=cleanHoles(player.holes),st=holeStats(holes),match=official.has(normalizeName(player.player_name));
    const split=[st.front!==null?`F9 ${st.front}`:'',st.back!==null?`B9 ${st.back}`:''].filter(Boolean).join(' · ');
    return `<div class="gr155-hole-player ${match?'':'warn'}"><div><strong>${esc(player.player_name||'Unknown player')}</strong><span>${holes.length} holes${split?' · '+esc(split):''}</span></div><div class="gr155-hole-mini">${st.birds} birdie${st.birds===1?'':'s'} · ${st.pars} par${st.pars===1?'':'s'}${match?'':' · NO OFFICIAL MATCH'}</div></div>`;
  }).join('')||'<div class="platoon-notice">No player hole details were found.</div>';
  const warnings=(parsed?.warnings||[]).map(w=>`<li>${esc(w)}</li>`).join('');
  return `${rows}${warnings?`<div class="platoon-notice"><strong>Parser notes</strong><ul class="gr155-warnings">${warnings}</ul></div>`:''}`;
}
function openHoleDetailImport(id){
  const p=getPlatoon(),m=(p?.missions||[]).find(x=>x.id===id);if(!m)return;
  if(!hasOfficial(m)){alert('Upload Official Results first. Hole-by-hole detail is matched to the locked official leaderboard.');return}
  if(typeof platoonDialog!=='function'||typeof callPlatoonFunction!=='function'||typeof platoonFilePayload!=='function'){if(typeof safeDetailImport==='function')safeDetailImport(id);else alert('Hole-by-hole import is unavailable.');return}
  const locked=JSON.parse(JSON.stringify(Array.isArray(m.results)?m.results:[]));
  const d=platoonDialog(`<div class="dialog-head"><div><div class="eyebrow">HOLE-BY-HOLE DETAIL</div><h2 style="margin:5px 0 0">${esc(m.title||m.locationName||'Mission')}</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div><div class="platoon-notice"><strong>Official scoring is locked.</strong><br>These screenshots add hole scores to matching players only. Gross, net, finish and points cannot be changed here.</div><label class="upload-zone" style="cursor:pointer"><strong>Add player scorecard screenshots</strong><span>Front 9, back 9, or full 18 · multiple images allowed</span><input id="gr155HoleFiles" type="file" accept="image/*" multiple></label><div id="gr155HoleFileList" class="platoon-file-list"></div><div id="gr155HoleOut"></div><div class="dialog-actions"><button class="button secondary" type="button" onclick="closePlatoonDialog()">Cancel</button><button class="button primary" id="gr155HoleParse" type="button">Read Hole Details</button></div>`);
  const input=d.querySelector('#gr155HoleFiles'),list=d.querySelector('#gr155HoleFileList'),out=d.querySelector('#gr155HoleOut'),btn=d.querySelector('#gr155HoleParse');
  input.onchange=()=>{list.textContent=[...input.files].map(f=>f.name).join(' · ')};
  btn.onclick=async()=>{
    const files=[...input.files];if(!files.length){out.innerHTML='<div class="platoon-notice">Add at least one scorecard screenshot.</div>';return}
    btn.disabled=true;btn.textContent='Reading…';out.innerHTML='<div class="platoon-notice">Reading player names and hole scores…</div>';
    try{
      const images=[];for(const f of files)images.push(await platoonFilePayload(f));
      const parsed=await callPlatoonFunction({action:'parse_hole_details',mission:{date:m.date,locationName:m.locationName,title:m.title},images});
      const players=Array.isArray(parsed?.players)?parsed.players:[];
      const officialNames=new Set(locked.map(r=>normalizeName(r.player_name)));
      const matched=players.filter(x=>officialNames.has(normalizeName(x.player_name))&&cleanHoles(x.holes).length);
      out.innerHTML=`<div class="gr155-hole-preview">${holePreviewMarkup(parsed,m)}</div><div class="dialog-actions"><button class="button primary" id="gr155HoleSave" type="button" ${matched.length?'':'disabled'}>Save Hole-by-Hole Detail</button></div>`;
      const save=out.querySelector('#gr155HoleSave');
      if(save&&!save.disabled)save.onclick=()=>{
        const byName=new Map(locked.map((r,i)=>[normalizeName(r.player_name),i]));
        let saved=0;
        for(const detail of players){
          const key=normalizeName(detail.player_name),idx=byName.get(key);if(idx===undefined)continue;
          const holes=cleanHoles(detail.holes);if(!holes.length)continue;
          locked[idx].holes=holes;
          locked[idx].hole_detail_saved_at=new Date().toISOString();
          locked[idx].hole_detail_source_count=files.length;
          saved++;
        }
        m.results=locked;
        savePlatoonLocal(p);
        d.close();
        setTimeout(enhanceAll,0);
        alert(`Hole-by-hole detail saved for ${saved} player${saved===1?'':'s'}. Official Mission scoring was not changed.`);
      };
    }catch(e){m.results=locked;out.innerHTML=`<div class="platoon-notice" style="border-color:rgba(255,77,79,.35);color:#ffadad">${esc(e.message||String(e))}</div>`}
    finally{btn.disabled=false;btn.textContent='Read Hole Details'}
  };
}

function closeChooser(){document.getElementById('gr155ResultsChooser')?.close()}
function openResultsChooser(id){
  const m=getMission(id);if(!m)return;
  let d=document.getElementById('gr155ResultsChooser');
  if(!d){d=document.createElement('dialog');d.id='gr155ResultsChooser';document.body.appendChild(d)}
  d.innerHTML=`<div class="dialog-card"><div class="dialog-head"><div><div class="eyebrow">MISSION RESULTS</div><h2 style="margin:5px 0 0">${esc(m.title||m.locationName||'Mission')}</h2></div><button class="icon-button" data-close type="button">✕</button></div>${uploadStatusMarkup(m)}<div class="gr155-choice-grid"><button class="card gr155-choice" data-official type="button"><strong>🏆 Official Results</strong><span>Leaderboard, gross, net, finish and points</span></button><button class="card gr155-choice" data-detail type="button"><strong>📸 Hole-by-Hole Detail</strong><span>Add scorecard screenshots without changing official scoring</span></button></div><div class="dialog-actions"><button class="button secondary" data-close type="button">Cancel</button></div></div>`;
  d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());
  d.querySelector('[data-official]').onclick=()=>{d.close();if(typeof openMissionImport==='function')openMissionImport(id);else alert('Official result import is unavailable.')};
  d.querySelector('[data-detail]').onclick=()=>{d.close();openHoleDetailImport(id)};
  d.showModal();
}

window.grUploadScores=openResultsChooser;
if(baseViewMission){window.grViewMission=id=>{baseViewMission(id);setTimeout(()=>enhanceMissionDialog(id),0);setTimeout(()=>enhanceMissionDialog(id),120)}}

function installStyles(){
  if(document.getElementById('gr155DevStyles'))return;
  const s=document.createElement('style');s.id='gr155DevStyles';s.textContent=`
.gr155-format{font-size:10px;color:var(--muted);font-weight:750;margin-top:2px}
.gr155-upload-status{display:flex;gap:6px;flex-wrap:wrap;margin:9px 0 2px}
.gr155-upload-chip{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;padding:5px 8px;font-size:9px;font-weight:850;color:var(--muted);background:#101914}
.gr155-upload-chip.done{color:#bff58a;border-color:rgba(184,234,104,.38);background:rgba(184,234,104,.07)}
.gr155-results-wrap{margin-top:8px}
.gr155-results-table{width:100%;border-collapse:collapse;font-size:11px}
.gr155-results-table th,.gr155-results-table td{padding:7px 6px;border-bottom:1px solid rgba(255,255,255,.07);text-align:right}
.gr155-results-table th:first-child,.gr155-results-table td:first-child,.gr155-results-table th:nth-child(2),.gr155-results-table td:nth-child(2){text-align:left}
.gr155-results-table th{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.gr155-results-table td:nth-child(2){font-weight:800}
.gr155-empty{text-align:center!important;color:var(--muted);padding:14px!important}
.gr155-recap{margin-top:10px;font-size:11px;line-height:1.35;color:#dce6e1}
#gr155ResultsChooser{border:0;padding:0;background:transparent;color:var(--text);width:min(620px,calc(100% - 28px))}
#gr155ResultsChooser::backdrop{background:rgba(0,0,0,.72)}
.gr155-choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.gr155-choice{text-align:left;color:inherit;cursor:pointer}
.gr155-choice strong{display:block;margin-bottom:5px}.gr155-choice span{display:block;color:var(--muted);font-size:11px;line-height:1.3}
.gr155-hole-preview{display:grid;gap:8px;margin-top:12px}.gr155-hole-player{border:1px solid var(--line);border-radius:10px;padding:9px 10px;background:rgba(255,255,255,.025)}.gr155-hole-player.warn{border-color:rgba(255,176,32,.45)}.gr155-hole-player>div:first-child{display:flex;justify-content:space-between;gap:8px;align-items:center}.gr155-hole-player span,.gr155-hole-mini{font-size:10px;color:var(--muted)}.gr155-hole-mini{margin-top:5px}.gr155-warnings{margin:6px 0 0;padding-left:18px}
@media(max-width:760px){
  .pregame-hero,.pregame-hero-head{overflow:visible!important}
  .pregame-course-picker{display:grid!important;visibility:visible!important;opacity:1!important;grid-template-columns:42px minmax(0,1fr)!important;align-items:center!important;gap:6px!important;width:100%!important;max-width:none!important;min-width:0!important;position:relative!important;z-index:120!important;margin:0!important}
  .pregame-course-picker span{display:block!important;visibility:visible!important}
  .pregame-course-select{display:block!important;visibility:visible!important;opacity:1!important;width:100%!important;min-width:0!important;max-width:none!important;height:34px!important;position:relative!important;z-index:121!important;-webkit-appearance:menulist!important;appearance:auto!important;color:#eef7f2!important;background:#0c1b15!important}
  .gr155-choice-grid{grid-template-columns:1fr}
  .gr155-results-table{font-size:10px}
  .gr155-results-table th,.gr155-results-table td{padding:6px 4px}
}
`;
  document.head.appendChild(s);
}

function enhanceAll(){installStyles();document.querySelectorAll('.gr-mission').forEach(enhanceMissionCard)}
installStyles();
new MutationObserver(enhanceAll).observe(document.body,{childList:true,subtree:true});
setTimeout(enhanceAll,0);setTimeout(enhanceAll,250);setTimeout(enhanceAll,900);

})();
