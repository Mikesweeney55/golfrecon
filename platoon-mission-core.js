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
    map.set(hole,{
      hole,
      par:finite(h?.par)?Number(h.par):null,
      score:finite(h?.score)?Number(h.score):null
    });
  }
  return [...map.values()].sort((a,b)=>a.hole-b.hole);
}

/** Normalize one official result row. Never invents missing scores. */
function normalizeOfficialResultRow(r){
  const row={
    player_name:String(r?.player_name||'').trim()||'Player',
    gross:finite(r?.gross)?Number(r.gross):null,
    net:finite(r?.net)?Number(r.net):null,
    finish_position:finite(r?.finish_position)?Number(r.finish_position):null,
    raw_points:finite(r?.raw_points)?Number(r.raw_points):null,
    eagle_count:finite(r?.eagle_count)?Number(r.eagle_count):null
  };
  // Preserve supplemental hole detail if already attached to an official row.
  if(Array.isArray(r?.holes)&&r.holes.length)row.holes=cleanHoles(r.holes);
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
  if(existing?.guests)mission.guests=clone(existing.guests);
  if(Array.isArray(input?.guests))mission.guests=input.guests;
  return {ok:true,mission};
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
 */
function setOfficialResults(mission,rows,{markCompleted=true}={}){
  if(!mission)return {ok:false,error:'Mission not found.'};
  const normalized=normalizeOfficialResults(rows);
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
    target.holes=holes;
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

/**
 * Build a completed Mission from historical import confirm UI.
 * Results provided by the caller are treated as official.
 */
function buildCompletedMissionFromImport(input){
  const date=String(input?.date||'').trim();
  if(!date)return {ok:false,error:'Confirm the round date before creating the Mission.'};
  const results=normalizeOfficialResults(input?.results||[]);
  if(!results.length)return {ok:false,error:'Match at least one player before creating the Mission.'};
  const mission={
    id:input?.id||uid('mission'),
    date,
    teeTime:String(input?.teeTime||'').slice(0,5),
    type:input?.type||'battle',
    courseId:input?.courseId||'',
    locationName:cleanCourse(input?.locationName||'Course TBD'),
    title:String(input?.title||'').trim()||'Past Mission',
    format:String(input?.format||'').trim()||'Stroke Play',
    notes:String(input?.notes||''),
    status:'completed',
    participants:[...new Set((input?.participants||[]).map(String))],
    results
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
function buildMissionPreview(p,m){
  const course=cleanCourse(m?.locationName||'');
  const people=Array.isArray(m?.participants)?m.participants:[];
  const memberName=id=>{
    const hit=(p?.members||[]).find(x=>String(x.id)===String(id));
    return hit?.name||null;
  };
  const fieldNames=people.map(memberName).filter(Boolean);
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

  // Head-to-head among this Mission's field using only official prior results.
  const rivalStats=new Map();
  for(const name of fieldNames)rivalStats.set(name,{name,starts:0,wins:0,points:0,bestNet:null});
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
  }else if(fieldNames.length){
    lines.push(`No prior completed results yet for ${fieldNames.slice(0,4).join(', ')} at this course.`);
  }

  // Notable marks only when eagle_count exists on official rows.
  let eagleBits=[];
  for(const pm of prior){
    for(const r of normalizeOfficialResults(pm.results||[])){
      if(Number(r.eagle_count)>0){
        const name=canon(p,r.player_name)?.name||r.player_name;
        if(fieldNames.includes(name))eagleBits.push(`${name} (${r.eagle_count})`);
      }
    }
  }
  if(eagleBits.length)lines.push(`Eagles on record for this field here: ${[...new Set(eagleBits)].slice(0,4).join(', ')}.`);

  return {
    builtAt:new Date().toISOString(),
    course,
    field:fieldNames,
    priorCount:prior.length,
    battlefield:lines[0]||`Mission at ${course||'Course TBD'}.`,
    watch:fieldNames.length?fieldNames.slice(0,6).join(' · '):'Field TBD',
    intel:lines.slice(0,5)
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
      const row=map.get(key)||{id:key,name,played:0,points:0,net:0,gross:0,nets:[],grosses:[]};
      row.played+=1;
      row.points+=Number(r.raw_points||0);
      if(finite(r.net)){row.net+=Number(r.net);row.nets.push(Number(r.net))}
      if(finite(r.gross)){row.gross+=Number(r.gross);row.grosses.push(Number(r.gross))}
      map.set(key,row);
    }
  }
  const rows=[...map.values()].map(r=>({
    ...r,
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

function wouldDuplicateOfficialImport(mission,rows){
  const next=resultsFingerprint(rows);
  if(!next)return false;
  const prev=importFpOf(mission)||resultsFingerprint(mission?.results||[]);
  return !!(prev&&prev===next);
}

function stampOfficialImport(mission,rows){
  const set=setOfficialResults(mission,rows,{markCompleted:true});
  if(!set.ok)return set;
  mission.notes=setImportFpNotes(mission.notes||'',resultsFingerprint(rows));
  mission.notes=setLiveNotes(mission.notes,false);
  return {ok:true,mission};
}

window.grMissionUid=uid;
window.grFindMission=findMission;
window.grCleanHoles=cleanHoles;
window.grNormalizeOfficialResultRow=normalizeOfficialResultRow;
window.grNormalizeOfficialResults=normalizeOfficialResults;
window.grPrepareMissionDraft=prepareMissionDraft;
window.grUpsertMission=upsertMission;
window.grSetOfficialResults=setOfficialResults;
window.grLockOfficialResults=lockOfficialResults;
window.grMergeHoleDetailsOntoOfficial=mergeHoleDetailsOntoOfficial;
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
window.grResultsFingerprint=resultsFingerprint;
window.grWouldDuplicateOfficialImport=wouldDuplicateOfficialImport;
window.grStampOfficialImport=stampOfficialImport;
window.grMissionCoreReady=true;
})();

