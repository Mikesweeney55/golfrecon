/**
 * Offline regression for Hole Preview geocode ranking.
 * Ensures short names like "Four Oaks" prefer Country Club (Dracut MA) over
 * distant false matches (Kansas) without relying on sibling-course warm-up.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const failures=[],passes=[];
const assert=(c,l)=>{if(c)passes.push(l);else failures.push(l)};

// Extract helper functions from index.html into a sandbox.
const extract=(name)=>{
  const re=new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}\\n`);
  const m=html.match(re);
  if(!m)throw new Error(`Could not extract ${name}`);
  return m[0];
};
const src=[
  `function normalizeCourseName(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\\s+/g,' ')}`,
  extract('courseNameScore'),
  extract('regionBonusForHit'),
  extract('scoreCourseGeocodeHit'),
  `globalThis.grScoreCourseGeocodeHit=scoreCourseGeocodeHit;`
].join('\n');

const sandbox={console};
vm.createContext(sandbox);
vm.runInContext(src,sandbox,{filename:'geocode-extract.js'});
const score=sandbox.grScoreCourseGeocodeHit;

const fourOaks=[
  {__q:'Four Oaks golf course',display_name:'Four Oaks Golf Course, West 20th Street, Pittsburg, Crawford County, Kansas, 66762, United States',lat:'37.4223926',lon:'-94.7144827',type:'golf_course',class:'leisure'},
  {__q:'Four Oaks country club',display_name:'Four Oaks Country Club, Broadway Road, Dracut, Middlesex County, Massachusetts, 01826, United States',lat:'42.6888762',lon:'-71.2914643',type:'golf_course',class:'leisure'}
];
const ranked=[...fourOaks].sort((a,b)=>score(b,'Four Oaks',[],'')-score(a,'Four Oaks',[],''));
assert(/Dracut|Massachusetts/i.test(ranked[0].display_name),'Four Oaks prefers Dracut MA Country Club without warm-up');
assert(score(fourOaks[1],'Four Oaks',[],'')>score(fourOaks[0],'Four Oaks',[],''),'Country Club candidate outscores Kansas golf course');

const highlands=[
  {__q:'Scottish Highlands golf course',display_name:'Scottish Highlands, Lamplighter Lane, Salem, Rockingham County, New Hampshire, 03079, United States',lat:'42.7545606',lon:'-71.2442744',type:'golf_course'},
  {__q:"Campbell's Scottish Highlands golf course",display_name:'Some unrelated Highlands Golf, Scotland, United Kingdom',lat:'56.0',lon:'-4.0',type:'golf_course'}
];
const hRank=[...highlands].sort((a,b)=>score(b,"Campbell's Scottish Highlands",[],'Scottish Highlands')-score(a,"Campbell's Scottish Highlands",[],'Scottish Highlands'));
assert(/Salem|New Hampshire/i.test(hRank[0].display_name),'Campbell’s Highlands prefers Salem NH over UK false match');

// Region warm-up still helps when names are ambiguous.
const ambiguous=[
  {__q:'Oak Hills golf course',display_name:'Oak Hills Golf Course, California, United States',lat:'34.0',lon:'-118.0',type:'golf_course'},
  {__q:'Oak Hills golf course',display_name:'Oak Hills Golf Course, New Hampshire, United States',lat:'42.9',lon:'-71.5',type:'golf_course'}
];
const neCentroids=[[-71.3,42.7]];
const aRank=[...ambiguous].sort((a,b)=>score(b,'Oak Hills',neCentroids,'')-score(a,'Oak Hills',neCentroids,''));
assert(/New Hampshire/i.test(aRank[0].display_name),'Region centroid bias prefers nearby NE course');

console.log(JSON.stringify({pass:passes.length,failures},null,2));
if(failures.length)process.exit(1);
