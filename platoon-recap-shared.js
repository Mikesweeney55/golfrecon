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

function guestsOfMission(m){
  if(typeof window.grGuestsOf==='function')return window.grGuestsOf(m)||[];
  if(Array.isArray(m?.guests)&&m.guests.length)return m.guests.map(g=>String(g||'').trim()).filter(Boolean);
  const hit=String(m?.notes||'').match(/\[\[GR_GUESTS:([\s\S]*?)\]\]/);
  if(!hit)return[];
  try{return (JSON.parse(hit[1])||[]).map(g=>String(g||'').trim()).filter(Boolean)}catch{return[]}
}

function isGuestName(p,m,raw){
  if(typeof window.grIsGuestPlayer==='function')return window.grIsGuestPlayer(p,m,raw);
  const rawName=String(raw||'').trim();
  if(!rawName)return false;
  if(canonicalMember(p,rawName))return false;
  const n=norm(rawName);
  return guestsOfMission(m).some(g=>norm(g)===n);
}

function labeledName(p,m,raw){
  if(typeof window.grFormatPlayerLabel==='function')return window.grFormatPlayerLabel(p,m,raw);
  const base=displayName(p,raw);
  return isGuestName(p,m,raw)?`${base} (Guest)`:base;
}

function labeledDetailName(p,m,r){
  const base=detailDisplayName(p,r);
  const raw=r?.player_name||base;
  return isGuestName(p,m,raw)?`${base} (Guest)`:base;
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
      score:finite(h?.score)?Number(h.score):null,
      net:finite(h?.net)?Number(h.net):null
    });
  }
  return [...map.values()].sort((a,b)=>a.hole-b.hole);
}

function scoreMarkerClass(score,par){
  if(!finite(score)||!finite(par))return'';
  const d=Number(score)-Number(par);
  if(d<=-2)return'eagle';
  if(d===-1)return'birdie';
  if(d===1)return'bogey';
  if(d===2)return'double';
  if(d>=3)return'worse';
  return'';
}

/** Shared hole list + par map across players who have hole detail. */
function missionHoleFrame(detail){
  const withHoles=detail.filter(x=>x.s.holes.length);
  if(!withHoles.length)return null;
  const holeSet=new Set();
  const parByHole=new Map();
  for(const x of withHoles){
    for(const h of x.s.holes){
      holeSet.add(h.hole);
      if(finite(h.par)&&!parByHole.has(h.hole))parByHole.set(h.hole,Number(h.par));
    }
  }
  const holes=[...holeSet].sort((a,b)=>a-b);
  const front=holes.filter(h=>h<=9);
  const back=holes.filter(h=>h>=10);
  return {holes,front,back,parByHole,players:withHoles};
}

function nineStripMarkup(holeNums,parByHole,playerHoleMap,{showNet=false}={}){
  if(!holeNums.length)return'';
  const totalLabel=holeNums[0]<=9?'Out':'In';
  const parCells=holeNums.map(n=>`<div class="gr-hsc-cell gr-hsc-par">${parByHole.has(n)?parByHole.get(n):'—'}</div>`).join('');
  const parSum=holeNums.reduce((s,n)=>s+(parByHole.has(n)?parByHole.get(n):0),0);
  const scoreCells=holeNums.map(n=>{
    const h=playerHoleMap.get(n);
    if(!h||!finite(h.score))return`<div class="gr-hsc-cell gr-hsc-empty">—</div>`;
    const cls=scoreMarkerClass(h.score,h.par??parByHole.get(n));
    const netBit=showNet&&finite(h.net)?`<span class="gr-hsc-net">${Number(h.net)}</span>`:'';
    return`<div class="gr-hsc-cell gr-hsc-score ${cls}"><span class="gr-hsc-gross">${Number(h.score)}</span>${netBit}</div>`;
  }).join('');
  const grossSum=holeNums.every(n=>finite(playerHoleMap.get(n)?.score))
    ? holeNums.reduce((s,n)=>s+Number(playerHoleMap.get(n).score),0)
    : null;
  const netSum=showNet&&holeNums.every(n=>finite(playerHoleMap.get(n)?.net))
    ? holeNums.reduce((s,n)=>s+Number(playerHoleMap.get(n).net),0)
    : null;
  const cols=`36px repeat(${holeNums.length},minmax(28px,1fr)) 34px`;
  return `<div class="gr-hsc-nine">
    <div class="gr-hsc-row gr-hsc-holes" style="grid-template-columns:${cols}"><div class="gr-hsc-label">Hole</div>${holeNums.map(n=>`<div class="gr-hsc-cell gr-hsc-num">${n}</div>`).join('')}<div class="gr-hsc-cell gr-hsc-tot">${totalLabel}</div></div>
    <div class="gr-hsc-row gr-hsc-pars" style="grid-template-columns:${cols}"><div class="gr-hsc-label">Par</div>${parCells}<div class="gr-hsc-cell gr-hsc-tot">${parSum||'—'}</div></div>
    <div class="gr-hsc-row gr-hsc-scores" style="grid-template-columns:${cols}"><div class="gr-hsc-label">Gross</div>${scoreCells}<div class="gr-hsc-cell gr-hsc-tot">${grossSum!=null?grossSum:'—'}${netSum!=null?`<span class="gr-hsc-net-tot">N ${netSum}</span>`:''}</div></div>
  </div>`;
}

function holeScoreboardMarkup(p,m,detail){
  const frame=missionHoleFrame(detail);
  if(!frame)return'';
  const anyHoleNet=frame.players.some(x=>x.s.holes.some(h=>finite(h.net)));
  const cards=frame.players.map(x=>{
    const name=labeledDetailName(p,m,x.r);
    const map=new Map(x.s.holes.map(h=>[h.hole,h]));
    const gross=finite(x.r.gross)?Number(x.r.gross):(x.s.holes.length?x.s.holes.reduce((s,h)=>s+(finite(h.score)?h.score:0),0):null);
    const net=finite(x.r.net)?Number(x.r.net):null;
    const hcp=finite(x.r.handicap)?Number(x.r.handicap):null;
    const meta=[
      gross!=null?`Gross ${gross}`:null,
      net!=null?`Net ${net}`:null,
      hcp!=null?`HCP ${hcp}`:null
    ].filter(Boolean).join(' · ');
    const strips=[
      nineStripMarkup(frame.front,frame.parByHole,map,{showNet:anyHoleNet}),
      nineStripMarkup(frame.back,frame.parByHole,map,{showNet:anyHoleNet})
    ].filter(Boolean).join('');
    return `<div class="gr-hsc-player"><div class="gr-hsc-player-head"><strong>${esc(name)}</strong>${meta?`<span>${esc(meta)}</span>`:''}</div><div class="gr-hsc-scroll">${strips}</div></div>`;
  }).join('');
  return `<section class="gr155-recap-block gr-hsc-board"><div class="gr155-recap-title">HOLE BY HOLE</div><p class="gr-hsc-legend muted">Gross per hole · birdie ○ · bogey □${anyHoleNet?' · net under score':''}</p>${cards}</section>`;
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

function namesOf(p,rows,useDetail=false,m=null){
  return rows.map(x=>{
    if(useDetail)return m?labeledDetailName(p,m,x.r||x):detailDisplayName(p,x.r||x);
    const raw=(x.r||x).player_name;
    return m?labeledName(p,m,raw):displayName(p,raw);
  }).join(' & ');
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
      lines.push(`${namesOf(p,hi.net,false,m)} finished dead even at net ${score}. Nobody gets to talk too much.`);
    }else{
      const runner=rows.filter(r=>finite(r.net)&&r!==hi.net[0]).sort((a,b)=>Number(a.net)-Number(b.net))[0];
      const margin=runner?Number(runner.net)-score:null;
      lines.push(`${labeledName(p,m,hi.net[0].player_name)} grabbed low net at ${score}${margin>0?`, ${margin} shot${margin===1?'':'s'} clear of ${labeledName(p,m,runner.player_name)}`:''}. Mission accomplished; complaints can wait until the parking lot.`);
    }
  }
  if(hi.birds.length){
    const birdBits=hi.birds.map(x=>`${labeledDetailName(p,m,x.r)} struck on ${x.s.birds.map(h=>`#${h.hole}`).join(', ')}`).join('; ');
    lines.push(`${birdBits}.${hi.birds.length>1?' Birdie belt stays in the case — nobody gets it outright.':''}`);
  }
  if(hi.back.length){
    lines.push(`${namesOf(p,hi.back,true,m)} closed the strongest with a ${hi.back[0].s.back} on the back. Somebody finally read the mission brief.`);
  }
  if(hi.clean.length){
    lines.push(`${namesOf(p,hi.clean,true,m)} kept the card most civilized with ${hi.clean[0].s.doubles.length} double-or-worse hole${hi.clean[0].s.doubles.length===1?'':'s'}.`);
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
    return `<div class="grstd-row"><div class="grstd-name"><b>${pos}</b><span>${esc(labeledName(p,m,r.player_name))}</span></div><div>${net}</div><div>${gross}</div><div>${pts}</div></div>`;
  }).join('')||'<div class="grstd-empty">No results yet.</div>';
  return `<div class="grstd-table"><div class="grstd-head"><div>NAME</div><div>NET</div><div>GROSS</div><div>POINTS</div></div>${body}</div>`;
}

function highlightsMarkup(p,hi,m=null){
  const items=[];
  if(hi.net.length)items.push(`<div class="gr155-recap-hi"><span>Low Net</span><strong>${esc(namesOf(p,hi.net,false,m))} · ${Number(hi.net[0].net)}</strong></div>`);
  if(hi.gross.length)items.push(`<div class="gr155-recap-hi"><span>Low Gross</span><strong>${esc(namesOf(p,hi.gross,false,m))} · ${Number(hi.gross[0].gross)}</strong></div>`);
  if(hi.birds.length)items.push(`<div class="gr155-recap-hi"><span>Birdies</span><strong>${esc(namesOf(p,hi.birds,true,m))} · ${hi.birds[0].s.birds.length}</strong></div>`);
  if(hi.back.length)items.push(`<div class="gr155-recap-hi"><span>Best Back 9</span><strong>${esc(namesOf(p,hi.back,true,m))} · ${hi.back[0].s.back}</strong></div>`);
  if(hi.topPoints.length)items.push(`<div class="gr155-recap-hi"><span>Points</span><strong>${esc(labeledName(p,m||{},hi.topPoints[0].player_name))} · ${Number(hi.topPoints[0].raw_points)}</strong></div>`);
  if(hi.eagles.length)items.push(`<div class="gr155-recap-hi"><span>Eagles</span><strong>${esc(labeledName(p,m||{},hi.eagles[0].player_name))} · ${Number(hi.eagles[0].eagle_count)}</strong></div>`);
  return items.join('')||'<div class="gr155-empty">No confirmed highlights yet.</div>';
}

function missionPhotosMarkup(p,m){
  const photos=typeof window.grMissionPhotosOf==='function'
    ? window.grMissionPhotosOf(p,m)
    : (Array.isArray(m?.photos)?m.photos:[]).filter(x=>x&&x.dataUrl).slice(0,3);
  if(!photos.length)return '';
  return `<section class="gr155-recap-block gr155-recap-photos"><div class="gr155-recap-title">MISSION PHOTOS</div><div class="gr-mission-photo-strip">${photos.map((ph,i)=>`<div class="gr-mission-photo-thumb"><img src="${String(ph.dataUrl||'').replace(/"/g,'')}" alt="Mission photo ${i+1}"></div>`).join('')}</div></section>`;
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
  return `${missionPhotosMarkup(p,source)}<div class="gr155-recap-grid" data-gr-shared-recap="1"><section class="gr155-recap-block"><div class="gr155-recap-title">RESULT STANDINGS</div>${standingsTableMarkup(p,source)}</section><section class="gr155-recap-block"><div class="gr155-recap-title">HIGHLIGHTED SCORES</div>${highlightsMarkup(p,hi,source)}</section><section class="gr155-recap-block gr155-recap-copy"><div class="gr155-recap-title">AFTER ACTION REPORT</div>${afterActionMarkup(intel)}</section></div>${holeScoreboardMarkup(p,source,detail)}`;
}

function installStyles(){
  if(document.getElementById('grSharedRecapStyles'))return;
  const s=document.createElement('style');
  s.id='grSharedRecapStyles';
  s.textContent=`
.grstd-table{width:100%;font-variant-numeric:tabular-nums}
.grstd-head,.grstd-row{display:grid;grid-template-columns:minmax(0,1fr) 52px 62px 62px;align-items:center;column-gap:8px}
.grstd-head{padding:0 0 8px;border-bottom:1px solid rgba(255,255,255,.12);font-size:var(--fs-data);font-weight:800;letter-spacing:.08em;opacity:.6}
.grstd-head>div:not(:first-child),.grstd-row>div:not(:first-child){text-align:right}
.grstd-row{min-height:44px;border-bottom:1px solid rgba(255,255,255,.08);font-size:var(--fs-data)}
.grstd-row:last-child{border-bottom:0}
.grstd-name{display:flex;align-items:center;gap:8px;min-width:0}
.grstd-name b{width:16px;flex:0 0 16px}
.grstd-name span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.grstd-empty,.gr155-empty{padding:12px 0;opacity:.65}
.gr155-recap-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
.gr155-recap-block{border:1px solid var(--line);background:#101914;border-radius:14px;padding:12px;min-width:0}
.gr155-recap-title{font-size:var(--fs-data);font-weight:950;letter-spacing:.12em;color:var(--accent);margin-bottom:9px}
.gr155-recap-hi{padding:7px 0;border-bottom:1px solid rgba(255,255,255,.06)}
.gr155-recap-hi span{display:block;font-size:var(--fs-data);color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.gr155-recap-hi strong{display:block;font-size:var(--fs-data);margin-top:2px}
.gr155-recap-copy p{font-size:var(--fs-data);line-height:1.4;margin:0 0 8px;color:#dce6e1}
.gr155-recap-copy p:last-child{margin-bottom:0}
.gr155-recap-photos{margin-top:10px}
.gr-mission-photo-strip,.gr-mission-photo-thumbs{display:flex;flex-wrap:wrap;gap:8px}
.gr-mission-photo-thumb{position:relative;width:92px;height:92px;border-radius:12px;overflow:hidden;border:1px solid rgba(212,175,106,.28);background:#14110e}
.gr-mission-photo-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.gr-mission-photo-thumbs .gr-clubhouse-thumb-actions{position:absolute;inset:auto 0 0 0;display:flex;justify-content:flex-end;padding:5px;background:linear-gradient(transparent,rgba(0,0,0,.78))}
.gr-hsc-board{margin-top:10px}
.gr-hsc-legend{font-size:var(--fs-data);margin:0 0 10px;line-height:1.35}
.gr-hsc-player{border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(16,20,14,.55);padding:10px;margin-top:8px}
.gr-hsc-player:first-of-type{margin-top:0}
.gr-hsc-player-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 12px;margin-bottom:8px}
.gr-hsc-player-head strong{font-size:var(--fs-data);font-weight:900}
.gr-hsc-player-head span{font-size:var(--fs-data);color:var(--muted);font-weight:700}
.gr-hsc-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px}
.gr-hsc-nine{display:inline-block;min-width:min(100%,420px);margin-right:12px;vertical-align:top}
.gr-hsc-nine:last-child{margin-right:0}
.gr-hsc-row{display:grid;gap:3px;align-items:center;margin-top:3px;font-variant-numeric:tabular-nums}
.gr-hsc-label{font-size:var(--fs-data);color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-weight:800}
.gr-hsc-cell{min-height:28px;display:grid;place-items:center;text-align:center;font-size:var(--fs-data);font-weight:800;line-height:1.05}
.gr-hsc-num{color:#c9b08a;font-weight:900}
.gr-hsc-par,.gr-hsc-tot{color:var(--muted);font-weight:700}
.gr-hsc-score{position:relative;color:var(--text);padding:2px}
.gr-hsc-score.birdie{border:1.5px solid #dfe9e3;border-radius:50%}
.gr-hsc-score.eagle{border:1.5px solid #dfe9e3;border-radius:50%;box-shadow:0 0 0 2px #101914,0 0 0 3.5px #dfe9e3}
.gr-hsc-score.bogey{border:1.5px solid #dfe9e3;border-radius:0}
.gr-hsc-score.double{border:1.5px solid #dfe9e3;border-radius:0;box-shadow:0 0 0 2px #101914,0 0 0 3.5px #dfe9e3}
.gr-hsc-score.worse{border:1.5px solid #ff8b7a;border-radius:0;box-shadow:0 0 0 2px #101914,0 0 0 3.5px #ff8b7a}
.gr-hsc-gross{display:block}
.gr-hsc-net{display:block;font-size:10px;font-weight:700;color:#b8a4d9;margin-top:1px;line-height:1}
.gr-hsc-net-tot{display:block;font-size:10px;color:#b8a4d9;font-weight:700;margin-top:1px}
.gr-hsc-empty{color:rgba(255,255,255,.25)}
@media(max-width:700px){
  .gr155-recap-grid{grid-template-columns:1fr}
  .gr155-recap-block{padding:11px}
  .gr155-recap-copy p{font-size:var(--fs-data)}
  .grstd-head,.grstd-row{grid-template-columns:minmax(0,1fr) 44px 54px 56px;column-gap:6px}
  .grstd-row{font-size:var(--fs-data)}
  .gr-mission-photo-thumb{width:78px;height:78px}
  .gr-hsc-row{gap:2px}
  .gr-hsc-cell{min-height:26px}
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
window.grNorm=typeof norm==='function'?norm:s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
window.grCleanHoles=cleanHoles;
window.grSharedRecapReady=true;
})();
