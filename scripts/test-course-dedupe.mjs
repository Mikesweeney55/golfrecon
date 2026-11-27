/** Offline checks for smart club identity + tee variants. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'inline script missing');

const bits=[
  script.match(/const TEE_ONLY_COURSE_FIX=\{[\s\S]*?\};/),
  script.match(/const COLOR_TEE_RE=[\s\S]*?;/),
  script.match(/function stripTrailingTeeLabel[\s\S]*?\n\}/),
  script.match(/function canonicalClubName[\s\S]*?\n\}/),
  script.match(/function clubIdentityKey[\s\S]*?\n\}/),
  script.match(/function teeIdentityKey[\s\S]*?\n\}/),
  script.match(/function courseHoleCount[\s\S]*?\n\}/),
  script.match(/function coursesForClub[\s\S]*?\n\}/),
  script.match(/function teeVariantsForClub[\s\S]*?\n\}/),
  script.match(/function normalizeCourseName[\s\S]*?\n\}/),
  script.match(/function normalizeTee[\s\S]*?\n\}/),
  script.match(/function expandTeeOnlyCourseName[\s\S]*?\n\}/),
  script.match(/function courseDedupeKey[\s\S]*?\n\}/),
  script.match(/function courseRichness[\s\S]*?\n\}/),
  script.match(/function remapCourseId[\s\S]*?\n\}/),
  script.match(/function mergeCourseRowInto[\s\S]*?\n\}/),
  script.match(/function consolidateDuplicateCourses[\s\S]*?\n\}/),
  script.match(/function courseMenuLabel[\s\S]*?\n\}/),
];
for(const [i,b] of bits.entries())assert.ok(b, `helper extract failed at ${i}`);

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
  courseDedupeKey,
  clubIdentityKey,
  canonicalClubName,
  courseMenuLabel
}=sandbox;

function expectExpanded(actual,expected){
  assert.equal(actual.course_name,expected.course_name);
  assert.equal(actual.baseName,expected.baseName);
  assert.equal(actual.tees,expected.tees);
}

assert.equal(canonicalClubName('Butter Brook Golf Club'),'Butter Brook');
assert.equal(canonicalClubName('Butter Brook Country Club'),'Butter Brook');
assert.equal(canonicalClubName('Atkinson Country Club - White'),'Atkinson');
assert.equal(clubIdentityKey('Butter Brook Golf Club'),clubIdentityKey('Butter Brook'));
assert.equal(clubIdentityKey('Atkinson Country Club'),clubIdentityKey('Atkinson'));

expectExpanded(expandTeeOnlyCourseName('Gold','Unknown'),{
  course_name:'Kingswood',
  baseName:'Kingswood',
  tees:'Gold'
});
expectExpanded(expandTeeOnlyCourseName('Atkinson Country Club','White'),{
  course_name:'Atkinson',
  baseName:'Atkinson',
  tees:'White'
});
expectExpanded(expandTeeOnlyCourseName('Butter Brook Golf Club - Blue','Blue'),{
  course_name:'Butter Brook',
  baseName:'Butter Brook',
  tees:'Blue'
});

assert.equal(stripTrailingTeeLabel('Atkinson Country Club - White').club,'Atkinson Country Club');

// Three Butter Brook naming variants + Unknown stub → one White + one Blue
sandbox.db.courses=[
  {id:'bb-unk',name:'Butter Brook',baseName:'Butter Brook',tees:'Unknown',segment:'18 holes',pars:[],recovered:true},
  {id:'bb-w1',name:'Butter Brook Golf Club',baseName:'Butter Brook Golf Club',tees:'White',segment:'18 holes',pars:[4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4]},
  {id:'bb-w2',name:'Butter Brook',baseName:'Butter Brook',tees:'White',segment:'18 holes',pars:[]},
  {id:'bb-b',name:'Butter Brook',baseName:'Butter Brook',tees:'Blue',segment:'18 holes',pars:[4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4]},
];
sandbox.db.rounds=[
  {id:'r1',courseId:'bb-unk',gross:85},
  {id:'r2',courseId:'bb-w2',gross:88},
];
assert.equal(courseDedupeKey(sandbox.db.courses[1]),courseDedupeKey(sandbox.db.courses[2]));
const removed=consolidateDuplicateCourses();
assert.ok(removed>=2,`expected >=2 merges, got ${removed}`);
assert.equal(sandbox.db.courses.length,2,'should keep White + Blue only');
const labels=sandbox.db.courses.map(courseMenuLabel).sort();
assert.deepEqual(labels,['Butter Brook · Blue','Butter Brook · White']);
assert.ok(sandbox.db.rounds.every(r=>['bb-w1','bb-b'].includes(String(r.courseId))||sandbox.db.courses.some(c=>String(c.id)===String(r.courseId))));

// Atkinson peel + consolidate
sandbox.db.courses=[
  {id:'atk-1',name:'Atkinson Country Club',baseName:'Atkinson Country Club',tees:'White',segment:'18 holes',pars:[4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4]},
  {id:'atk-2',name:'Atkinson Country Club - White',baseName:'Atkinson Country Club',tees:'White',segment:'18 holes',pars:[],recovered:true}
];
sandbox.db.rounds=[{id:'r1',courseId:'atk-2',gross:85}];
assert.equal(consolidateDuplicateCourses(),1);
assert.equal(sandbox.db.courses.length,1);
assert.equal(canonicalClubName(sandbox.db.courses[0].name),'Atkinson');

console.log('test-course-dedupe: ok');
