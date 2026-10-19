(()=>{
'use strict';

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

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
  if(!a.length){
    const first=norm(m?.name).split(' ')[0];
    a=DEFAULT_ALIASES[first]||[];
  }
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

function displayName(p,raw){
  return canonicalMember(p,raw)?.name||raw||'Player';
}

function memberById(p,id){
  return (p?.members||[]).find(m=>m.id===id)||null;
}

function detailDisplayName(p,r){
  return memberById(p,r?.hole_detail_canonical_id)?.name||displayName(p,r?.player_name);
}

function cleanCourseName(v){
  let s=String(v||'').replace(/\s+/g,' ').trim();
  if(!s)return'Course TBD';
  const known=["Campbell's Scottish Highlands","Campbell’s Scottish Highlands"];
  for(const k of known){
    if(s.toLowerCase().startsWith(k.toLowerCase()))return k;
  }
  for(const token of ['...','…']){
    const i=s.indexOf(token);
    if(i>=0)s=s.slice(0,i).trim();
  }
  s=s.replace(/\s*\([^)]*$/,'').trim();
  s=s.replace(/\s+(?:dan itibaren|ücretsiz|fullbody|kuvvet|antrenman)\b.*$/i,'').trim();
  s=s.replace(/\s*\([^)]*(?:\.\.\.|…)[^)]*\)\s*/g,' ').replace(/\s*\?{2,}\s*$/,'').replace(/\s{2,}/g,' ').trim();
  return s||'Course TBD';
}

function cleanHoles(holes){
  const map=new Map();
  for(const h of (Array.isArray(holes)?holes:[])){
    const hole=Number(h?.hole);
    if(!Number.isInteger(hole)||hole<1||hole>18)continue;
    map.set(hole,{
      hole,
      par:finite(h?.par)?Number(h.par):null,
      score:finite(h?.score)?Number(h.score):null
    });
  }
  return [...map.values()].sort((a,b)=>a.hole-b.hole);
}

function detailStats(r){
  const holes=cleanHoles(r?.holes).filter(h=>finite(h.score));
  const birds=holes.filter(h=>finite(h.par)&&h.score===h.par-1);
  const eagles=holes.filter(h=>finite(h.par)&&h.score<=h.par-2);
  const doubles=holes.filter(h=>finite(h.par)&&h.score>=h.par+2);
  const frontH=holes.filter(h=>h.hole<=9),backH=holes.filter(h=>h.hole>=10);
  const front=frontH.length===9?frontH.reduce((s,h)=>s+h.score,0):null;
  const back=backH.length===9?backH.reduce((s,h)=>s+h.score,0):null;
  return {holes,birds,eagles,doubles,front,back};
}

/** Official Mission results are the source of truth for standings order. */
function missionStandingsRows(m){
  const rows=Array.isArray(m?.results)?m.results.map((r,i)=>({...r,_i:i})):[];
  return rows.sort((a,b)=>{
    const ap=finite(a.finish_position)?Number(a.finish_position):999;
    const bp=finite(b.finish_position)?Number(b.finish_position):999;
    if(ap!==bp)return ap-bp;
    const an=finite(a.net)?Number(a.net):999;
    const bn=finite(b.net)?Number(b.net):999;
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

function namesOf(p,rows,useDetail=false){
  return rows.map(x=>useDetail?detailDisplayName(p,x.r||x):displayName(p,(x.r||x).player_name)).join(' & ');
}

function missionHighlights(p,m,rows,detail){
  const net=lowLeaders(rows,'net');
  const gross=lowLeaders(rows,'gross');
  const birds=detailHigh(detail,x=>x.s.birds.length);
  const back=detailLow(detail.filter(x=>x.s.back!==null),x=>x.s.back);
  const clean=detailLow(detail.filter(x=>x.s.holes.length),x=>x.s.doubles.length);
  const points=rows.filter(r=>finite(r.raw_points)).sort((a,b)=>Number(b.raw_points)-Number(a.raw_points));
  const topPoints=points.length&&Number(points[0].raw_points)>0?[points[0]]:[];
  const eagles=rows.filter(r=>Number(r.eagle_count)>0).sort((a,b)=>Number(b.eagle_count)-Number(a.eagle_count));
  return {net,gross,birds,back,clean,topPoints,eagles};
}

function afterActionLines(p,m,rows,detail,hi){
  const lines=[];
  const note=String(m?.recap_note||'').trim();
  if(note)lines.push(`From the field: ${note}`);
  if(hi.net.length){
    const score=Number(hi.net[0].net);
    if(hi.net.length>1){
      lines.push(`${namesOf(p,hi.net)} finished dead even at net ${score}. Nobody gets to talk too much.`);
    }else{
      const runner=rows.filter(r=>finite(r.net)&&r!==hi.net[0]).sort((a,b)=>Number(a.net)-Number(b.net))[0];
      const margin=runner?Number(runner.net)-score:null;
      lines.push(`${displayName(p,hi.net[0].player_name)} grabbed low net at ${score}${margin>0?`, ${margin} shot${margin===1?'':'s'} clear of ${displayName(p,runner.player_name)}`:''}. Mission accomplished; complaints can wait until the parking lot.`);
    }
  }
  if(hi.birds.length){
    const birdBits=hi.birds.map(x=>`${detailDisplayName(p,x.r)} struck on ${x.s.birds.map(h=>`#${h.hole}`).join(', ')}`).join('; ');
    lines.push(`${birdBits}.${hi.birds.length>1?' Birdie belt stays in the case — nobody gets it outright.':''}`);
  }
  if(hi.back.length){
    lines.push(`${namesOf(p,hi.back,true)} closed the strongest with a ${hi.back[0].s.back} on the back. Somebody finally read the mission brief.`);
  }
  if(hi.clean.length){
    lines.push(`${namesOf(p,hi.clean,true)} kept the card most civilized with ${hi.clean[0].s.doubles.length} double-or-worse hole${hi.clean[0].s.doubles.length===1?'':'s'}.`);
  }
  if(!detail.some(x=>x.s.holes.length)){
    lines.push('Hole-by-hole detail is still limited, so this recap stays with the official results.');
  }
  return lines.slice(0,5);
}

function standingsTableMarkup(p,m){
  const rows=missionStandingsRows(m);
  const body=rows.map((r,i)=>{
    const pos=finite(r.finish_position)?Number(r.finish_position):i+1;
    const net=finite(r.net)?Number(r.net):'—';
    const gross=finite(r.gross)?Number(r.gross):'—';
    const pts=finite(r.raw_points)?Number(r.raw_points):0;
    return `<div class="grstd-row"><div class="grstd-name"><b>${pos}</b><span>${esc(displayName(p,r.player_name))}</span></div><div>${net}</div><div>${gross}</div><div>${pts}</div></div>`;
  }).join('')||'<div class="grstd-empty">No results yet.</div>';
  return `<div class="grstd-table"><div class="grstd-head"><div>NAME</div><div>NET</div><div>GROSS</div><div>POINTS</div></div>${body}</div>`;
}

function highlightsMarkup(p,hi){
  const items=[];
  if(hi.net.length)items.push(`<div class="gr155-recap-hi"><span>Low Net</span><strong>${esc(namesOf(p,hi.net))} · ${Number(hi.net[0].net)}</strong></div>`);
  if(hi.gross.length)items.push(`<div class="gr155-recap-hi"><span>Low Gross</span><strong>${esc(namesOf(p,hi.gross))} · ${Number(hi.gross[0].gross)}</strong></div>`);
  if(hi.birds.length)items.push(`<div class="gr155-recap-hi"><span>Birdies</span><strong>${esc(namesOf(p,hi.birds,true))} · ${hi.birds[0].s.birds.length}</strong></div>`);
  if(hi.back.length)items.push(`<div class="gr155-recap-hi"><span>Best Back 9</span><strong>${esc(namesOf(p,hi.back,true))} · ${hi.back[0].s.back}</strong></div>`);
  if(hi.topPoints.length)items.push(`<div class="gr155-recap-hi"><span>Points</span><strong>${esc(displayName(p,hi.topPoints[0].player_name))} · ${Number(hi.topPoints[0].raw_points)}</strong></div>`);
  if(hi.eagles.length)items.push(`<div class="gr155-recap-hi"><span>Eagles</span><strong>${esc(displayName(p,hi.eagles[0].player_name))} · ${Number(hi.eagles[0].eagle_count)}</strong></div>`);
  return items.join('')||'<div class="gr155-empty">No confirmed highlights yet.</div>';
}

function afterActionMarkup(lines){
  if(!lines.length)return'<div class="gr155-empty">Mission complete.</div>';
  return lines.map(x=>`<p>${esc(x)}</p>`).join('');
}

/** Single shared Mission recap: standings + highlights + After Action Report. */
function missionRecapMarkup(p,m){
  // Prefer Phase 2 official-results normalization when available; never invent scores.
  const source=typeof window.grOfficialResultsForRecap==='function'
    ? Object.assign({},m,{results:window.grOfficialResultsForRecap(m)})
    : m;
  const rows=missionStandingsRows(source);
  if(!rows.length)return'<div class="gr155-empty">No results yet.</div>';
  const detail=rows.map(r=>({r,s:detailStats(r)}));
  const hi=missionHighlights(p,source,rows,detail);
  const intel=afterActionLines(p,source,rows,detail,hi);
  return `<div class="gr155-recap-grid" data-gr-shared-recap="1"><section class="gr155-recap-block"><div class="gr155-recap-title">RESULT STANDINGS</div>${standingsTableMarkup(p,source)}</section><section class="gr155-recap-block"><div class="gr155-recap-title">HIGHLIGHTED SCORES</div>${highlightsMarkup(p,hi)}</section><section class="gr155-recap-block gr155-recap-copy"><div class="gr155-recap-title">AFTER ACTION REPORT</div>${afterActionMarkup(intel)}</section></div>`;
}

function installStyles(){
  if(document.getElementById('grSharedRecapStyles'))return;
  const s=document.createElement('style');
  s.id='grSharedRecapStyles';
  s.textContent=`
.grstd-table{width:100%;font-variant-numeric:tabular-nums}
.grstd-head,.grstd-row{display:grid;grid-template-columns:minmax(0,1fr) 52px 62px 62px;align-items:center;column-gap:8px}
.grstd-head{padding:0 0 8px;border-bottom:1px solid rgba(255,255,255,.12);font-size:10px;font-weight:800;letter-spacing:.08em;opacity:.6}
.grstd-head>div:not(:first-child),.grstd-row>div:not(:first-child){text-align:right}
.grstd-row{min-height:44px;border-bottom:1px solid rgba(255,255,255,.08);font-size:14px}
.grstd-row:last-child{border-bottom:0}
.grstd-name{display:flex;align-items:center;gap:8px;min-width:0}
.grstd-name b{width:16px;flex:0 0 16px}
.grstd-name span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.grstd-empty,.gr155-empty{padding:12px 0;opacity:.65}
.gr155-recap-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
.gr155-recap-block{border:1px solid var(--line);background:#101914;border-radius:14px;padding:12px;min-width:0}
.gr155-recap-title{font-size:9px;font-weight:950;letter-spacing:.12em;color:var(--accent);margin-bottom:9px}
.gr155-recap-hi{padding:7px 0;border-bottom:1px solid rgba(255,255,255,.06)}
.gr155-recap-hi span{display:block;font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.gr155-recap-hi strong{display:block;font-size:11px;margin-top:2px}
.gr155-recap-copy p{font-size:10.5px;line-height:1.4;margin:0 0 8px;color:#dce6e1}
.gr155-recap-copy p:last-child{margin-bottom:0}
@media(max-width:700px){
  .gr155-recap-grid{grid-template-columns:1fr}
  .gr155-recap-block{padding:11px}
  .gr155-recap-copy p{font-size:11px}
  .grstd-head,.grstd-row{grid-template-columns:minmax(0,1fr) 44px 54px 56px;column-gap:6px}
  .grstd-row{font-size:13px}
}
`;
  document.head.appendChild(s);
}

installStyles();

window.grEsc=esc;
window.grFinite=finite;
window.grAliasesOf=aliasesOf;
window.grCanonicalMember=canonicalMember;
window.grDisplayName=displayName;
window.grCleanCourseName=cleanCourseName;
window.grMissionStandingsRows=missionStandingsRows;
window.grMissionStandingsMarkup=(m,p)=>standingsTableMarkup(p,m);
window.grMissionRecapMarkup=missionRecapMarkup;
window.grSharedRecapReady=true;
})();
