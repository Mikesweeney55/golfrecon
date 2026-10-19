import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const failures=[],passes=[];
const assert=(c,l)=>{if(c)passes.push(l);else failures.push(l)};

const members=[
  {id:'chief',name:'Mike Sweeney',role:'chief',linked:true,aliases:['Mike']},
  {id:'cunny',name:'Kevin Cunningham',role:'cadet',aliases:['Kevin','Cunny']}
];
const seed={
  id:'t',name:'My Time',members,missions:[
    {id:'m1',title:'Friday',date:'2026-03-07',type:'battle',status:'completed',locationName:'Four Oaks',results:[
      {player_name:'Mike',net:71,gross:84,raw_points:2,finish_position:2,holes:[{hole:1,par:4,score:3},{hole:2,par:3,score:1},{hole:3,par:5,score:3}]},
      {player_name:'Cunny',net:70,gross:82,raw_points:4,finish_position:1,eagle_count:1,holes:[{hole:1,par:4,score:4},{hole:2,par:3,score:2},{hole:3,par:5,score:3}]}
    ]}
  ],
  hqMeta:{version:1,modes:{birdies:'combined',ace:'combined',eagle:'combined'},records:[],eagleBalances:[],eagleDetails:[],suppressedAuto:[]}
};

const window={document:{getElementById:()=>null,createElement:()=>({id:'',textContent:'',style:{},appendChild(){},setAttribute(){}}),head:{appendChild(){}},body:{appendChild(){},dataset:{},addEventListener(){}},querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}}};
window.loadPlatoonLocal=()=>JSON.parse(JSON.stringify(seed));
window.savePlatoonLocal=(p)=>{Object.assign(seed,p)};
const ctx=vm.createContext({window,document:window.document,console,loadPlatoonLocal:window.loadPlatoonLocal,savePlatoonLocal:window.savePlatoonLocal,MutationObserver:class{observe(){}},requestAnimationFrame:f=>f(),setTimeout:()=>0});
for(const f of ['platoon-recap-shared.js','platoon-mission-core.js','platoon-hq-records.js']){
  vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
}
assert(ctx.window.grHqRecordsReady===true,'hq records ready');
let p=ctx.window.loadPlatoonLocal();
let eagles=ctx.window.grClubEagleModel(p);
assert(eagles.platoonTotal>=2,'auto eagles counted from hole detail');
assert(eagles.leaders.some(l=>l.playerName==='Mike Sweeney'||l.playerName==='Kevin Cunningham'),'eagle leaders present');

// Add starting balance for Kevin of 2 as-of after mission — should not double-count m1 if asOf >= mission date
p.hqMeta.eagleBalances=[{id:'b1',memberId:'cunny',playerName:'Kevin Cunningham',count:2,asOfDate:'2026-03-07',notes:'history',source:'manual'}];
eagles=ctx.window.grClubEagleModel(p);
const kevin=eagles.leaders.find(l=>l.memberId==='cunny'||/Kevin/i.test(l.playerName));
assert(!!kevin,'kevin row');
assert(kevin.balance===2,'balance applied');
assert(kevin.auto===0||kevin.total===2+kevin.manualDetails,'asOf suppresses same-day auto for kevin');

// Manual ace override / combined birdies
p.hqMeta.records=[{id:'r1',category:'birdies',memberId:'chief',playerName:'Mike Sweeney',value:5,date:'2025-01-01',missionTitle:'Old',overrideAuto:true,source:'manual'}];
p.hqMeta.modes.birdies='combined';
let rec=ctx.window.grRecordsModel(p);
assert(rec.birdies.display[0].value===5,'override wins combined birdies');
assert(/override|Manual/i.test(rec.birdies.display[0].sourceLabel||''),'override labeled');

p.hqMeta.modes.birdies='automatic';
p.hqMeta.records=[];
rec=ctx.window.grRecordsModel(p);
assert(rec.birdies.display.length>=1,'automatic birdies from holes');
assert(rec.ace.display.some(x=>Number(x.hole)===2),'automatic ace hole 2');

// Merge preserve
const server={id:'t',name:'My Time',members,missions:p.missions};
const merged=ctx.window.grMergeHqMetaPreserve(server,p);
assert(merged.hqMeta&&merged.hqMeta.eagleBalances?.length===1,'sync preserves local hqMeta when server omits');

const htmlEagle=ctx.window.grRenderClubEagleBubble(p);
const htmlRec=ctx.window.grRenderRecordsBubble(p);
assert(htmlEagle.includes('data-gr-hq-edit="eagles"'),'eagle edit icon');
assert(htmlRec.includes('data-gr-hq-edit="records"'),'records edit icon');

console.log(JSON.stringify({pass:passes.length,failures},null,2));
if(failures.length)process.exit(1);
