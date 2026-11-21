(()=>{
'use strict';

/**
 * Phase 2 — authoritative Mission data processing.
 * Rendering stays in platoon-recap-shared.js (Phase 1).
 * Official saved Mission results always take precedence over derived data.
 */

const finite=v=>typeof window.grFinite==='function'?window.grFinite(v):(v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v)));
const cleanCourse=v=>typeof window.grCleanCourseName==='function'?window.grCleanCourseName(v):(String(v||'').trim()||'Course TBD');
const canon=(p,raw)=>typeof window.grCanonicalMember==='function'?window.grCanonicalMember(p,raw):null;
const clone=v=>{try{return JSON.parse(JSON.stringify(v))}catch{return null}};

function uid(prefix){
  return `${prefix||'mission'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}

function findMission(p,id){
  return (p?.missions||[]).find(m=>String(m.id)===String(id))||null;
}

function cleanHoles(holes){
  const map=new Map();
  for(const h of (Array.isArray(holes)?holes:[])){
    const hole=Number(h?.hole);
    if(!Number.isInteger(hole)||hole<1||hole>18)continue;
    const row={
      hole,
      par:finite(h?.par)?Number(h.par):null,
      score:finite(h?.score)?Number(h.score):null
    };
    // Preserve richer scorecard fields when present (personal merge / later OCR).
    for(const key of ['putts','fairway_hit','gir','chips','sand','penalties','fairway_direction','gir_direction','first_putt_distance_ft']){
      if(h?.[key]!=null&&h[key]!=='')row[key]=h[key];
    }
    map.set(hole,row);
  }
  return [...map.values()].sort((a,b)=>a.hole-b.hole);
}

/** Union holes by number; keep existing non-empty values, fill blanks from incoming. */
function mergeHolesRich(existing,incoming){
  const map=new Map();
  for(const h of cleanHoles(existing))map.set(h.hole,{...h});
  for(const h of cleanHoles(incoming)){
    const prev=map.get(h.hole)||{hole:h.hole};
    const next={...prev};
    for(const [k,v] of Object.entries(h)){
      if(k==='hole')continue;
      if(v==null||v==='')continue;
      if(next[k]==null||next[k]==='')next[k]=v;
    }
    map.set(h.hole,next);
  }
  return [...map.values()].sort((a,b)=>a.hole-b.hole);
}

function resultMatchKey(r,p){
  const member=r?.hole_detail_canonical_id
    ? (p?.members||[]).find(m=>String(m.id)===String(r.hole_detail_canonical_id))
    : canon(p,r?.player_name);
  if(member?.id)return `id:${member.id}`;
  return `name:${String(r?.player_name||'').trim().toLowerCase()}`;
}

/** Normalize one official result row. Never invents missing scores. */
function normalizeOfficialResultRow(r){
  const holes=Array.isArray(r?.holes)?cleanHoles(r.holes):[];
  let eagleCount=finite(r?.eagle_count)?Number(r.eagle_count):null;
  // Prefer explicit eagle_count; otherwise derive from hole scores when available.
  if(eagleCount==null&&holes.length){
    const derived=holes.filter(h=>finite(h.par)&&finite(h.score)&&h.score<=h.par-2).length;
    if(derived>0)eagleCount=derived;
  }
  const row={
    player_name:String(r?.player_name||'').trim()||'Player',
    handicap:finite(r?.handicap)?Number(r.handicap):null,
    gross:finite(r?.gross)?Number(r.gross):null,
    net:finite(r?.net)?Number(r.net):null,
    finish_position:finite(r?.finish_position)?Number(r.finish_position):null,
    raw_points:finite(r?.raw_points)?Number(r.raw_points):null,
    eagle_count:eagleCount
  };
  // Preserve supplemental hole detail if already attached to an official row.
  if(holes.length)row.holes=holes;
  if(r?.hole_detail_saved_at)row.hole_detail_saved_at=r.hole_detail_saved_at;
  if(r?.hole_detail_source_name)row.hole_detail_source_name=r.hole_detail_source_name;
  if(r?.hole_detail_canonical_id)row.hole_detail_canonical_id=r.hole_detail_canonical_id;
  return row;
}

function normalizeOfficialResults(rows){
  return (Array.isArray(rows)?rows:[]).map(normalizeOfficialResultRow);
}

/**
 * Prepare + validate Mission create/edit payload.
 * Preserves existing id, status, results, and war linkage notes composition is left to caller when using composeNotes.
 */
function prepareMissionDraft(input,opts={}){
  const existing=opts.existing||null;
  const title=String(input?.title||'').trim()||(existing?.title||'Mission');
  const date=String(input?.date||'').trim();
  if(!date)return {ok:false,error:'Choose a Mission date.'};
  const rawCourse=String(input?.locationName||'').trim();
  const locationName=cleanCourse(rawCourse||existing?.locationName||'');
  if(!locationName||locationName==='Course TBD'&&!rawCourse&&!existing?.locationName){
    return {ok:false,error:'Choose a course or enter a location.'};
  }
  const participants=Array.isArray(input?.participants)?[...new Set(input.participants.map(String))]:(existing?.participants||[]);
  const mission={
    id:existing?.id||input?.id||uid('mission'),
    date,
    teeTime:String(input?.teeTime||existing?.teeTime||'').slice(0,5),
    type:input?.type||existing?.type||'battle',
    courseId:input?.courseId!=null?String(input.courseId): (existing?.courseId||''),
    locationName,
    title,
    format:String(input?.format||existing?.format||'').trim(),
    notes:input?.notes!=null?String(input.notes):String(existing?.notes||''),
    participants,
    status:existing?.status||input?.status||'planned',
    // Official results are never dropped or recalculated by create/edit.
    results:Array.isArray(existing?.results)?clone(existing.results):(Array.isArray(input?.results)?normalizeOfficialResults(input.results):[])
  };
  if(existing?.recap_note!=null)mission.recap_note=existing.recap_note;
  if(input?.recap_note!=null)mission.recap_note=String(input.recap_note);
  if(Array.isArray(existing?.guests))mission.guests=clone(existing.guests);
  if(Array.isArray(input?.guests))mission.guests=input.guests.map(g=>String(g||'').trim()).filter(Boolean);
  else if(!Array.isArray(mission.guests)){
    // Recover guests embedded in notes when the array field was never set.
    const hit=String(mission.notes||'').match(/\[\[GR_GUESTS:([\s\S]*?)\]\]/);
    if(hit){
      try{mission.guests=(JSON.parse(hit[1])||[]).map(g=>String(g||'').trim()).filter(Boolean)}catch{mission.guests=[]}
    }else mission.guests=[];
  }
  const cleanPhotos=arr=>(Array.isArray(arr)?arr:[]).filter(x=>x&&x.dataUrl).slice(0,3);
  if(Array.isArray(existing?.photos))mission.photos=cleanPhotos(existing.photos);
  if(Array.isArray(input?.photos))mission.photos=cleanPhotos(input.photos);
  else if(!Array.isArray(mission.photos))mission.photos=cleanPhotos(existing?.photos);
  // league_points: true/undefined = count toward My Time ⛳; false = exclude
  if(input?.league_points!=null)mission.league_points=!!input.league_points;
  else if(existing?.league_points!=null)mission.league_points=!!existing.league_points;
  else mission.league_points=true;
  return {ok:true,mission};
}

/** Whether a completed Mission feeds the My Time ⛳ Points cup. Default include. */
function countsForLeaguePoints(m){
  if(!m||m.type==='war'||m.status!=='completed')return false;
  return m.league_points!==false;
}

/** Upsert mission into platoon snapshot without changing other missions' ids. */
function upsertMission(p,mission){
  if(!p||!mission?.id)return {ok:false,error:'Mission payload missing.'};
  p.missions=Array.isArray(p.missions)?p.missions:[];
  const idx=p.missions.findIndex(m=>String(m.id)===String(mission.id));
  if(idx>=0){
    const prev=p.missions[idx];
    // Keep official results unless the caller explicitly provided a results array on mission.
    const next={...prev,...mission};
    if(!Array.isArray(mission.results))next.results=Array.isArray(prev.results)?prev.results:[];
    p.missions[idx]=next;
  }else{
    p.missions.push(mission);
  }
  return {ok:true,mission:findMission(p,mission.id)};
}

/**
 * Set official Mission results. This is the only path that replaces standings inputs.
 * Does not recompute finish/points from holes.
 * Preserves previously attached hole detail when the same player is still present.
 */
function setOfficialResults(mission,rows,{markCompleted=true,platoon=null}={}){
  if(!mission)return {ok:false,error:'Mission not found.'};
  const prev=Array.isArray(mission.results)?mission.results:[];
  const prevByKey=new Map(prev.map(r=>[resultMatchKey(r,platoon),r]));
  const normalized=normalizeOfficialResults(rows).map(row=>{
    const prior=prevByKey.get(resultMatchKey(row,platoon));
    if(!prior)return row;
    if(Array.isArray(prior.holes)&&prior.holes.length){
      row.holes=mergeHolesRich(prior.holes,row.holes||[]);
      if(prior.hole_detail_saved_at)row.hole_detail_saved_at=prior.hole_detail_saved_at;
      if(prior.hole_detail_source_name)row.hole_detail_source_name=prior.hole_detail_source_name;
      if(prior.hole_detail_canonical_id)row.hole_detail_canonical_id=prior.hole_detail_canonical_id;
    }
    if(prior.scorecard_seed&&typeof prior.scorecard_seed==='object')row.scorecard_seed=clone(prior.scorecard_seed);
    if(prior.personal_round_id)row.personal_round_id=prior.personal_round_id;
    return row;
  });
  mission.results=normalized;
  if(markCompleted)mission.status='completed';
  return {ok:true,mission,results:normalized};
}

/** Snapshot official results for hole-detail merge (deep clone). */
function lockOfficialResults(mission){
  return clone(Array.isArray(mission?.results)?mission.results:[])||[];
}

/**
 * Attach hole-by-hole detail onto locked official rows.
 * Never changes gross, net, finish_position, or raw_points.
 */
function mergeHoleDetailsOntoOfficial(lockedResults,groups,p){
  const locked=Array.isArray(lockedResults)?lockedResults:[];
  let saved=0;
  for(const g of (groups||[])){
    const member=g?.member;if(!member?.id)continue;
    const holes=cleanHoles(g.holes);if(!holes.length)continue;
    const target=locked.find(r=>canon(p,r.player_name)?.id===member.id);
    if(!target)continue;
    for(const other of locked){
      if(other!==target&&other.hole_detail_canonical_id===member.id){
        delete other.holes;
        delete other.hole_detail_saved_at;
        delete other.hole_detail_source_name;
        delete other.hole_detail_canonical_id;
      }
    }
    // Official scoring fields stay as they were on the locked snapshot.
    const gross=target.gross,net=target.net,finish=target.finish_position,pts=target.raw_points,eagles=target.eagle_count,name=target.player_name;
    target.holes=mergeHolesRich(target.holes||[],holes);
    target.hole_detail_saved_at=new Date().toISOString();
    target.hole_detail_source_name=[...new Set((g.raw||[]).filter(Boolean))].join(' + ');
    target.hole_detail_canonical_id=member.id;
    target.player_name=name;
    target.gross=gross;
    target.net=net;
    target.finish_position=finish;
    target.raw_points=pts;
    target.eagle_count=eagles;
    saved++;
  }
  return {ok:saved>0,saved,results:locked};
}

function missionRoundFingerprint(mission,memberId,gross){
  return [
    String(mission?.id||''),
    String(memberId||''),
    String(mission?.date||''),
    String(mission?.locationName||'').trim().toLowerCase(),
    gross??''
  ].join('|');
}

/** Attach claimable scorecard seeds onto mission result rows (for personal DB merge). */
function attachScorecardSeeds(mission,p){
  if(!mission||!Array.isArray(mission.results))return mission;
  for(const r of mission.results){
    const member=r.hole_detail_canonical_id
      ? (p?.members||[]).find(m=>String(m.id)===String(r.hole_detail_canonical_id))
      : canon(p,r.player_name);
    if(!member?.id||!Array.isArray(r.holes)||!r.holes.length)continue;
    r.scorecard_seed={
      member_id:member.id,
      member_name:member.name||r.player_name,
      mission_id:mission.id,
      date:mission.date||'',
      course_name:cleanCourse(mission.locationName||''),
      course_id:mission.courseId||'',
      gross:r.gross,
      net:r.net,
      holes:cleanHoles(r.holes),
      source:'mission_import',
      fingerprint:missionRoundFingerprint(mission,member.id,r.gross),
      updated_at:new Date().toISOString()
    };
  }
  return mission;
}

/**
 * Claim matching mission scorecard seeds into the signed-in user's personal db.rounds.
 * Never overwrites richer personal data — fills blanks only.
 */
function resolveCurrentPlatoonMemberId(p){
  if(typeof window.grResolveCurrentPlatoonMemberId==='function'){
    try{const id=window.grResolveCurrentPlatoonMemberId(p);if(id)return id}catch{}
  }
  const members=p?.members||[];
  const chief=members.find(m=>m.role==='chief');
  return chief?.id||null;
}

/**
 * Claim matching mission scorecard seeds into the signed-in user's personal db.rounds.
 * Only the current member's seeds are claimed — never the whole league into one phone.
 * Never overwrites richer personal data — fills blanks only.
 */
function claimMissionScorecardsIntoPersonalDb(p,{currentMemberId=null}={}){
  if(typeof window.grMergeMissionSeedIntoPersonal!=='function')return {claimed:0};
  const selfId=currentMemberId||resolveCurrentPlatoonMemberId(p);
  if(!selfId)return {claimed:0,skipped:'no-member'};
  let claimed=0;
  for(const m of (p?.missions||[])){
    if(m?.type==='war')continue;
    for(const r of (m.results||[])){
      const seed=r.scorecard_seed;if(!seed?.fingerprint)continue;
      if(String(seed.member_id)!==String(selfId))continue;
      const out=window.grMergeMissionSeedIntoPersonal(seed,r);
      if(out?.claimed||out?.merged){
        claimed++;
        if(out.roundId)r.personal_round_id=String(out.roundId);
      }
    }
  }
  return {claimed,memberId:selfId};
}

/**
 * Build a completed Mission from historical import confirm UI.
 * Results provided by the caller are treated as official.
 */
function buildCompletedMissionFromImport(input){
  const date=String(input?.date||'').trim();
  if(!date)return {ok:false,error:'Confirm the round date before creating the Mission.'};
  const results=normalizeOfficialResults(input?.results||[]);
  if(!results.length)return {ok:false,error:'Match at least one player before creating the Mission.'};
  const guestList=[...new Set((Array.isArray(input?.guests)?input.guests:[]).map(g=>String(g||'').trim()).filter(Boolean))];
  let notes=String(input?.notes||'');
  if(guestList.length&&!/\[\[GR_GUESTS:/.test(notes)){
    notes=`${notes}${notes?'\n':''}[[GR_GUESTS:${JSON.stringify(guestList)}]]`;
  }
  const mission={
    id:input?.id||uid('mission'),
    date,
    teeTime:String(input?.teeTime||'').slice(0,5),
    type:input?.type||'battle',
    courseId:input?.courseId||'',
    locationName:cleanCourse(input?.locationName||'Course TBD'),
    title:String(input?.title||'').trim()||'Past Mission',
    format:String(input?.format||'').trim()||'Stroke Play',
    notes,
    status:'completed',
    participants:[...new Set((input?.participants||[]).map(String))],
    guests:guestList,
    results,
    photos:(Array.isArray(input?.photos)?input.photos:[]).filter(x=>x&&x.dataUrl).slice(0,3),
    league_points:input?.league_points===false?false:true
  };
  const story=String(input?.recap_note||input?.notes||'').trim();
  if(story)mission.recap_note=story;
  return {ok:true,mission};
}

/** Read-only clone for History / After Action viewing — never write this back. */
function readOnlyMission(mission){
  return clone(mission);
}

/** Standings / highlights / AAR input = official results only (Phase 1 renderer consumes this). */
function officialResultsForRecap(mission){
  return normalizeOfficialResults(mission?.results||[]);
}

/* ── Phase 3–5 workflow helpers (persist extras in notes tags; no DB schema change) ── */

function stripTag(notes,re){return String(notes||'').replace(re,'').trim()}
function readTag(notes,re){const m=String(notes||'').match(re);return m?m[1]:''}
function writeTag(notes,token,payload){
  let s=stripTag(notes,new RegExp(`\\n?\\[\\[${token}:[\\s\\S]*?\\]\\]`,'g'));
  if(payload==null||payload==='')return s;
  return `${s}${s?'\n':''}[[${token}:${payload}]]`;
}

function isLive(m){return /\[\[GR_LIVE:1\]\]/.test(String(m?.notes||''))}
function setLiveNotes(notes,on){return writeTag(notes,'GR_LIVE',on?'1':'')}
function previewJsonOf(m){
  const raw=readTag(m?.notes||'',/\[\[GR_PREVIEW:([\s\S]*?)\]\]/);
  if(!raw)return null;
  try{return JSON.parse(raw)}catch{return null}
}
function setPreviewNotes(notes,preview){
  return writeTag(notes,'GR_PREVIEW',preview?JSON.stringify(preview):'');
}
function importFpOf(m){return readTag(m?.notes||'',/\[\[GR_IMPORT_FP:([^\]]*)\]\]/)}
function setImportFpNotes(notes,fp){return writeTag(notes,'GR_IMPORT_FP',fp||'')}

/** Display phase without changing DB status enum (planned|ready|completed|cancelled). */
function missionPhase(m){
  const s=m?.status||'planned';
  if(s==='completed')return'completed';
  if(s==='cancelled')return'cancelled';
  if(s==='ready'&&isLive(m))return'in_progress';
  if(s==='ready')return'ready';
  return'draft';
}

function resultsFingerprint(rows){
  const norm=normalizeOfficialResults(rows).map(r=>[
    String(r.player_name||'').toLowerCase(),
    r.gross,r.net,r.finish_position,r.raw_points
  ].join('|')).sort();
  return norm.join(';');
}

/**
 * Build Mission Preview from existing completed Platoon Missions only.
 * Never invents stats that are not present in official results.
 */
function guestsFromMission(m){
  if(Array.isArray(m?.guests)&&m.guests.length)return m.guests.map(g=>String(g||'').trim()).filter(Boolean);
  const hit=String(m?.notes||'').match(/\[\[GR_GUESTS:([\s\S]*?)\]\]/);
  if(!hit)return [];
  try{return (JSON.parse(hit[1])||[]).map(g=>String(g||'').trim()).filter(Boolean)}catch{return []}
}

function wittyPreviewBrief(p,m,{course,cadets,guests,prior,rivals,eagleNames}){
  const field=[...cadets,...guests.map(g=>`${g} (Guest)`)];
  const n=field.length;
  const courseBit=course||'wherever the GPS gives up';
  const open=n
    ? `Tee sheet at ${courseBit} features ${n} hopeful${n===1?'':'s'} who somehow all swear this is "just a friendly."`
    : `Tee sheet at ${courseBit} is somehow empty, which is either a scheduling miracle or a mass no-show rehearsal.`;
  let cast;
  if(!n)cast='Nobody signed up, so the trash talk will have to trash-talk itself.';
  else if(n===1)cast=`Solo act: ${field[0]} gets the rare privilege of losing an argument with their own scorecard.`;
  else if(n===2)cast=`Head-to-head billing: ${field[0]} vs ${field[1]} — two people, one shared delusion about who owns the short stick.`;
  else{
    const head=field.slice(0,-1).join(', ');
    const last=field[field.length-1];
    cast=`The traveling circus is ${head}, and ${last} — a lineup that looks confident until the first tee shot finds a tree with a name.`;
  }
  let hist;
  if(!prior.length)hist=`No Platoon receipts at this track yet, so everyone gets to invent a personal legend in real time.`;
  else if(rivals[0]){
    const top=rivals[0];
    hist=`Historically, ${top.name} has milked ${top.points} My Time Point${top.points===1?'':'s'} here across ${top.starts} start${top.starts===1?'':'s'}${top.wins?` and ${top.wins} win${top.wins===1?'':'s'}`:''} — which they will mention by hole 2 whether asked or not.`;
  }else hist=`This field has ${prior.length} prior Platoon round${prior.length===1?'':'s'} at ${courseBit}, and somehow learned almost nothing from any of them.`;
  let jab;
  if(guests.length&&cadets.length)jab=`Cadets brought ${guests.length===1?'a guest':'guests'} (${guests.slice(0,3).join(', ')}), presumably as fresh witnesses / scapegoats.`;
  else if(guests.length)jab=`It's an all-guest special — no home cooking, just visiting chaos.`;
  else if(eagleNames.length)jab=`Somewhere in the archives ${eagleNames[0]} actually made an eagle here, which will be weaponized as personality.`;
  else jab=`Expect early bravado, mid-round silence, and a post-round debate about "conditions" that somehow never includes the swing.`;
  const close=`Lock it, laugh first, and remember: My Time Points don't care about your warm-up.`;
  return [open,cast,hist,jab,close].join(' ');
}

function buildMissionPreview(p,m){
  const course=cleanCourse(m?.locationName||'');
  const people=Array.isArray(m?.participants)?m.participants:[];
  const memberName=id=>{
    const hit=(p?.members||[]).find(x=>String(x.id)===String(id));
    return hit?.name||null;
  };
  const cadets=people.map(memberName).filter(Boolean);
  const guests=guestsFromMission(m);
  const fieldNames=[...cadets,...guests];
  const prior=(p?.missions||[]).filter(x=>
    x&&x.id!==m?.id&&x.type!=='war'&&x.status==='completed'&&
    cleanCourse(x.locationName||'')===course
  );
  const lines=[];
  if(!prior.length){
    lines.push(`First recorded Platoon Mission at ${course||'this course'}.`);
  }else{
    lines.push(`${prior.length} prior completed Platoon Mission${prior.length===1?'':'s'} at ${course}.`);
  }

  // Head-to-head among this Mission's cadets using only official prior results.
  const rivalStats=new Map();
  for(const name of cadets)rivalStats.set(name,{name,starts:0,wins:0,points:0,bestNet:null});
  for(const pm of prior){
    const rows=normalizeOfficialResults(pm.results||[]);
    for(const r of rows){
      const mem=canon(p,r.player_name);
      const name=mem?.name;
      if(!name||!rivalStats.has(name))continue;
      const s=rivalStats.get(name);
      s.starts+=1;
      s.points+=Number(r.raw_points||0);
      if(finite(r.net))s.bestNet=s.bestNet==null?Number(r.net):Math.min(s.bestNet,Number(r.net));
      if(Number(r.finish_position)===1)s.wins+=1;
    }
  }
  const rivals=[...rivalStats.values()].filter(x=>x.starts>0).sort((a,b)=>b.points-a.points||b.wins-a.wins||a.name.localeCompare(b.name));
  if(rivals.length){
    const top=rivals[0];
    lines.push(`${top.name} leads this field historically at ${course} with ${top.points} pt${top.points===1?'':'s'} across ${top.starts} start${top.starts===1?'':'s'}${top.wins?` · ${top.wins} win${top.wins===1?'':'s'}`:''}.`);
    const withNet=rivals.filter(x=>x.bestNet!=null).sort((a,b)=>a.bestNet-b.bestNet);
    if(withNet.length)lines.push(`Best prior net among the field here: ${withNet[0].name} (${withNet[0].bestNet}).`);
  }else if(cadets.length){
    lines.push(`No prior completed results yet for ${cadets.slice(0,4).join(', ')} at this course.`);
  }
  if(guests.length)lines.push(`Guests on the sheet: ${guests.join(', ')}.`);

  // Notable marks only when eagle_count exists on official rows.
  let eagleBits=[];
  let eagleNames=[];
  for(const pm of prior){
    for(const r of normalizeOfficialResults(pm.results||[])){
      if(Number(r.eagle_count)>0){
        const name=canon(p,r.player_name)?.name||r.player_name;
        if(cadets.includes(name)){
          eagleBits.push(`${name} (${r.eagle_count})`);
          eagleNames.push(name);
        }
      }
    }
  }
  if(eagleBits.length)lines.push(`Eagles on record for this field here: ${[...new Set(eagleBits)].slice(0,4).join(', ')}.`);

  const brief=wittyPreviewBrief(p,m,{course,cadets,guests,prior,rivals,eagleNames:[...new Set(eagleNames)]});

  return {
    builtAt:new Date().toISOString(),
    course,
    field:fieldNames,
    guests,
    priorCount:prior.length,
    battlefield:lines[0]||`Mission at ${course||'Course TBD'}.`,
    watch:fieldNames.length?fieldNames.slice(0,6).join(' · '):'Field TBD',
    intel:lines.slice(0,5),
    brief,
    narrative:brief
  };
}

function applyPreviewToMission(mission,preview){
  if(!mission)return mission;
  mission.notes=setPreviewNotes(mission.notes||'',preview);
  mission.preview=preview;
  return mission;
}

function lockMissionForPreview(p,missionId){
  const m=findMission(p,missionId);if(!m)return {ok:false,error:'Mission not found.'};
  if(m.status==='completed')return {ok:false,error:'Completed Missions cannot be re-locked.'};
  const preview=buildMissionPreview(p,m);
  m.status='ready';
  m.notes=setLiveNotes(setPreviewNotes(m.notes||'',preview),false);
  m.preview=preview;
  return {ok:true,mission:m,preview};
}

function startMissionLive(p,missionId){
  const m=findMission(p,missionId);if(!m)return {ok:false,error:'Mission not found.'};
  if(m.status==='completed')return {ok:false,error:'Mission already completed.'};
  if(m.status!=='ready'&&m.status!=='planned')return {ok:false,error:'Mission must be Ready before starting.'};
  if(m.status==='planned'){
    const locked=lockMissionForPreview(p,missionId);
    if(!locked.ok)return locked;
  }
  m.status='ready';
  m.notes=setLiveNotes(m.notes||'',true);
  return {ok:true,mission:m};
}

function reopenMissionDraft(p,missionId){
  const m=findMission(p,missionId);if(!m)return {ok:false,error:'Mission not found.'};
  if(m.status==='completed')return {ok:false,error:'Completed Missions keep official results; edit setup only without unlocking.'};
  m.status='planned';
  m.notes=setLiveNotes(m.notes||'',false);
  return {ok:true,mission:m};
}

/**
 * Cumulative War standings from completed child Missions only.
 * Missing rounds do not invent scores or points — played count reflects actual starts.
 */
function warIdFromNotes(notes){
  const x=String(notes||'').match(/\[\[GR_WAR:([^\]]+)\]\]/);
  return x?x[1]:'';
}

function warChildMissions(p,war){
  const wid=war?.id;
  return (p?.missions||[])
    .filter(m=>m&&m.type!=='war'&&warIdFromNotes(m.notes)===wid)
    .sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
}

function warStandings(p,war){
  const kids=warChildMissions(p,war).filter(m=>m.status==='completed');
  const mode=String(war?.format||'Points').toLowerCase();
  // Union of players who actually posted an official result in any completed round.
  const map=new Map();
  for(const m of kids){
    for(const r of normalizeOfficialResults(m.results||[])){
      const mem=canon(p,r.player_name);
      const name=mem?.name||r.player_name||'Player';
      const key=mem?.id||String(name).toLowerCase();
      const guest=!mem&&(typeof window.grIsGuestPlayer==='function'?window.grIsGuestPlayer(p,m,r.player_name):true);
      const row=map.get(key)||{id:key,name,guest:!!guest,played:0,points:0,net:0,gross:0,nets:[],grosses:[]};
      if(guest)row.guest=true;
      row.played+=1;
      row.points+=Number(r.raw_points||0);
      if(finite(r.net)){row.net+=Number(r.net);row.nets.push(Number(r.net))}
      if(finite(r.gross)){row.gross+=Number(r.gross);row.grosses.push(Number(r.gross))}
      map.set(key,row);
    }
  }
  const rows=[...map.values()].map(r=>({
    ...r,
    guest:!!r.guest,
    avgNet:r.nets.length?r.net/r.nets.length:null,
    avgGross:r.grosses.length?r.gross/r.grosses.length:null
  }));
  rows.sort((a,b)=>{
    if(mode.includes('net')){
      const an=a.avgNet==null?9999:a.avgNet,bn=b.avgNet==null?9999:b.avgNet;
      return an-bn||b.played-a.played||a.name.localeCompare(b.name);
    }
    if(mode.includes('gross')){
      const ag=a.avgGross==null?9999:a.avgGross,bg=b.avgGross==null?9999:b.avgGross;
      return ag-bg||b.played-a.played||a.name.localeCompare(b.name);
    }
    return b.points-a.points||b.played-a.played||a.name.localeCompare(b.name);
  });
  return {kids,completed:kids.length,total:warChildMissions(p,war).length,mode,rows};
}

/**
 * Season My Time ⛳ Points = total 18Birdies raw_points / rounds played.
 * Tracks totalPoints + played in the background; cup score is the average.
 * Members only (guests do not enter the season cup).
 */
function fmtMyTimePoints(n){
  if(!Number.isFinite(n))return 0;
  const r=Math.round(n*10)/10;
  return Number.isInteger(r)?r:r;
}
function myTimePointsStandings(p){
  const complete=(p?.missions||[]).filter(m=>m&&m.type!=='war'&&m.status==='completed');
  const cupMissions=complete.filter(countsForLeaguePoints);
  const map=new Map((p?.members||[]).filter(m=>m&&m.status!=='inactive').map(m=>[m.id,{
    id:m.id,
    member:m,
    name:m.name,
    played:0,
    totalPoints:0,
    points:0
  }]));
  for(const m of cupMissions){
    for(const r of normalizeOfficialResults(m.results||[])){
      const mem=canon(p,r.player_name)||(r.hole_detail_canonical_id
        ? (p?.members||[]).find(x=>String(x.id)===String(r.hole_detail_canonical_id))
        : null);
      if(!mem||!map.has(mem.id))continue;
      const row=map.get(mem.id);
      row.played+=1;
      row.totalPoints+=Number(r.raw_points||0);
    }
  }
  const rows=[...map.values()].map(r=>{
    const points=r.played>0?fmtMyTimePoints(r.totalPoints/r.played):0;
    return {...r,points,myTimePoints:points};
  });
  rows.sort((a,b)=>b.points-a.points||b.played-a.played||b.totalPoints-a.totalPoints||String(a.name).localeCompare(String(b.name)));
  return {complete:complete.length,cupRounds:cupMissions.length,rows};
}

function wouldDuplicateOfficialImport(mission,rows){
  const next=resultsFingerprint(rows);
  if(!next)return false;
  const prev=importFpOf(mission)||resultsFingerprint(mission?.results||[]);
  return !!(prev&&prev===next);
}

function stampOfficialImport(mission,rows,opts={}){
  const set=setOfficialResults(mission,rows,{markCompleted:true,platoon:opts.platoon||null});
  if(!set.ok)return set;
  mission.notes=setImportFpNotes(mission.notes||'',resultsFingerprint(rows));
  mission.notes=setLiveNotes(mission.notes,false);
  return {ok:true,mission};
}

window.grMissionUid=uid;
window.grFindMission=findMission;
window.grCleanHoles=cleanHoles;
window.grMergeHolesRich=mergeHolesRich;
window.grNormalizeOfficialResultRow=normalizeOfficialResultRow;
window.grNormalizeOfficialResults=normalizeOfficialResults;
window.grPrepareMissionDraft=prepareMissionDraft;
window.grUpsertMission=upsertMission;
window.grSetOfficialResults=setOfficialResults;
window.grLockOfficialResults=lockOfficialResults;
window.grMergeHoleDetailsOntoOfficial=mergeHoleDetailsOntoOfficial;
window.grAttachScorecardSeeds=attachScorecardSeeds;
window.grClaimMissionScorecardsIntoPersonalDb=claimMissionScorecardsIntoPersonalDb;
window.grMissionRoundFingerprint=missionRoundFingerprint;
window.grBuildCompletedMissionFromImport=buildCompletedMissionFromImport;
window.grReadOnlyMission=readOnlyMission;
window.grOfficialResultsForRecap=officialResultsForRecap;
window.grMissionPhase=missionPhase;
window.grBuildMissionPreview=buildMissionPreview;
window.grApplyPreviewToMission=applyPreviewToMission;
window.grLockMissionForPreview=lockMissionForPreview;
window.grStartMissionLive=startMissionLive;
window.grReopenMissionDraft=reopenMissionDraft;
window.grPreviewFromMission=previewJsonOf;
window.grWarChildMissions=warChildMissions;
window.grWarStandings=warStandings;
window.grFmtMyTimePoints=fmtMyTimePoints;
window.grCountsForLeaguePoints=countsForLeaguePoints;
window.grMyTimePointsStandings=myTimePointsStandings;
window.grResultsFingerprint=resultsFingerprint;
window.grWouldDuplicateOfficialImport=wouldDuplicateOfficialImport;
window.grStampOfficialImport=stampOfficialImport;
window.grMissionCoreReady=true;
})();

