/** Offline checks for doubled Mission totals repair. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const src=fs.readFileSync(path.join(root,'platoon-mission-core.js'),'utf8');
const sandbox={
  console,
  window:{
    grFinite:v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v)),
    grCleanCourseName:v=>String(v||'').trim()||'Course TBD',
    grCanonicalMember:()=>null,
    grMemberLabel:()=>null
  }
};
vm.createContext(sandbox);
vm.runInContext(src.replace(/^\(\(\)=>\{/,'').replace(/\}\)\(\);\s*$/,''),sandbox);

const m={
  id:'m1',
  format:'Best Ball / Fourball',
  results:[
    {player_name:'Sweeney',gross:160,net:143,raw_points:20,finish_position:1},
    {player_name:'Chuck',gross:173,net:150,raw_points:16,finish_position:2},
    {player_name:'Cunny',gross:178,net:152,raw_points:12,finish_position:3},
    {player_name:'Sully',gross:209,net:169,raw_points:8,finish_position:4}
  ]
};

assert.equal(sandbox.missionResultsLookDoubled(m),true);
const out=sandbox.repairDoubledMissionTotals(m,{fixFormat:true});
assert.equal(out.ok,true);
assert.equal(out.fixed,4);
assert.equal(out.formatFixed,true);
assert.equal(m.format,'Stroke play (net)');
assert.equal(m.results[0].gross,80);
assert.equal(m.results[0].handicap,17); // preserved from 160-143
assert.equal(m.results[0].net,63); // 80 - 17
assert.equal(m.results[1].gross,87); // Math.round(173/2)=87
assert.equal(m.results[1].net,64); // 87 - (173-150)=87-23
assert.equal(m.results[3].gross,105); // Math.round(209/2)=105
assert.equal(m.results[0].raw_points,20); // points unchanged

console.log('test-mission-doubled-totals: ok');
