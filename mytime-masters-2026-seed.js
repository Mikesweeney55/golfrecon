/**
 * Hardcoded 2026 MyTime Masters Championship (Jan 29 – Feb 1).
 * Idempotent seed into the local platoon snapshot so MT Points + plaque photo stick.
 */
(()=>{
'use strict';

const MISSION_ID='mission-2026-mytime-masters';
const SEED_VER=1;
const PLAQUE_URL='assets/mytime-masters-2026-plaque.jpg';

/** Plaque order → roster hints (ids for default My Time nicknames + name aliases). */
const FIELD=[
  {plaque:'Stephen H.',pts:30,net:83,pos:1,ids:['steve'],aliases:['Stephen H.','Stephen H','Stephen','Steve']},
  {plaque:'Ryan S.',pts:24,net:87,pos:2,ids:['sully'],aliases:['Ryan S.','Ryan S','Ryan','Sully']},
  {plaque:'Mike S.',pts:18,net:91,pos:3,ids:['chief'],aliases:['Mike S.','Mike S','Mike','Mike Sweeney','Sweeney']},
  {plaque:'Kevin C.',pts:12,net:93,pos:4,ids:['cunny'],aliases:['Kevin C.','Kevin C','Kevin','Cunny']},
  {plaque:'Chuck A.',pts:6,net:101,pos:5,ids:['chuck'],aliases:['Chuck A.','Chuck A','Chuck','Charlie']}
];

const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

function findMember(p,hint){
  const members=Array.isArray(p?.members)?p.members:[];
  for(const id of hint.ids){
    const hit=members.find(m=>String(m.id)===String(id)&&m.status!=='inactive');
    if(hit)return hit;
  }
  if(typeof window.grCanonicalMember==='function'){
    for(const a of [hint.plaque,...hint.aliases]){
      const hit=window.grCanonicalMember(p,a);
      if(hit)return hit;
    }
  }
  for(const m of members){
    if(m.status==='inactive')continue;
    const vals=[m.name,...(Array.isArray(m.aliases)?m.aliases:[])].map(norm);
    if(hint.aliases.some(a=>vals.includes(norm(a)))||vals.includes(norm(hint.plaque)))return m;
  }
  return null;
}

function mergeAliases(member,aliases){
  if(!member)return false;
  const cur=Array.isArray(member.aliases)?member.aliases.map(String):[];
  const next=[...new Set([...cur,...aliases.map(String).filter(Boolean)])];
  if(next.length===cur.length&&next.every((x,i)=>x===cur[i]))return false;
  member.aliases=next;
  return true;
}

function plaquePhoto(){
  return {id:'mph-mytime-masters-2026',dataUrl:PLAQUE_URL,createdAt:'2026-02-01T18:00:00.000Z',caption:'2026 MyTime Masters Championship plaque'};
}

function buildMission(p){
  const results=[];
  const participants=[];
  for(const row of FIELD){
    const mem=findMember(p,row);
    if(mem?.id)participants.push(String(mem.id));
    const entry={
      player_name:mem?.name||row.plaque,
      net:row.net,
      finish_position:row.pos,
      raw_points:row.pts,
      eagle_count:0
    };
    if(mem?.id)entry.hole_detail_canonical_id=mem.id;
    results.push(entry);
  }
  const photo=plaquePhoto();
  const mission={
    id:MISSION_ID,
    date:'2026-02-01',
    teeTime:'',
    type:'battle',
    courseId:'',
    locationName:'MyTime Masters',
    title:'2026 MyTime Masters Championship',
    format:'Final 4-Round Results · Jan 29–Feb 1',
    notes:'[[GR_SEED:mytime-masters-2026:v'+SEED_VER+']]',
    status:'completed',
    participants:[...new Set(participants)],
    guests:[],
    results,
    photos:[photo],
    league_points:true,
    recap_note:'Hardcoded plaque seed for the Jan 29–Feb 1, 2026 MyTime Masters Championship. Points count toward My Time ⛳.'
  };
  if(typeof window.grBuildCompletedMissionFromImport==='function'){
    const built=window.grBuildCompletedMissionFromImport({
      ...mission,
      photos:[photo]
    });
    if(built?.ok&&built.mission){
      // Keep canonical ids — import builder normalizes results but preserves hole_detail_canonical_id.
      built.mission.results=results.map(r=>({...r}));
      built.mission.photos=[photo];
      built.mission.league_points=true;
      built.mission.recap_note=mission.recap_note;
      built.mission.notes=mission.notes;
      built.mission.format=mission.format;
      built.mission.locationName=mission.locationName;
      return built.mission;
    }
  }
  return mission;
}

function seedVersionOf(m){
  const hit=String(m?.notes||'').match(/\[\[GR_SEED:mytime-masters-2026:v(\d+)\]\]/);
  return hit?Number(hit[1]):0;
}

function ensureMyTimeMasters2026(p){
  if(!p||typeof p!=='object')return {changed:false};
  p.missions=Array.isArray(p.missions)?p.missions:[];
  let changed=false;

  for(const row of FIELD){
    const mem=findMember(p,row);
    if(mem&&mergeAliases(mem,row.aliases))changed=true;
  }

  const existing=p.missions.find(m=>String(m.id)===MISSION_ID);
  const mission=buildMission(p);
  if(!existing){
    if(typeof window.grUpsertMission==='function')window.grUpsertMission(p,mission);
    else p.missions.push(mission);
    changed=true;
  }else if(seedVersionOf(existing)<SEED_VER){
    if(typeof window.grUpsertMission==='function')window.grUpsertMission(p,{...mission,results:mission.results});
    else{
      const i=p.missions.findIndex(m=>String(m.id)===MISSION_ID);
      if(i>=0)p.missions[i]={...existing,...mission};
    }
    changed=true;
  }else{
    // Keep plaque photo even if something stripped it.
    const photos=Array.isArray(existing.photos)?existing.photos.filter(x=>x&&x.dataUrl):[];
    if(!photos.some(x=>String(x.dataUrl).includes('mytime-masters-2026-plaque'))){
      existing.photos=[plaquePhoto(),...photos].slice(0,3);
      changed=true;
    }
    if(existing.league_points===false){existing.league_points=true;changed=true}
  }

  if(typeof window.grWriteMissionPhotosSide==='function'){
    try{window.grWriteMissionPhotosSide(p,MISSION_ID,[plaquePhoto()])}catch{}
  }
  return {changed,missionId:MISSION_ID};
}

/** Keep the seeded Masters mission if server snapshot omits it. */
function preserveMyTimeMasters2026(serverP,localP){
  if(!serverP)return localP||serverP;
  serverP.missions=Array.isArray(serverP.missions)?serverP.missions:[];
  const local=Array.isArray(localP?.missions)?localP.missions:[];
  const localHit=local.find(m=>String(m.id)===MISSION_ID);
  const serverHit=serverP.missions.find(m=>String(m.id)===MISSION_ID);
  if(localHit&&!serverHit)serverP.missions.push(JSON.parse(JSON.stringify(localHit)));
  else if(localHit&&serverHit){
    const sp=Array.isArray(serverHit.photos)?serverHit.photos.filter(x=>x&&x.dataUrl):[];
    const lp=Array.isArray(localHit.photos)?localHit.photos.filter(x=>x&&x.dataUrl):[];
    if(!sp.length&&lp.length)serverHit.photos=lp.slice(0,3);
  }
  return serverP;
}

window.grEnsureMyTimeMasters2026=ensureMyTimeMasters2026;
window.grPreserveMyTimeMasters2026=preserveMyTimeMasters2026;
window.grMyTimeMasters2026Id=MISSION_ID;
})();
