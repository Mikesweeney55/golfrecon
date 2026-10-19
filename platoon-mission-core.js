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
window.grMissionCoreReady=true;
})();
