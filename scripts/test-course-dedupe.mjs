/** Offline checks for Club-Tee peel + Atkinson-style course consolidation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'inline script missing');

// Extract only the course-name helpers we need (avoid running the full app).
const bits=[
  script.match(/const TEE_ONLY_COURSE_FIX=\{[\s\S]*?\};/),
  script.match(/const COLOR_TEE_RE=[\s\S]*?;/),
  script.match(/function stripTrailingTeeLabel[\s\S]*?\n\}/),
  script.match(/function normalizeCourseName[\s\S]*?\n\}/),
  script.match(/function normalizeTee[\s\S]*?\n\}/),
  script.match(/function expandTeeOnlyCourseName[\s\S]*?\n\}/),
  script.match(/function courseDedupeKey[\s\S]*?\n\}/),
  script.match(/function courseRichness[\s\S]*?\n\}/),
  script.match(/function consolidateDuplicateCourses[\s\S]*?\n\}/),
];
for(const b of bits)assert.ok(b, 'helper extract failed');

const sandbox={
  console,
  db:{courses:[],rounds:[]},
  state:{selectedCourseId:null,gameCourseId:'all',roundCourseId:'all'}
};
vm.createContext(sandbox);
vm.runInContext(bits.map(b=>b[0]).join('\n'),sandbox);

const {
  expandTeeOnlyCourseName,
  consolidateDuplicateCourses,
  stripTrailingTeeLabel,
  courseDedupeKey
}=sandbox;

function expectExpanded(actual,expected){
  assert.equal(actual.course_name,expected.course_name);
  assert.equal(actual.baseName,expected.baseName);
  assert.equal(actual.tees,expected.tees);
}

// Gold tee-only still expands to Kingswood - Gold
expectExpanded(expandTeeOnlyCourseName('Gold','Unknown'),{
  course_name:'Kingswood - Gold',
  baseName:'Kingswood',
  tees:'Gold'
});

// Atkinson must NOT become "Atkinson Country Club - White"
expectExpanded(expandTeeOnlyCourseName('Atkinson Country Club','White'),{
  course_name:'Atkinson Country Club',
  baseName:'Atkinson Country Club',
  tees:'White'
});

// Peeling an already-forked label
assert.equal(stripTrailingTeeLabel('Atkinson Country Club - White').club,'Atkinson Country Club');
expectExpanded(expandTeeOnlyCourseName('Atkinson Country Club - White','White'),{
  course_name:'Atkinson Country Club',
  baseName:'Atkinson Country Club',
  tees:'White'
});

// Consolidate two Atkinson rows (plain + Club-Tee fork) with same tee
sandbox.db.courses=[
  {id:'atk-1',name:'Atkinson Country Club',baseName:'Atkinson Country Club',tees:'White',segment:'18 holes',pars:[4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4]},
  {id:'atk-2',name:'Atkinson Country Club - White',baseName:'Atkinson Country Club',tees:'White',segment:'18 holes',pars:[],recovered:true}
];
sandbox.db.rounds=[{id:'r1',courseId:'atk-2',gross:85}];
assert.equal(courseDedupeKey(sandbox.db.courses[0]),courseDedupeKey({
  ...sandbox.db.courses[1],
  name:'Atkinson Country Club',
  baseName:'Atkinson Country Club'
}));
const removed=consolidateDuplicateCourses();
assert.equal(removed,1);
assert.equal(sandbox.db.courses.length,1);
assert.equal(sandbox.db.courses[0].id,'atk-1');
assert.equal(sandbox.db.courses[0].name,'Atkinson Country Club');
assert.equal(sandbox.db.rounds[0].courseId,'atk-1');

console.log('test-course-dedupe: ok');
