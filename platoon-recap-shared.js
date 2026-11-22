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
  // 18Birdies SEO / share titles → keep the club name only.
  s=s.replace(/\s*\|\s*18Birdies\b[\s\S]*$/i,'').trim();
  s=s.replace(/\s+Playing at\b[\s\S]*$/i,'').trim();
  s=s.replace(/\s+Check out their scores\b[\s\S]*$/i,'').trim();
  s=s.replace(/\s+Golf Course Details(?:\s*&\s*Scorecard)?\b[\s\S]*$/i,'').trim();
  s=s.replace(/\s*[-–—]\s*\d+\s*Holes?\b[\s\S]*$/i,'').trim();
  s=s.replace(/\s*[-–—,]?\s*(Black|Blue|White|Gold|Red|Green|Championship|Forward|Member)\s+\d{3,5}\s*Yds?\b[\s\S]*$/i,'').trim();
  for(const token of ['...','…']){
    const i=s.indexOf(token);
    if(i>=0)s=s.slice(0,i).trim();
  }
  s=s.replace(/\s*\([^)]*$/,'').trim();
  s=s.replace(/\s+(?:dan itibaren|ücretsiz|fullbody|kuvvet|antrenman)\b.*$/i,'').trim();
  s=s.replace(/\s*\([^)]*(?:\.\.\.|…)[^)]*\)\s*/g,' ').replace(/\s*\?{2,}\s*$/,'').replace(/\s{2,}/g,' ').trim();
  return s||'Course TBD';
}

function binaryHoleStat(v){
  if(v===true||v===1||v==='1')return 1;
  if(v===false||v===0||v==='0')return 0;
  const x=String(v??'').trim().toLowerCase();
  if(x==='true'||x==='hit'||x==='yes')return 1;
  if(x==='false'||x==='miss'||x==='no')return 0;
  return null;
}

function cleanHoles(holes){
  const map=new Map();
  for(const h of (Array.isArray(holes)?holes:[])){
    const hole=Number(h?.hole);
    if(!Number.isInteger(hole)||hole<1||hole>18)continue;
    const fairway=binaryHoleStat(h?.fairway_hit??h?.fairway??h?.fw);
    const gir=binaryHoleStat(h?.gir??h?.gir_hit);
    const putts=finite(h?.putts)?Number(h.putts):null;
    map.set(hole,{
      hole,
      par:finite(h?.par)?Number(h.par):null,
      score:finite(h?.score)?Number(h.score):null,
      net:finite(h?.net)?Number(h.net):null,
      fairway,
      gir,
      putts
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

/** Strokes received on a hole. Prefer course SI when provided; else hole # as rank. */
function strokesOnHole(hcp,hole,siByHole=null){
  if(!finite(hcp)||Number(hcp)<=0||!Number.isInteger(hole))return 0;
  const h=Math.max(0,Math.floor(Number(hcp)));
  const full=Math.floor(h/18);
  const rem=h%18;
  let rank=hole;
  if(siByHole instanceof Map&&siByHole.has(hole)&&finite(siByHole.get(hole))){
    rank=Math.max(1,Math.min(18,Math.round(Number(siByHole.get(hole)))));
  }
  return full+(rank<=rem?1:0);
}
function holeNetValue(h,hcp,parByHole,siByHole=null){
  if(finite(h?.net))return Number(h.net);
  if(!finite(h?.score))return null;
  if(!finite(hcp))return null;
  return Number(h.score)-strokesOnHole(hcp,h.hole,siByHole);
}

function markCell(hit){
  if(hit===1)return`<div class="gr-hsc-cell gr-hsc-stat"><span class="gr-hsc-mark hit" title="Hit">●</span></div>`;
  if(hit===0)return`<div class="gr-hsc-cell gr-hsc-stat"><span class="gr-hsc-mark miss" title="Miss">○</span></div>`;
  return`<div class="gr-hsc-cell gr-hsc-empty">·</div>`;
}
function statHitRate(vals){
  const known=vals.filter(v=>v===0||v===1);
  if(!known.length)return null;
  const hits=known.filter(v=>v===1).length;
  return {hits,n:known.length,pct:Math.round(100*hits/known.length)};
}
function nineStripMarkup(holeNums,parByHole,playerHoleMap,{hcp=null,showNet=true,showStats=true,siByHole=null}={}){
  if(!holeNums.length)return'';
  const totalLabel=holeNums[0]<=9?'OUT':'IN';
  const row=(cls,label,cells,tot)=>`<div class="gr-hsc-row ${cls}"><div class="gr-hsc-label">${label}</div>${cells}<div class="gr-hsc-cell gr-hsc-tot">${tot}</div></div>`;
  const holeCells=holeNums.map(n=>`<div class="gr-hsc-cell gr-hsc-num">${n}</div>`).join('');
  const parCells=holeNums.map(n=>`<div class="gr-hsc-cell gr-hsc-par">${parByHole.has(n)?parByHole.get(n):'—'}</div>`).join('');
  const parSum=holeNums.reduce((s,n)=>s+(parByHole.has(n)?parByHole.get(n):0),0);
  const hasPar=holeNums.some(n=>parByHole.has(n));
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
      const nv=holeNetValue(h,hcp,parByHole,siByHole);
      if(!finite(nv))return`<div class="gr-hsc-cell gr-hsc-empty">·</div>`;
      return`<div class="gr-hsc-cell gr-hsc-netcell">${Number(nv)}</div>`;
    }).join('');
    const netVals=holeNums.map(n=>holeNetValue(playerHoleMap.get(n),hcp,parByHole,siByHole));
    const known=netVals.filter(finite);
    const netSum=known.length===holeNums.length?known.reduce((s,v)=>s+Number(v),0):(known.length?known.reduce((s,v)=>s+Number(v),0):null);
    netRow=row('gr-hsc-nets','NET',netCells,netSum!=null?netSum:'·');
  }
  let statsRows='';
  if(showStats){
    const fwVals=holeNums.map(n=>{
      const h=playerHoleMap.get(n);
      const par=h?.par??parByHole.get(n);
      if(Number(par)===3)return null; // FIR N/A on par 3
      return h?.fairway??null;
    });
    const girVals=holeNums.map(n=>playerHoleMap.get(n)?.gir??null);
    const puttVals=holeNums.map(n=>playerHoleMap.get(n)?.putts);
    const hasFw=fwVals.some(v=>v===0||v===1);
    const hasGir=girVals.some(v=>v===0||v===1);
    const hasPutts=puttVals.some(finite);
    if(hasFw){
      const rate=statHitRate(fwVals);
      const cells=fwVals.map((v,i)=>{
        const par=playerHoleMap.get(holeNums[i])?.par??parByHole.get(holeNums[i]);
        if(Number(par)===3)return`<div class="gr-hsc-cell gr-hsc-empty">—</div>`;
        return markCell(v);
      }).join('');
      statsRows+=row('gr-hsc-stats gr-hsc-fw','FIR',cells,rate?`${rate.hits}/${rate.n}`:'·');
    }
    if(hasGir){
      const rate=statHitRate(girVals);
      const cells=girVals.map(v=>markCell(v)).join('');
      statsRows+=row('gr-hsc-stats gr-hsc-gir','GIR',cells,rate?`${rate.hits}/${rate.n}`:'·');
    }
    if(hasPutts){
      const cells=puttVals.map(v=>{
        if(!finite(v))return`<div class="gr-hsc-cell gr-hsc-empty">·</div>`;
        return`<div class="gr-hsc-cell gr-hsc-putt">${Number(v)}</div>`;
      }).join('');
      const known=puttVals.filter(finite);
      const puttSum=known.length===holeNums.length?known.reduce((s,v)=>s+Number(v),0):(known.length?known.reduce((s,v)=>s+Number(v),0):null);
      statsRows+=row('gr-hsc-stats gr-hsc-putts','PUTTS',cells,puttSum!=null?puttSum:'·');
    }
  }
  return `<div class="gr-hsc-nine" style="--hsc-cols:${holeNums.length}" aria-label="${totalLabel} nine">
    ${row('gr-hsc-holes','HOLE',holeCells,totalLabel)}
    ${row('gr-hsc-pars','PAR',parCells,hasPar?parSum:'·')}
    ${row('gr-hsc-scores','GROSS',grossCells,grossSum!=null?grossSum:'·')}
    ${netRow}
    ${statsRows}
  </div>`;
}

function holeScoreboardMarkup(p,m,detail){
  const frame=missionHoleFrame(detail);
  if(!frame)return'';
  // Always mount a full 18-hole plaque; missing holes stay blank (·).
  const front=[1,2,3,4,5,6,7,8,9];
  const back=[10,11,12,13,14,15,16,17,18];
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
      nineStripMarkup(front,frame.parByHole,map,{hcp,showNet}),
      nineStripMarkup(back,frame.parByHole,map,{hcp,showNet})
    ].join('');
    return `<article class="gr-hsc-card">
      <div class="gr-hsc-plate">
        <header class="gr-hsc-nameplate"><strong>${esc(name)}</strong><div class="gr-hsc-chips">${chips}</div></header>
        <div class="gr-hsc-plate-face"><div class="gr-hsc-scroll">${strips}</div></div>
      </div>
    </article>`;
  }).join('');
  return `<section class="gr-hsc-board"><div class="gr-hsc-board-head"><div class="gr155-recap-title">SCORECARD</div><span class="gr-hsc-legend">○ birdie · □ bogey · ● hit · ○ miss</span></div>${cards}</section>`;
}

/** Plaque scorecard for a personal round (scores + FIR/GIR/putts). */
function personalRoundScorecardMarkup(opts={}){
  const holeNumbers=Array.isArray(opts.holeNumbers)&&opts.holeNumbers.length
    ? opts.holeNumbers.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=18)
    : Array.from({length:18},(_,i)=>i+1);
  const pars=Array.isArray(opts.pars)?opts.pars:[];
  const scores=Array.isArray(opts.scores)?opts.scores:[];
  const fairways=Array.isArray(opts.fairways)?opts.fairways:[];
  const gir=Array.isArray(opts.gir)?opts.gir:[];
  const putts=Array.isArray(opts.putts)?opts.putts:[];
  const parByHole=new Map();
  const map=new Map();
  holeNumbers.forEach((n,i)=>{
    if(finite(pars[i]))parByHole.set(n,Number(pars[i]));
    map.set(n,{
      hole:n,
      par:finite(pars[i])?Number(pars[i]):null,
      score:finite(scores[i])?Number(scores[i]):null,
      net:null,
      fairway:binaryHoleStat(fairways[i]),
      gir:binaryHoleStat(gir[i]),
      putts:finite(putts[i])?Number(putts[i]):null
    });
  });
  const front=[1,2,3,4,5,6,7,8,9].filter(n=>holeNumbers.includes(n));
  const back=[10,11,12,13,14,15,16,17,18].filter(n=>holeNumbers.includes(n));
  const isNine=Number(opts.holes)===9 || (holeNumbers.length<=9 && !holeNumbers.some(n=>n>=10));
  // 18-hole rounds always get Out+In (blanks stay ·). Nine-hole rounds show only the played side.
  const useFront=front.length?front:(isNine&&back.length?[]:[1,2,3,4,5,6,7,8,9]);
  const useBack=back.length?back:(isNine?[]:[10,11,12,13,14,15,16,17,18]);
  const name=String(opts.playerName||opts.name||'Round').trim()||'Round';
  const gross=finite(opts.gross)?Number(opts.gross):null;
  const net=finite(opts.net)?Number(opts.net):null;
  const hcpExplicit=finite(opts.handicap??opts.hcp)?Number(opts.handicap??opts.hcp):null;
  // Personal rounds often store round net without course handicap — derive strokes from G−N.
  const hcp=hcpExplicit!=null?hcpExplicit:(gross!=null&&net!=null?Math.max(0,Math.round(gross-net)):null);
  const siByHole=new Map();
  const siList=Array.isArray(opts.handicaps)?opts.handicaps:[];
  holeNumbers.forEach((n,i)=>{if(finite(siList[i]))siByHole.set(n,Number(siList[i]));});
  const showNet=net!=null||hcp!=null||[...map.values()].some(h=>finite(h.net));
  const fwRate=statHitRate(holeNumbers.map(n=>map.get(n)?.fairway));
  const girRate=statHitRate(holeNumbers.map(n=>map.get(n)?.gir));
  const puttKnown=holeNumbers.map(n=>map.get(n)?.putts).filter(finite);
  const puttSum=puttKnown.length?puttKnown.reduce((s,v)=>s+Number(v),0):null;
  const chips=[
    gross!=null?`<span class="gr-hsc-chip"><em>G</em>${gross}</span>`:'',
    net!=null?`<span class="gr-hsc-chip"><em>N</em>${net}</span>`:'',
    hcp!=null?`<span class="gr-hsc-chip"><em>H</em>${hcp}</span>`:'',
    fwRate?`<span class="gr-hsc-chip"><em>FIR</em>${fwRate.hits}/${fwRate.n}</span>`:'',
    girRate?`<span class="gr-hsc-chip"><em>GIR</em>${girRate.hits}/${girRate.n}</span>`:'',
    puttSum!=null?`<span class="gr-hsc-chip"><em>P</em>${puttSum}</span>`:''
  ].filter(Boolean).join('');
  const sub=[opts.courseName,opts.date,opts.tees?`${opts.tees} tees`:''].filter(Boolean).map(esc).join(' · ');
  const stripOpts={hcp,showNet,showStats:true,siByHole:siByHole.size?siByHole:null};
  const strips=[
    nineStripMarkup(useFront,parByHole,map,stripOpts),
    useBack.length?nineStripMarkup(useBack,parByHole,map,stripOpts):''
  ].join('');
  return `<section class="gr-hsc-board gr-hsc-personal"><div class="gr-hsc-board-head"><div class="gr155-recap-title">SCORECARD</div><span class="gr-hsc-legend">○ birdie · □ bogey · ● hit · ○ miss</span></div>
    <article class="gr-hsc-card">
      <div class="gr-hsc-plate">
        <header class="gr-hsc-nameplate"><strong>${esc(name)}</strong><div class="gr-hsc-chips">${chips}</div></header>
        ${sub?`<div class="gr-hsc-sub">${sub}</div>`:''}
        <div class="gr-hsc-plate-face"><div class="gr-hsc-scroll">${strips}</div></div>
      </div>
    </article>
  </section>`;
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
  let s=document.getElementById('grSharedRecapStyles');
  if(!s){s=document.createElement('style');s.id='grSharedRecapStyles';document.head.appendChild(s)}
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
.gr-hsc-board{margin-top:12px;display:grid;gap:12px}
.gr-hsc-board-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:0 2px}
.gr-hsc-board-head .gr155-recap-title{margin:0}
.gr-hsc-legend{font-size:var(--fs-data);color:#b8a78a;font-weight:700;letter-spacing:.04em}

/* Clubhouse trophy plaque — thin walnut frame, antique brass, parchment card */
.gr-hsc-card{
  --walnut-hi:#6b4a2e;
  --walnut-mid:#3d2718;
  --walnut-lo:#1c110a;
  --brass:#9a7a45;
  --brass-hi:#c4a66a;
  --brass-lo:#6e552c;
  --ink:#2a1c12;
  --parchment:#f3ecdd;
  --mark:#3a2a18;
  --hsc-serif:Georgia,'Times New Roman',Times,serif;
  position:relative;border-radius:5px;padding:9px 8px 8px;overflow:hidden;
  border:1px solid #2a1a10;
  background:
    radial-gradient(circle at 18% 12%,rgba(120,80,45,.22),transparent 28%),
    radial-gradient(circle at 82% 88%,rgba(20,10,4,.35),transparent 32%),
    repeating-linear-gradient(92deg,rgba(255,220,170,.045) 0 1px,transparent 1px 7px),
    repeating-linear-gradient(0deg,rgba(12,6,2,.16) 0 1px,transparent 1px 6px),
    linear-gradient(145deg,var(--walnut-hi) 0%,var(--walnut-mid) 42%,#2a1a10 78%,var(--walnut-lo) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,230,190,.14),
    inset 0 -1px 0 rgba(0,0,0,.45),
    inset 0 0 0 1px rgba(160,120,70,.18),
    0 1px 0 rgba(255,220,170,.06),
    0 10px 22px rgba(0,0,0,.38);
}
/* Beveled walnut lip */
.gr-hsc-card::before{
  content:"";position:absolute;inset:3px;border-radius:3px;pointer-events:none;z-index:0;
  border:1px solid rgba(0,0,0,.35);
  box-shadow:
    inset 0 1px 0 rgba(255,220,170,.1),
    inset 0 -1px 0 rgba(0,0,0,.35),
    inset 1px 0 0 rgba(255,220,170,.05),
    inset -1px 0 0 rgba(0,0,0,.25);
}
/* Antique-brass corner screws on the wood frame */
.gr-hsc-card::after{
  content:"";position:absolute;inset:0;pointer-events:none;z-index:3;
  background:
    radial-gradient(circle at 32% 28%,#e8d6a8 0 18%,#b08a48 42%,#6a4e28 70%,#2a1a0c 100%) 5px 5px / 6px 6px no-repeat,
    radial-gradient(circle at 32% 28%,#e8d6a8 0 18%,#b08a48 42%,#6a4e28 70%,#2a1a0c 100%) calc(100% - 5px) 5px / 6px 6px no-repeat,
    radial-gradient(circle at 32% 28%,#e8d6a8 0 18%,#b08a48 42%,#6a4e28 70%,#2a1a0c 100%) 5px calc(100% - 5px) / 6px 6px no-repeat,
    radial-gradient(circle at 32% 28%,#e8d6a8 0 18%,#b08a48 42%,#6a4e28 70%,#2a1a0c 100%) calc(100% - 5px) calc(100% - 5px) / 6px 6px no-repeat;
  opacity:.95;
}
/* Dark walnut well + thin antique-brass accent (not a wide gold plate) */
.gr-hsc-plate{
  position:relative;z-index:1;border-radius:2px;padding:6px 5px 5px;
  border:1px solid var(--brass-lo);
  background:
    linear-gradient(180deg,rgba(255,220,170,.05),transparent 35%),
    linear-gradient(145deg,#4a3220 0%,#2c1a10 48%,#160e08 100%);
  box-shadow:
    inset 0 0 0 1px rgba(154,122,69,.4),
    inset 0 1px 0 rgba(255,220,170,.08),
    inset 0 -1px 0 rgba(0,0,0,.4),
    0 1px 0 rgba(0,0,0,.35);
}
/* Smooth blackened brass / dark bronze header — no dotted texture */
.gr-hsc-nameplate{
  display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;min-width:0;
  margin:0 1px 6px;padding:7px 8px;
  border-radius:2px;
  background:
    linear-gradient(180deg,rgba(196,166,106,.1),transparent 42%),
    linear-gradient(180deg,#2a2218 0%,#16120e 48%,#0a0806 100%);
  border:1px solid var(--brass);
  box-shadow:
    inset 0 1px 0 rgba(212,184,120,.12),
    inset 0 -1px 0 rgba(0,0,0,.55),
    0 1px 0 rgba(0,0,0,.25);
}
.gr-hsc-nameplate strong{
  flex:1 1 12rem;min-width:0;
  overflow:visible;text-overflow:unset;white-space:normal;
  font-family:var(--font-display,Cormorant Garamond,Georgia,serif);
  font-size:var(--fs-subtitle);font-weight:700;line-height:1.2;
  color:#d4b878;letter-spacing:.1em;text-transform:uppercase;
  text-shadow:0 1px 0 rgba(0,0,0,.85);
}
.gr-hsc-chips{
  display:flex;flex-wrap:wrap;gap:4px;
  margin-left:0;flex:1 1 auto;justify-content:flex-start;
}
@media(min-width:701px){
  .gr-hsc-chips{margin-left:auto;flex:0 1 auto;justify-content:flex-end}
}
.gr-hsc-chip{
  display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:2px;
  background:rgba(0,0,0,.42);border:1px solid rgba(154,122,69,.85);color:#d4b878;
  font-size:var(--fs-data);font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1;
  font-family:var(--font-display,Cormorant Garamond,Georgia,serif);
}
.gr-hsc-chip em{font-style:normal;color:#b08a48;font-size:10px;letter-spacing:.06em;font-weight:900}
.gr-hsc-sub{
  margin:-1px 4px 6px;padding:0 2px;
  font-family:var(--hsc-serif);
  font-size:var(--fs-data);color:#c4b49a;font-weight:600;letter-spacing:.02em;opacity:.92;
}
.gr-hsc-plate-face{
  position:relative;border-radius:1px;overflow:hidden;
  border:1px solid rgba(154,122,69,.55);
  background:
    linear-gradient(180deg,rgba(255,255,255,.28),transparent 22%),
    repeating-linear-gradient(0deg,rgba(90,70,40,.025) 0 1px,transparent 1px 3px),
    linear-gradient(180deg,#f6f0e3,#efe6d2 58%,#e7dcc6);
  box-shadow:
    inset 0 0 0 1px rgba(255,252,245,.45),
    inset 0 3px 8px rgba(40,25,10,.16),
    inset 0 -1px 0 rgba(255,255,255,.2),
    0 0 0 1px rgba(80,55,25,.25);
}
.gr-hsc-scroll{
  position:relative;
  display:flex;flex-direction:column;gap:6px;
  overflow-x:auto;-webkit-overflow-scrolling:touch;padding:4px 3px 5px;
  scrollbar-width:thin;
}
/* Subtle cue when a nine strip still overflows */
.gr-hsc-plate-face::after{
  content:"";position:absolute;top:0;right:0;bottom:0;width:18px;pointer-events:none;z-index:2;
  background:linear-gradient(90deg,transparent,rgba(243,236,221,.92));
  opacity:0;transition:opacity .15s ease;
}
.gr-hsc-plate-face.is-scrollable::after{opacity:1}
.gr-hsc-nine{
  display:block;width:100%;
  min-width:0;
  --hsc-label:34px;
  --hsc-tot:30px;
  --hsc-cols:9;
}
.gr-hsc-row{
  display:grid;
  grid-template-columns:var(--hsc-label) repeat(var(--hsc-cols),minmax(0,1fr)) var(--hsc-tot);
  gap:0;align-items:stretch;font-variant-numeric:tabular-nums;
  border-bottom:1px solid rgba(58,42,24,.28);
  font-family:var(--hsc-serif);
}
.gr-hsc-row:last-child{border-bottom:0}
.gr-hsc-holes{
  background:linear-gradient(180deg,#2a2116,#18140e);
  border-bottom-color:rgba(30,20,12,.5);
}
.gr-hsc-holes .gr-hsc-label,.gr-hsc-holes .gr-hsc-cell{color:#d4b878;font-weight:700}
.gr-hsc-pars{background:rgba(90,70,40,.06)}
.gr-hsc-nets{background:rgba(30,70,45,.05)}
.gr-hsc-label{
  display:flex;align-items:center;padding:0 3px;font-size:9px;text-transform:uppercase;
  letter-spacing:.06em;font-weight:700;color:#6a5230;border-right:1px solid rgba(58,42,24,.28);
  font-family:var(--hsc-serif);
}
.gr-hsc-holes .gr-hsc-label{border-right-color:rgba(212,184,120,.14);color:#d4b878}
.gr-hsc-cell{
  min-height:22px;display:grid;place-items:center;text-align:center;
  font-size:var(--fs-data);font-weight:600;line-height:1;color:var(--ink);
  border-right:1px solid rgba(58,42,24,.22);padding:1px 0;
  font-family:var(--hsc-serif);
}
.gr-hsc-cell:last-child{border-right:0}
.gr-hsc-num{font-weight:700}
.gr-hsc-par{color:#3a2a18;font-weight:700}
.gr-hsc-tot{color:#4a3820;font-weight:700;background:rgba(90,70,40,.08)}
.gr-hsc-holes .gr-hsc-tot{background:rgba(0,0,0,.28);color:#d4b878}
.gr-hsc-score{position:relative;color:var(--ink);background:transparent;box-shadow:none;border-radius:0;margin:0}
/* Traditional paper-card marks tightly around the gross numeral */
.gr-hsc-gross{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:1.15em;min-height:1.15em;padding:0 .04em;
  font-family:var(--hsc-serif);
  font-size:calc(var(--fs-data) + 2px);font-weight:700;line-height:1;color:var(--ink);
  box-sizing:border-box;
}
.gr-hsc-score.birdie .gr-hsc-gross{
  border:1.15px solid var(--mark);border-radius:50%;
}
.gr-hsc-score.eagle .gr-hsc-gross{
  border:1.15px solid var(--mark);border-radius:50%;
  box-shadow:0 0 0 1.6px var(--parchment),0 0 0 2.75px var(--mark);
}
.gr-hsc-score.bogey .gr-hsc-gross{
  border:1.15px solid var(--mark);border-radius:0;
}
.gr-hsc-score.double .gr-hsc-gross,
.gr-hsc-score.worse .gr-hsc-gross{
  border:1.15px solid var(--mark);border-radius:0;
  box-shadow:0 0 0 1.6px var(--parchment),0 0 0 2.75px var(--mark);
}
.gr-hsc-netcell{color:#1a4f34;font-weight:700;font-family:var(--hsc-serif)}
.gr-hsc-nets .gr-hsc-tot{color:#1a4f34}
.gr-hsc-empty{color:rgba(60,40,20,.28);font-weight:700}
.gr-hsc-stats{background:rgba(70,55,30,.035)}
.gr-hsc-stats .gr-hsc-label{font-size:8px;letter-spacing:.05em}
.gr-hsc-mark{display:inline-block;font-size:10px;line-height:1;font-weight:900}
.gr-hsc-mark.hit{color:#1a4f34}
.gr-hsc-mark.miss{color:#6a5230;opacity:.75}
.gr-hsc-putt{color:var(--ink);font-weight:700;font-family:var(--hsc-serif)}
.gr-hsc-personal{margin-top:0}
@media(max-width:700px){
  .gr155-recap-grid{grid-template-columns:1fr}
  .gr155-recap-block{padding:11px}
  .gr155-recap-copy p{font-size:var(--fs-data)}
  .grstd-head,.grstd-row{grid-template-columns:minmax(0,1fr) 44px 54px 56px;column-gap:6px}
  .grstd-row{font-size:var(--fs-data)}
  .gr-mission-photo-thumb{width:78px;height:78px}
  .gr-hsc-card{padding:7px 6px 6px}
  .gr-hsc-plate{padding:5px 4px 4px}
  .gr-hsc-nine{--hsc-label:28px;--hsc-tot:26px}
  .gr-hsc-cell{min-height:20px;font-size:11px}
  .gr-hsc-label{font-size:8px;padding:0 2px}
  .gr-hsc-nameplate{gap:5px;margin:0 0 5px;padding:6px 7px}
  .gr-hsc-nameplate strong{flex-basis:100%;letter-spacing:.08em;font-size:calc(var(--fs-subtitle) - 1px)}
  .gr-hsc-chips{flex-basis:100%;margin-left:0}
  .gr-hsc-chip{padding:2px 5px}
  .gr-hsc-gross{font-size:calc(var(--fs-data) + 1px);min-width:1.1em;min-height:1.1em}
  .gr-hsc-scroll{padding:3px 2px 4px}
}
@media(max-width:400px){
  .gr-hsc-nine{--hsc-label:24px;--hsc-tot:22px}
  .gr-hsc-cell{font-size:10px;min-height:19px}
  .gr-hsc-gross{font-size:11px}
}
`;
}
installStyles();

/** Fade cue when a scorecard strip still has columns off-screen. */
function syncScorecardScrollHints(root){
  const scope=root||(typeof document!=='undefined'?document:null);
  if(!scope||typeof scope.querySelectorAll!=='function')return;
  scope.querySelectorAll('.gr-hsc-scroll').forEach(el=>{
    const face=el.closest('.gr-hsc-plate-face');
    if(!face)return;
    const sync=()=>{
      const overflow=el.scrollWidth>el.clientWidth+1;
      const moreRight=overflow&&(el.scrollLeft+el.clientWidth<el.scrollWidth-2);
      face.classList.toggle('is-scrollable',moreRight);
    };
    if(!el.dataset.grHscBound){
      el.dataset.grHscBound='1';
      el.addEventListener('scroll',sync,{passive:true});
    }
    sync();
  });
}
function watchScorecardScroll(){
  if(typeof window==='undefined'||typeof document==='undefined')return;
  if(window.__grHscScrollWatch)return;
  window.__grHscScrollWatch=true;
  const run=()=>syncScorecardScrollHints();
  if(typeof MutationObserver==='function'&&document.documentElement){
    new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
  }
  if(typeof window.addEventListener==='function')window.addEventListener('resize',run,{passive:true});
  run();
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchScorecardScroll);
  else watchScorecardScroll();
}

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
window.grPersonalRoundScorecardMarkup=personalRoundScorecardMarkup;
window.grSyncScorecardScrollHints=syncScorecardScrollHints;
window.grSharedRecapReady=true;
})();
