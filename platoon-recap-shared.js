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

/** Strokes received on a hole when SI is unknown — hole # stands in as rank. */
function strokesOnHole(hcp,hole){
  if(!finite(hcp)||Number(hcp)<=0||!Number.isInteger(hole))return 0;
  const h=Math.max(0,Math.floor(Number(hcp)));
  const full=Math.floor(h/18);
  const rem=h%18;
  return full+(hole<=rem?1:0);
}
function holeNetValue(h,hcp,parByHole){
  if(finite(h?.net))return Number(h.net);
  if(!finite(h?.score))return null;
  if(!finite(hcp))return null;
  return Number(h.score)-strokesOnHole(hcp,h.hole);
}

function nineStripMarkup(holeNums,parByHole,playerHoleMap,{hcp=null,showNet=true}={}){
  if(!holeNums.length)return'';
  const totalLabel=holeNums[0]<=9?'Out':'In';
  const cols=`42px repeat(${holeNums.length},minmax(26px,1fr)) 36px`;
  const row=(cls,label,cells,tot)=>`<div class="gr-hsc-row ${cls}" style="grid-template-columns:${cols}"><div class="gr-hsc-label">${label}</div>${cells}<div class="gr-hsc-cell gr-hsc-tot">${tot}</div></div>`;
  const holeCells=holeNums.map(n=>`<div class="gr-hsc-cell gr-hsc-num">${n}</div>`).join('');
  const parCells=holeNums.map(n=>`<div class="gr-hsc-cell gr-hsc-par">${parByHole.has(n)?parByHole.get(n):'—'}</div>`).join('');
  const parSum=holeNums.reduce((s,n)=>s+(parByHole.has(n)?parByHole.get(n):0),0);
  const grossCells=holeNums.map(n=>{
    const h=playerHoleMap.get(n);
    if(!h||!finite(h.score))return`<div class="gr-hsc-cell gr-hsc-empty">·</div>`;
    const cls=scoreMarkerClass(h.score,h.par??parByHole.get(n));
    return`<div class="gr-hsc-cell gr-hsc-score ${cls}"><span class="gr-hsc-gross">${Number(h.score)}</span></div>`;
  }).join('');
  const grossVals=holeNums.map(n=>playerHoleMap.get(n)?.score).filter(finite);
  const grossSum=grossVals.length===holeNums.length?grossVals.reduce((s,v)=>s+Number(v),0):null;
  let netRow='';
  if(showNet){
    const netCells=holeNums.map(n=>{
      const h=playerHoleMap.get(n);
      const nv=holeNetValue(h,hcp,parByHole);
      if(!finite(nv))return`<div class="gr-hsc-cell gr-hsc-empty">·</div>`;
      return`<div class="gr-hsc-cell gr-hsc-netcell">${Number(nv)}</div>`;
    }).join('');
    const netVals=holeNums.map(n=>holeNetValue(playerHoleMap.get(n),hcp,parByHole));
    const netSum=netVals.every(finite)?netVals.reduce((s,v)=>s+Number(v),0):null;
    netRow=row('gr-hsc-nets','Net',netCells,netSum!=null?netSum:'·');
  }
  return `<div class="gr-hsc-nine" aria-label="${totalLabel} nine">
    ${row('gr-hsc-holes','Hole',holeCells,totalLabel)}
    ${row('gr-hsc-pars','Par',parCells,parSum||'·')}
    ${row('gr-hsc-scores','Gross',grossCells,grossSum!=null?grossSum:'·')}
    ${netRow}
  </div>`;
}

function holeScoreboardMarkup(p,m,detail){
  const frame=missionHoleFrame(detail);
  if(!frame)return'';
  const cards=frame.players.map(x=>{
    const name=labeledDetailName(p,m,x.r);
    const map=new Map(x.s.holes.map(h=>[h.hole,h]));
    const gross=finite(x.r.gross)?Number(x.r.gross):(x.s.holes.length?x.s.holes.reduce((s,h)=>s+(finite(h.score)?h.score:0),0):null);
    const net=finite(x.r.net)?Number(x.r.net):null;
    const hcp=finite(x.r.handicap)?Number(x.r.handicap):null;
    const showNet=net!=null||hcp!=null||x.s.holes.some(h=>finite(h.net));
    const chips=[
      gross!=null?`<span class="gr-hsc-chip"><em>G</em>${gross}</span>`:'',
      net!=null?`<span class="gr-hsc-chip"><em>N</em>${net}</span>`:'',
      hcp!=null?`<span class="gr-hsc-chip"><em>H</em>${hcp}</span>`:''
    ].filter(Boolean).join('');
    const strips=[
      nineStripMarkup(frame.front,frame.parByHole,map,{hcp,showNet}),
      nineStripMarkup(frame.back,frame.parByHole,map,{hcp,showNet})
    ].filter(Boolean).join('');
    return `<article class="gr-hsc-card">
      <header class="gr-hsc-nameplate"><strong>${esc(name)}</strong><div class="gr-hsc-chips">${chips}</div></header>
      <div class="gr-hsc-paper"><div class="gr-hsc-scroll">${strips}</div></div>
    </article>`;
  }).join('');
  return `<section class="gr-hsc-board"><div class="gr-hsc-board-head"><div class="gr155-recap-title">SCORECARD</div><span class="gr-hsc-legend">○ birdie · □ bogey</span></div>${cards}</section>`;
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
.gr-hsc-board{margin-top:12px;display:grid;gap:10px}
.gr-hsc-board-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:0 2px}
.gr-hsc-board-head .gr155-recap-title{margin:0}
.gr-hsc-legend{font-size:var(--fs-data);color:#c4b49a;font-weight:700;letter-spacing:.04em}
.gr-hsc-card{
  border-radius:14px;padding:10px 10px 11px;overflow:hidden;
  border:1px solid rgba(92,64,36,.65);
  background:
    linear-gradient(180deg,rgba(255,236,200,.07),transparent 28%),
    repeating-linear-gradient(90deg,rgba(60,38,20,.18) 0 1px,transparent 1px 7px),
    linear-gradient(145deg,#5a3d24 0%,#3d2816 42%,#2a1a0f 100%);
  box-shadow:inset 0 1px 0 rgba(255,220,170,.18),inset 0 -1px 0 rgba(0,0,0,.35),0 10px 22px rgba(0,0,0,.28);
}
.gr-hsc-nameplate{display:flex;align-items:center;gap:8px;min-width:0;margin-bottom:8px;padding:0 2px}
.gr-hsc-nameplate strong{
  flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-family:var(--font-display,Cormorant Garamond,Georgia,serif);font-size:var(--fs-subtitle);font-weight:700;
  color:#f3e2c4;text-shadow:0 1px 0 rgba(0,0,0,.45);letter-spacing:.01em;
}
.gr-hsc-chips{display:flex;flex-wrap:nowrap;gap:5px;margin-left:auto;flex:0 0 auto}
.gr-hsc-chip{
  display:inline-flex;align-items:center;gap:3px;padding:3px 7px;border-radius:999px;
  background:rgba(20,12,6,.45);border:1px solid rgba(212,175,106,.35);color:#f0e0c4;
  font-size:var(--fs-data);font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1;
}
.gr-hsc-chip em{font-style:normal;color:#d4af6a;font-size:10px;letter-spacing:.06em;font-weight:900}
.gr-hsc-paper{
  border-radius:8px;overflow:hidden;
  border:1px solid rgba(70,48,28,.55);
  background:
    linear-gradient(180deg,rgba(255,248,230,.92),rgba(236,220,188,.9)),
    repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(120,90,50,.08) 28px);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.35),0 1px 0 rgba(0,0,0,.2);
}
.gr-hsc-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;padding:6px 6px 7px}
.gr-hsc-nine{display:inline-block;min-width:min(100%,440px);margin-right:10px;vertical-align:top}
.gr-hsc-nine:last-child{margin-right:0}
.gr-hsc-row{display:grid;gap:0;align-items:stretch;font-variant-numeric:tabular-nums;border-bottom:1px solid rgba(90,62,34,.22)}
.gr-hsc-row:last-child{border-bottom:0}
.gr-hsc-holes{background:linear-gradient(180deg,#6b4a2c,#4a311c);border-bottom-color:rgba(40,24,12,.5)}
.gr-hsc-holes .gr-hsc-label,.gr-hsc-holes .gr-hsc-cell{color:#f0ddb8;font-weight:900}
.gr-hsc-pars{background:rgba(120,90,50,.1)}
.gr-hsc-nets{background:rgba(80,110,90,.08)}
.gr-hsc-label{
  display:flex;align-items:center;padding:0 5px;font-size:10px;text-transform:uppercase;
  letter-spacing:.05em;font-weight:800;color:#6a4e32;border-right:1px solid rgba(90,62,34,.22);
}
.gr-hsc-holes .gr-hsc-label{border-right-color:rgba(255,220,170,.12);color:#e8d3a8}
.gr-hsc-cell{
  min-height:24px;display:grid;place-items:center;text-align:center;
  font-size:var(--fs-data);font-weight:800;line-height:1;color:#2a1c10;
  border-right:1px solid rgba(90,62,34,.14);padding:2px 1px;
}
.gr-hsc-cell:last-child{border-right:0}
.gr-hsc-num{font-weight:900}
.gr-hsc-par{color:#6a5538;font-weight:700}
.gr-hsc-tot{color:#5a4028;font-weight:900;background:rgba(120,90,50,.08)}
.gr-hsc-holes .gr-hsc-tot{background:rgba(0,0,0,.12);color:#f0ddb8}
.gr-hsc-score{position:relative;color:#1c140c}
.gr-hsc-score.birdie{box-shadow:inset 0 0 0 1.5px #2a1c10;border-radius:50%;margin:1px}
.gr-hsc-score.eagle{box-shadow:inset 0 0 0 1.5px #2a1c10,0 0 0 2px #efe2c4,0 0 0 3.5px #2a1c10;border-radius:50%;margin:1px}
.gr-hsc-score.bogey{box-shadow:inset 0 0 0 1.5px #2a1c10;border-radius:0;margin:1px}
.gr-hsc-score.double{box-shadow:inset 0 0 0 1.5px #2a1c10,0 0 0 2px #efe2c4,0 0 0 3.5px #2a1c10;border-radius:0;margin:1px}
.gr-hsc-score.worse{box-shadow:inset 0 0 0 1.5px #8a3020,0 0 0 2px #efe2c4,0 0 0 3.5px #8a3020;border-radius:0;margin:1px;color:#7a2818}
.gr-hsc-gross{display:block}
.gr-hsc-netcell{color:#3d5a48;font-weight:800}
.gr-hsc-empty{color:rgba(60,40,20,.28);font-weight:700}
@media(max-width:700px){
  .gr155-recap-grid{grid-template-columns:1fr}
  .gr155-recap-block{padding:11px}
  .gr155-recap-copy p{font-size:var(--fs-data)}
  .grstd-head,.grstd-row{grid-template-columns:minmax(0,1fr) 44px 54px 56px;column-gap:6px}
  .grstd-row{font-size:var(--fs-data)}
  .gr-mission-photo-thumb{width:78px;height:78px}
  .gr-hsc-card{padding:8px}
  .gr-hsc-cell{min-height:22px;font-size:var(--fs-data)}
  .gr-hsc-nameplate{gap:6px}
  .gr-hsc-chip{padding:2px 6px}
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
