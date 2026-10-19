/**
 * Automated Phase 3–5 Mission workflow tests (Node, no browser).
 * Loads shared/core modules via a minimal window shim.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const passes = [];

function assert(cond, label){
  if(cond) passes.push(label);
  else failures.push(label);
}

function loadScripts(){
  const window = {
    document:{
      getElementById:()=>null,
      createElement:()=>({id:'',textContent:'',appendChild(){}}),
      head:{appendChild(){}},
      body:{appendChild(){}}
    }
  };
  const ctx = vm.createContext({window, document:window.document, console});
  for(const file of ['platoon-recap-shared.js','platoon-mission-core.js']){
    const code = fs.readFileSync(path.join(root,file),'utf8');
    vm.runInContext(code, ctx, {filename:file});
  }
  return window;
}

const w = loadScripts();
assert(w.grSharedRecapReady===true, 'shared recap ready');
assert(w.grMissionCoreReady===true, 'mission core ready');

const members = [
  {id:'chief',name:'Mike Sweeney',role:'chief',aliases:['Mike','Mike S.']},
  {id:'sully',name:'Ryan Sweeney',role:'cadet',aliases:['Ryan','Ryan S.','Sully']},
  {id:'cunny',name:'Kevin Cunningham',role:'cadet',aliases:['Kevin','Cunny']},
  {id:'mannke',name:'Josh Mankey',role:'cadet',aliases:['Josh']},
  {id:'charlie',name:'Charlie',role:'cadet',aliases:[]}
];

const foursome = {
  id:'mission-fearsome-foursome',title:'Fearsome Foursome',date:'2026-03-01',teeTime:'08:00',
  type:'battle',status:'completed',locationName:"Campbell's Scottish Highlands (dan itibaren...)",
  format:'Net stroke play',participants:['chief','sully','cunny','mannke'],
  results:[
    {player_name:'Mike',net:72,gross:85,raw_points:4,finish_position:1},
    {player_name:'Sully',net:74,gross:88,raw_points:2,finish_position:2},
    {player_name:'Cunny',net:75,gross:90,raw_points:1,finish_position:3,eagle_count:2},
    {player_name:'Josh',net:78,gross:92,raw_points:0,finish_position:4,eagle_count:1}
  ]
};
const friday = {
  id:'mission-fearsome-friday',title:'Fearsome Friday',date:'2026-03-07',teeTime:'07:30',
  type:'battle',status:'completed',locationName:'Four Oaks',format:'Net stroke play',
  participants:['chief','sully'],
  results:[
    {player_name:'Ryan S.',net:70,gross:82,raw_points:4,finish_position:1},
    {player_name:'Mike S.',net:71,gross:84,raw_points:2,finish_position:2}
  ]
};

const p = {id:'t',name:'My Time',members,missions:[structuredClone(foursome),structuredClone(friday)]};

/* Alias + course */
assert(w.grCanonicalMember(p,'Sully')?.name==='Ryan Sweeney', 'alias Sully → Ryan');
assert(w.grCanonicalMember(p,'Cunny')?.name==='Kevin Cunningham', 'alias Cunny → Kevin');
assert(w.grDisplayName(p,'Mike S.')==='Mike Sweeney', 'display alias Mike S.');
assert(w.grCleanCourseName("Campbell's Scottish Highlands (dan itibaren...)")==="Campbell's Scottish Highlands", 'course clean');

/* Shared standings format */
const markup = w.grMissionRecapMarkup(p, friday);
assert(markup.includes('data-gr-shared-recap="1"'), 'shared recap marker');
assert(/NAME/.test(markup)&&/NET/.test(markup)&&/GROSS/.test(markup)&&/POINTS/.test(markup), 'standings headers Name|Net|Gross|Points');
assert(markup.includes('Ryan Sweeney')&&markup.includes('Mike Sweeney'), 'friday alias resolution in standings');
assert(markup.includes('AFTER ACTION REPORT'), 'AAR present');

const foursomeMarkup = w.grMissionRecapMarkup(p, foursome);
assert(foursomeMarkup.includes('Kevin Cunningham')&&foursomeMarkup.includes('Josh Mankey'), 'foursome aliases in standings');

/* Create / edit draft */
const draftPrep = w.grPrepareMissionDraft({
  title:'Draft Op',date:'2099-07-01',teeTime:'09:15',locationName:'Practice Course',
  format:'Net stroke play',participants:['chief','sully'],notes:'test',type:'battle'
},{});
assert(draftPrep.ok&&draftPrep.mission.status==='planned'&&draftPrep.mission.results.length===0, 'create draft mission');
w.grUpsertMission(p, draftPrep.mission);
assert(p.missions.some(m=>m.id===draftPrep.mission.id), 'upsert draft');

const reopened = w.grPrepareMissionDraft({
  title:'Draft Op Edited',date:'2099-07-02',teeTime:'10:00',locationName:'Practice Course',
  format:'Skins',participants:['chief','sully','cunny'],notes:'edited',type:'battle'
},{existing:draftPrep.mission});
assert(reopened.ok&&reopened.mission.title==='Draft Op Edited'&&reopened.mission.id===draftPrep.mission.id, 'edit draft preserves id');
assert(Array.isArray(reopened.mission.results)&&reopened.mission.results.length===0, 'edit does not invent results');

/* Lock / preview / start / reopen */
const lock = w.grLockMissionForPreview(p, draftPrep.mission.id);
assert(lock.ok&&lock.mission.status==='ready'&&w.grMissionPhase(lock.mission)==='ready', 'lock → ready');
assert(Array.isArray(lock.preview?.intel)&&lock.preview.intel.length>0, 'preview intel from history');
assert(!/invented|fabricat/i.test(JSON.stringify(lock.preview)), 'preview text not fabricated language');

const start = w.grStartMissionLive(p, draftPrep.mission.id);
assert(start.ok&&w.grMissionPhase(start.mission)==='in_progress', 'start → in progress');

const reopen = w.grReopenMissionDraft(p, draftPrep.mission.id);
assert(reopen.ok&&w.grMissionPhase(reopen.mission)==='draft', 'reopen → draft');

/* Official results + duplicate prevention */
const importRows = [
  {player_name:'Mike Sweeney',net:69,gross:80,raw_points:4,finish_position:1},
  {player_name:'Ryan Sweeney',net:71,gross:83,raw_points:2,finish_position:2}
];
const stamped = w.grStampOfficialImport(draftPrep.mission, importRows);
assert(stamped.ok&&draftPrep.mission.status==='completed'&&draftPrep.mission.results.length===2, 'stamp official import completes mission');
assert(w.grWouldDuplicateOfficialImport(draftPrep.mission, importRows)===true, 'duplicate import detected');
assert(w.grWouldDuplicateOfficialImport(draftPrep.mission, [{player_name:'Mike Sweeney',net:68,gross:80,raw_points:4,finish_position:1}])===false, 'changed import not duplicate');

/* Hole merge preserves official scoring */
const locked = w.grLockOfficialResults(friday);
const ryanBefore = locked.find(r=>w.grCanonicalMember(p,r.player_name)?.id==='sully');
const beforeGross = ryanBefore.gross;
const merged = w.grMergeHoleDetailsOntoOfficial(locked,[{
  member:members.find(x=>x.id==='sully'),
  raw:['Ryan'],
  holes:[{hole:1,par:4,score:3},{hole:2,par:3,score:3}]
}],p);
const ryanAfter = merged.results.find(r=>w.grCanonicalMember(p,r.player_name)?.id==='sully');
assert(merged.ok&&ryanAfter.gross===beforeGross&&ryanAfter.net===70&&Array.isArray(ryanAfter.holes)&&ryanAfter.holes.length===2, 'hole merge keeps official scores');

/* Past mission builder */
const past = w.grBuildCompletedMissionFromImport({
  date:'2025-12-01',locationName:'Four Oaks',title:'Past Import',
  participants:['chief'],results:[{player_name:'Mike Sweeney',net:70,gross:82,raw_points:3,finish_position:1}]
});
assert(past.ok&&past.mission.status==='completed'&&past.mission.results[0].net===70, 'past mission import builder');

/* Preview uses only prior official history */
const upcoming = {
  id:'mission-upcoming-four-oaks',title:'Next Four Oaks',date:'2099-08-01',teeTime:'08:00',
  type:'battle',status:'planned',locationName:'Four Oaks',format:'Net stroke play',
  participants:['chief','sully'],results:[]
};
const preview = w.grBuildMissionPreview(p, upcoming);
assert(preview.priorCount>=1, 'preview sees prior Four Oaks');
assert(preview.intel.some(line=>/Ryan Sweeney|Mike Sweeney/.test(line)), 'preview mentions field history');
assert(!preview.intel.some(line=>/undefined|NaN/.test(line)), 'preview has no NaN/undefined');

/* Phase 4 — four-round War accumulation + missing rounds */
const war = {id:'war-test',title:'Test War',type:'war',status:'planned',date:'2026-04-01',format:'Points',notes:'[[GR_WAR_END:2026-04-30]]',participants:[],results:[]};
const rounds = [
  {id:'war-r1',title:'R1 Oaks',date:'2026-04-01',locationName:'Four Oaks',participants:['chief','sully','cunny'],
    results:[
      {player_name:'Mike Sweeney',net:70,gross:82,raw_points:4,finish_position:1},
      {player_name:'Ryan Sweeney',net:71,gross:83,raw_points:2,finish_position:2},
      {player_name:'Kevin Cunningham',net:73,gross:88,raw_points:1,finish_position:3}
    ]},
  {id:'war-r2',title:'R2 Highlands',date:'2026-04-08',locationName:"Campbell's Scottish Highlands",participants:['chief','sully','mannke'],
    results:[
      {player_name:'Ryan Sweeney',net:69,gross:81,raw_points:4,finish_position:1},
      {player_name:'Josh Mankey',net:72,gross:90,raw_points:2,finish_position:2},
      {player_name:'Mike Sweeney',net:74,gross:86,raw_points:1,finish_position:3}
    ]},
  {id:'war-r3',title:'R3 Oaks',date:'2026-04-15',locationName:'Four Oaks',participants:['chief','cunny','charlie'],
    results:[
      {player_name:'Kevin Cunningham',net:68,gross:84,raw_points:4,finish_position:1},
      {player_name:'Charlie',net:70,gross:85,raw_points:2,finish_position:2},
      {player_name:'Mike Sweeney',net:72,gross:84,raw_points:1,finish_position:3}
    ]},
  {id:'war-r4',title:'R4 Oaks',date:'2026-04-22',locationName:'Four Oaks',participants:['chief','sully','cunny','mannke'],
    results:[
      {player_name:'Mike Sweeney',net:69,gross:81,raw_points:4,finish_position:1},
      {player_name:'Ryan Sweeney',net:70,gross:82,raw_points:2,finish_position:2},
      {player_name:'Josh Mankey',net:71,gross:89,raw_points:1,finish_position:3},
      {player_name:'Kevin Cunningham',net:75,gross:91,raw_points:0,finish_position:4}
    ]}
];

const warPlatoon = {id:'t',name:'My Time',members,missions:[war]};
const ptsAt = {};
for(let i=0;i<rounds.length;i++){
  const r = rounds[i];
  warPlatoon.missions.push({
    ...r,type:'battle',status:'completed',teeTime:'08:00',format:'Net stroke play',
    notes:`[[GR_WAR:${war.id}]]`
  });
  const stand = w.grWarStandings(warPlatoon, war);
  assert(stand.completed===i+1, `war completed count after round ${i+1}`);
  const byName = Object.fromEntries(stand.rows.map(x=>[x.name,x]));
  ptsAt[i+1]=byName;
  // Missing rounds: Charlie only plays R3 → after R4 played should still be 1
  if(i>=2){
    assert(byName.Charlie?.played===1, `Charlie played=1 after round ${i+1}`);
    assert(byName.Charlie?.points===2, `Charlie points=2 only from R3 after round ${i+1}`);
  }
  // Ryan misses R3
  if(i===2){
    assert(byName['Ryan Sweeney']?.played===2, 'Ryan played=2 after missing R3');
    assert(byName['Ryan Sweeney']?.points===6, 'Ryan points=6 after R1+R2 (no invented R3)');
  }
}

assert(ptsAt[1]['Mike Sweeney']?.points===4&&ptsAt[1]['Mike Sweeney']?.played===1, 'after R1 Mike 4pts/1');
assert(ptsAt[2]['Mike Sweeney']?.points===5&&ptsAt[2]['Ryan Sweeney']?.points===6, 'after R2 cumulative');
assert(ptsAt[3]['Mike Sweeney']?.points===6&&ptsAt[3]['Kevin Cunningham']?.points===5, 'after R3 cumulative');
assert(ptsAt[4]['Mike Sweeney']?.points===10&&ptsAt[4]['Ryan Sweeney']?.points===8, 'after R4 cumulative');
assert(ptsAt[4]['Josh Mankey']?.played===2&&ptsAt[4]['Josh Mankey']?.points===3, 'Josh missing rounds handled');
assert(!ptsAt[1].Charlie, 'Charlie absent until he plays');

/* Read-only view clone does not mutate source */
const clone = w.grReadOnlyMission(friday);
clone.results[0].net=999;
assert(friday.results[0].net===70, 'readOnlyMission does not mutate official results');

/* Completed cannot reopen */
const badReopen = w.grReopenMissionDraft(p, friday.id);
assert(!badReopen.ok, 'completed mission cannot reopen to draft');

const summary = {
  ok: failures.length===0,
  passed: passes.length,
  failed: failures.length,
  failures,
  passes
};
console.log(JSON.stringify(summary,null,2));
if(failures.length){
  console.error('FAILED:', failures.join('; '));
  process.exit(1);
}
console.log(`All ${passes.length} Phase 3–5 unit checks passed.`);
