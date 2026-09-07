from pathlib import Path
import re, subprocess

p=Path("index.html")
s=p.read_text()

def must_replace(old,new,count=1,label="replace"):
    global s
    if old not in s:
        raise SystemExit(f"v12.8 patch failed: missing anchor for {label}")
    s=s.replace(old,new,count)

must_replace("<title>GolfRecon v12.7 Beta</title>","<title>GolfRecon v12.8 Beta</title>",1,"title")
s=s.replace("v12.7 Beta","v12.8 Beta")

css = r"""
/* v12.8 Course Preview */
.hole-preview-btn,.hole-ref-link{border:1px solid rgba(184,234,104,.28);background:rgba(184,234,104,.07);color:var(--accent);border-radius:999px;font:inherit;font-size:10px;font-weight:850;padding:5px 8px;cursor:pointer;white-space:nowrap}
.hole-preview-btn:hover,.hole-ref-link:hover{background:rgba(184,234,104,.14)}
.hole-ref-link{display:inline;padding:2px 6px;margin:0 1px;vertical-align:baseline}
.preview-page-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.preview-back{border:0;background:none;color:var(--muted);font-size:11px;font-weight:850;padding:6px 0;cursor:pointer}
.hole-selector{display:flex;gap:6px;overflow-x:auto;padding:4px 0 10px;scrollbar-width:none}.hole-selector::-webkit-scrollbar{display:none}
.hole-selector button{flex:0 0 auto;width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--muted);font-weight:900;cursor:pointer}
.hole-selector button.active{border-color:rgba(184,234,104,.58);background:rgba(184,234,104,.12);color:var(--accent)}
.course-preview-map{position:relative;min-height:440px;border:1px solid var(--line);border-radius:20px;overflow:hidden;background:radial-gradient(circle at 50% 32%,#274432 0,#13251b 48%,#0c1711 100%);box-shadow:inset 0 0 70px rgba(0,0,0,.20)}
.course-preview-map svg{display:block;width:100%;height:440px}
.preview-map-head{position:absolute;z-index:2;top:12px;left:12px;right:12px;display:flex;justify-content:space-between;align-items:flex-start;pointer-events:none}
.preview-hole-title{background:rgba(7,16,12,.84);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:9px 11px}
.preview-hole-title strong{font-size:18px;display:block}.preview-hole-title span{font-size:10px;color:var(--muted)}
.preview-risk{pointer-events:none}
.osm-fairway{fill:#47785a;stroke:#7ca787;stroke-width:1.2}.osm-green{fill:#86ad70;stroke:#c7e5a3;stroke-width:1.5}.osm-bunker{fill:#c8b98e;stroke:#f1dfaa;stroke-width:1.1}.osm-water{fill:#416d86;stroke:#76abc8;stroke-width:1.2}.osm-tee{fill:#729460;stroke:#bad89e;stroke-width:1.2}.osm-hole-line{fill:none;stroke:#d7f5b7;stroke-width:2.4;stroke-dasharray:7 5;opacity:.9}.osm-other{fill:#315541;stroke:#5f7e69;stroke-width:1;opacity:.55}.osm-pin{fill:#d7f5b7;stroke:#08110d;stroke-width:2}.osm-tee-dot{fill:#b8ea68;stroke:#08110d;stroke-width:2}
.preview-map-empty{min-height:440px;display:grid;place-items:center;text-align:center;padding:42px 24px}.preview-map-empty strong{display:block;font-size:17px;margin-bottom:6px}.preview-map-empty span{font-size:11px;color:var(--muted);max-width:350px}
.preview-attribution{font-size:9px;color:var(--muted);margin:6px 4px 0;text-align:right}.preview-attribution a{color:inherit}
.preview-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.preview-stat{padding:12px;text-align:center}.preview-stat strong{display:block;font-size:20px}.preview-stat span{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}
.preview-current-card>.hole-card{outline:1px solid rgba(184,234,104,.48);box-shadow:0 0 0 2px rgba(184,234,104,.07)}
.preview-osm-note{font-size:10px;color:var(--muted);margin-top:7px}
button.score-box{font:inherit;color:inherit;padding:0;cursor:pointer}
button.score-box:hover{outline:1px solid rgba(184,234,104,.45)}
@media(max-width:640px){.course-preview-map,.course-preview-map svg,.preview-map-empty{min-height:360px;height:360px}.preview-stat-grid{grid-template-columns:repeat(2,1fr)}}
"""
must_replace("</style>",css+"\n</style>",1,"CSS")

m=re.search(r"let state = \{([^;]+)\};",s)
if not m:
    raise SystemExit("v12.8 patch failed: state object not found")
state_body=m.group(1)
if "coursePreviewHole" not in state_body:
    new_body=state_body.rstrip()+", coursePreviewHole:1, coursePreviewReturnView:'pregame', coursePreviewLoading:false, coursePreviewError:null"
    s=s[:m.start(1)]+new_body+s[m.end(1):]

must_replace("const app = document.getElementById('app');","const app = document.getElementById('app');\nconst coursePreviewCache=new Map();",1,"app cache")

m=re.search(r"function safeText\(s\)\{.*?\n\}",s,re.S)
if not m:
    raise SystemExit("v12.8 patch failed: safeText not found")

helpers = r"""
const OSM_NOMINATIM='https://nominatim.openstreetmap.org/search';
const OSM_OVERPASS='https://overpass-api.de/api/interpreter';

function cleanCourseForMap(name){
  return String(name||'')
    .replace(/[—–]\s*(Blue|Green)\b.*$/i,'')
    .replace(/\b(Front|Back)\s*9\b/ig,'')
    .replace(/\b(9|18)\s*holes?\b/ig,'')
    .replace(/\bScot\.\b/ig,'Scottish')
    .replace(/\s+/g,' ').trim();
}
function holeLinkifyHtml(htmlText){
  return String(htmlText||'')
    .replace(/\bHole\s+([1-9]|[12]\d|3[0-6])\b/gi,(m,n)=>`<button class="hole-ref-link" type="button" data-hole-preview="${n}">${m} ↗</button>`)
    .replace(/(^|[\s(>])#([1-9]|[12]\d|3[0-6])\b/g,(m,p,n)=>`${p}<button class="hole-ref-link" type="button" data-hole-preview="${n}">#${n} ↗</button>`);
}
function holeLinkifyPlain(v){return holeLinkifyHtml(safeText(v))}
function osmElementPoints(el){
  const pts=[];
  const add=g=>{if(Array.isArray(g))g.forEach(p=>{if(Number.isFinite(Number(p?.lat))&&Number.isFinite(Number(p?.lon)))pts.push([Number(p.lon),Number(p.lat)])})};
  add(el?.geometry);
  (el?.members||[]).forEach(m=>add(m?.geometry));
  if(!pts.length && Number.isFinite(Number(el?.lon))&&Number.isFinite(Number(el?.lat)))pts.push([Number(el.lon),Number(el.lat)]);
  return pts;
}
function osmHoleNumber(el){
  const t=el?.tags||{};
  for(const v of [t.ref,t.hole,t.number,t['golf:hole'],t.name]){
    const m=String(v||'').match(/(?:hole\s*)?(\d{1,2})\b/i);
    if(m)return Number(m[1]);
  }
  return null;
}
function osmFeatureKind(el){
  const t=el?.tags||{},g=String(t.golf||'').toLowerCase();
  if(g==='fairway')return 'fairway';
  if(g==='green')return 'green';
  if(g==='bunker')return 'bunker';
  if(g==='tee')return 'tee';
  if(g==='water_hazard'||g==='lateral_water_hazard'||t.natural==='water'||t.water)return 'water';
  return 'other';
}
function pointDistanceMeters(a,b){
  const lat=((a[1]+b[1])/2)*Math.PI/180;
  const dx=(a[0]-b[0])*111320*Math.cos(lat),dy=(a[1]-b[1])*110540;
  return Math.hypot(dx,dy);
}
function distanceToHole(points,holePts){
  let best=Infinity;
  for(const p of points)for(const h of holePts)best=Math.min(best,pointDistanceMeters(p,h));
  return best;
}
async function osmFetchJson(url,opts={}){
  const r=await fetch(url,{...opts,headers:{Accept:'application/json',...(opts.headers||{})}});
  if(!r.ok)throw new Error(`Course map service returned ${r.status}`);
  return r.json();
}
async function geocodeGolfCourse(c){
  const key=`geo:${c.id}`;
  if(coursePreviewCache.has(key))return coursePreviewCache.get(key);
  const base=cleanCourseForMap(c.baseName||c.name);
  const tries=[`${base} golf course`,base];
  let candidates=[];
  for(const q of tries){
    const url=`${OSM_NOMINATIM}?format=jsonv2&limit=6&countrycodes=us&q=${encodeURIComponent(q)}`;
    const data=await osmFetchJson(url);
    if(Array.isArray(data)&&data.length){candidates=data;break}
  }
  if(!candidates.length)throw new Error('Course location was not found in OpenStreetMap.');
  const score=x=>{
    const d=String(x.display_name||'');
    const nameScore=typeof courseNameScore==='function'?courseNameScore(base,d):0;
    const golfBonus=/golf|country club/i.test(d)?15:0;
    return nameScore+golfBonus;
  };
  candidates.sort((a,b)=>score(b)-score(a));
  const best=candidates[0];
  const result={lat:Number(best.lat),lon:Number(best.lon),displayName:best.display_name};
  coursePreviewCache.set(key,result);
  return result;
}
async function loadOsmCourse(c){
  const key=`osm:${c.id}`;
  if(coursePreviewCache.has(key))return coursePreviewCache.get(key);
  const geo=await geocodeGolfCourse(c);
  const q=`[out:json][timeout:25];
(
 way(around:2800,${geo.lat},${geo.lon})["golf"~"^(hole|fairway|green|bunker|tee|water_hazard|lateral_water_hazard)$"];
 relation(around:2800,${geo.lat},${geo.lon})["golf"~"^(hole|fairway|green|bunker|tee|water_hazard|lateral_water_hazard)$"];
 way(around:2200,${geo.lat},${geo.lon})["natural"="water"];
 relation(around:2200,${geo.lat},${geo.lon})["natural"="water"];
);
out geom tags;`;
  const data=await osmFetchJson(OSM_OVERPASS,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:`data=${encodeURIComponent(q)}`});
  const elements=Array.isArray(data?.elements)?data.elements:[];
  const result={geo,elements};
  coursePreviewCache.set(key,result);
  return result;
}
function selectedHoleGeometry(courseData,hole){
  const elements=courseData?.elements||[];
  const holes=elements.filter(e=>String(e?.tags?.golf||'').toLowerCase()==='hole' && osmElementPoints(e).length>=2);
  let holeEl=holes.find(e=>osmHoleNumber(e)===Number(hole));
  if(!holeEl){
    const numbered=holes.filter(e=>osmHoleNumber(e)!=null).sort((a,b)=>osmHoleNumber(a)-osmHoleNumber(b));
    holeEl=numbered.find(e=>osmHoleNumber(e)===Number(hole));
  }
  if(!holeEl && holes.length>=Number(hole))holeEl=holes[Number(hole)-1];
  if(!holeEl)return null;
  const holePts=osmElementPoints(holeEl);
  const nearby=elements.filter(e=>{
    if(e===holeEl)return true;
    const pts=osmElementPoints(e);
    if(!pts.length)return false;
    const kind=osmFeatureKind(e);
    const limit=kind==='water'?135:105;
    return distanceToHole(pts,holePts)<=limit;
  });
  return {holeEl,holePts,elements:nearby};
}
function osmHoleSvg(geom){
  if(!geom?.holePts?.length)return '';
  const all=geom.elements.flatMap(osmElementPoints);
  if(!all.length)return '';
  const first=geom.holePts[0],last=geom.holePts[geom.holePts.length-1];
  const centerLon=all.reduce((a,p)=>a+p[0],0)/all.length;
  const centerLat=all.reduce((a,p)=>a+p[1],0)/all.length;
  const cos=Math.cos(centerLat*Math.PI/180);
  const metric=p=>[(p[0]-centerLon)*111320*cos,(p[1]-centerLat)*110540];
  const a=metric(first),b=metric(last);
  const theta=Math.atan2(b[1]-a[1],b[0]-a[0]);
  const phi=Math.PI/2-theta,cp=Math.cos(phi),sp=Math.sin(phi);
  const rot=p=>{const [x,y]=metric(p);return [x*cp-y*sp,x*sp+y*cp]};
  const rotated=all.map(rot);
  let minX=Math.min(...rotated.map(p=>p[0])),maxX=Math.max(...rotated.map(p=>p[0]));
  let minY=Math.min(...rotated.map(p=>p[1])),maxY=Math.max(...rotated.map(p=>p[1]));
  const width=Math.max(60,maxX-minX),height=Math.max(140,maxY-minY);
  minX-=(width*.12);maxX+=(width*.12);minY-=(height*.08);maxY+=(height*.08);
  const W=720,H=440;
  const project=p=>{const [x,y]=rot(p);return [30+(x-minX)/(maxX-minX)*(W-60),H-24-(y-minY)/(maxY-minY)*(H-48)]};
  const path=pts=>pts.map((p,i)=>{const [x,y]=project(p);return `${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`}).join(' ');
  const shapes=[];
  const order={other:0,water:1,fairway:2,tee:3,bunker:4,green:5};
  const els=[...geom.elements].filter(e=>e!==geom.holeEl).sort((x,y)=>(order[osmFeatureKind(x)]||0)-(order[osmFeatureKind(y)]||0));
  for(const el of els){
    const kind=osmFeatureKind(el);
    const groups=[];
    if(Array.isArray(el.geometry)&&el.geometry.length)groups.push(osmElementPoints({geometry:el.geometry}));
    for(const mem of el.members||[]){
      const pts=osmElementPoints({geometry:mem.geometry});
      if(pts.length)groups.push(pts);
    }
    for(const pts of groups){
      if(pts.length<2)continue;
      const closed=pts.length>2 && pointDistanceMeters(pts[0],pts[pts.length-1])<8;
      shapes.push(`<path class="osm-${kind}" d="${path(pts)}${closed?' Z':''}"/>`);
    }
  }
  shapes.push(`<path class="osm-hole-line" d="${path(geom.holePts)}"/>`);
  const [tx,ty]=project(first),[gx,gy]=project(last);
  shapes.push(`<circle class="osm-tee-dot" cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="5"/>`);
  shapes.push(`<circle class="osm-pin" cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" r="5"/>`);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="OpenStreetMap golf hole geometry">${shapes.join('')}</svg>`;
}
async function ensureCoursePreviewLoaded(courseId,hole){
  const c=course(courseId); if(!c||state.view!=='coursePreview')return;
  const key=`preview:${courseId}:${hole}`;
  if(coursePreviewCache.has(key)||state.coursePreviewLoading)return;
  state.coursePreviewLoading=true;state.coursePreviewError=null;
  const map=document.getElementById('coursePreviewMapBody');
  if(map)map.innerHTML=`<div class="preview-map-empty"><div><strong>Loading Hole ${hole}…</strong><span>Finding golf-specific OpenStreetMap geometry.</span></div></div>`;
  try{
    const courseData=await loadOsmCourse(c);
    const geom=selectedHoleGeometry(courseData,hole);
    coursePreviewCache.set(key,{courseData,geom});
    if(!geom)state.coursePreviewError='OpenStreetMap does not have mapped hole geometry for this hole yet.';
  }catch(e){
    state.coursePreviewError=e.message||String(e);
    coursePreviewCache.set(key,{courseData:null,geom:null,error:state.coursePreviewError});
  }finally{
    state.coursePreviewLoading=false;
    if(state.view==='coursePreview')render();
  }
}
window.openHolePreview=(hole,courseId=state.selectedCourseId)=>{
  if(!course(courseId))return;
  if(state.view!=='coursePreview')state.coursePreviewReturnView=state.view;
  state.selectedCourseId=courseId;
  state.gameCourseId=courseId;
  state.roundCourseId=courseId;
  state.coursePreviewHole=Number(hole)||1;
  state.coursePreviewError=null;
  state.view='coursePreview';
  refreshGlobalCourseSelector();
  render();
};
window.closeCoursePreview=()=>{state.view=state.coursePreviewReturnView||'pregame';render()};
window.selectCoursePreviewHole=hole=>{state.coursePreviewHole=Number(hole)||1;state.coursePreviewError=null;render()};
"""
s=s[:m.end()]+helpers+s[m.end():]

idx=s.find("function groupsView(){")
if idx<0:
    raise SystemExit("v12.8 patch failed: groupsView not found")
view=r"""
function coursePreviewView(){
  const c=course(state.selectedCourseId);
  if(!c)return `<div class="card">Course not found.</div>`;
  const holes=(c.holeNumbers?.length?c.holeNumbers:c.pars?.map((_,i)=>i+1)||[]);
  if(!holes.length)holes.push(...Array.from({length:18},(_,i)=>i+1));
  let hole=Number(state.coursePreviewHole)||Number(holes[0])||1;
  if(!holes.map(Number).includes(hole))hole=Number(holes[0])||1;
  state.coursePreviewHole=hole;
  const mem=holeMemory(c.id),h=mem.find(x=>Number(x.hole)===hole);
  const last=h?holeLastRound(c.id,hole):null;
  const cached=coursePreviewCache.get(`preview:${c.id}:${hole}`);
  const svg=osmHoleSvg(cached?.geom);
  const avgScore=h?.avgScore;
  const over=(h&&Number.isFinite(h.avgScore)&&Number.isFinite(h.par))?h.avgScore-h.par:null;
  const emptyMsg=state.coursePreviewError||cached?.error||'GolfRecon is checking the free OpenStreetMap golf-course data for this hole.';
  const mapBody=svg?svg:`<div class="preview-map-empty"><div><strong>${state.coursePreviewLoading?`Loading Hole ${hole}…`:'Hole geometry not available yet'}</strong><span>${safeText(emptyMsg)}</span></div></div>`;
  return `
    <div class="preview-page-head">
      <button class="preview-back" type="button" onclick="closeCoursePreview()">← Back</button>
      <div class="muted">${safeText(c.name)} · ${safeText(c.tees||'')} tees</div>
    </div>
    <div class="section-head"><div><div class="eyebrow">COURSE PREVIEW</div><h2>${safeText(c.name)}</h2></div></div>
    <div class="hole-selector">${holes.map(n=>`<button type="button" class="${Number(n)===hole?'active':''}" onclick="selectCoursePreviewHole(${Number(n)})">${n}</button>`).join('')}</div>
    <div class="course-preview-map">
      <div class="preview-map-head">
        <div class="preview-hole-title"><strong>Hole ${hole}</strong><span>Par ${h?.par??c.pars?.[holes.map(Number).indexOf(hole)]??'—'} · golf-specific map</span></div>
        ${h?`<span class="risk-dot preview-risk" title="${riskLabel(h)}">${riskLetter(h)}</span>`:''}
      </div>
      <div id="coursePreviewMapBody">${mapBody}</div>
    </div>
    <div class="preview-attribution">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a></div>
    <div class="preview-osm-note">GolfRecon draws the hole from mapped golf features — fairway, green, bunkers, tees and water when available. Coverage varies by course.</div>

    <div class="section-head"><div><div class="eyebrow">YOUR MEMORY</div><h2>Hole ${hole} stats</h2></div></div>
    ${h?`
      <div class="preview-stat-grid">
        <div class="card preview-stat"><strong>${h.played}</strong><span>Rounds</span></div>
        <div class="card preview-stat"><strong>${avgScore==null?'—':avgScore.toFixed(1)}</strong><span>Avg score</span></div>
        <div class="card preview-stat"><strong>${over==null?'—':`${over>=0?'+':''}${over.toFixed(1)}`}</strong><span>Vs par</span></div>
        <div class="card preview-stat"><strong>${h.doubleRate??'—'}${h.doubleRate!=null?'%':''}</strong><span>Double+</span></div>
        <div class="card preview-stat"><strong>${h.par===3?'—':(h.fw==null?'—':h.fw+'%')}</strong><span>Fairways</span></div>
        <div class="card preview-stat"><strong>${h.gir==null?'—':h.gir+'%'}</strong><span>GIR</span></div>
        <div class="card preview-stat"><strong>${h.putts==null?'—':h.putts.toFixed(1)}</strong><span>Avg putts</span></div>
        <div class="card preview-stat"><strong>${last?.score??'—'}</strong><span>Last score</span></div>
      </div>
      ${usefulHoleInsight(h)?`<div class="card" style="margin-top:8px"><div class="eyebrow">GOLFRECON READ</div><div style="margin-top:6px">${safeText(usefulHoleInsight(h))}</div></div>`:''}
    `:`<div class="card muted">No personal history on this hole yet.</div>`}

    <div class="section-head"><div><div class="eyebrow">COURSE MEMORY</div><h2>Hole-by-hole</h2></div></div>
    <div class="risk-legend"><span class="chip"><span class="risk-dot">L</span> Low risk</span><span class="chip"><span class="risk-dot" style="background:var(--warning);color:#2a2200">M</span> Medium risk</span><span class="chip"><span class="risk-dot" style="background:var(--danger);color:#fff">H</span> High risk</span></div>
    <div class="hole-grid">${mem.map(x=>`<div class="${Number(x.hole)===hole?'preview-current-card':''}">${renderHoleCard(x)}</div>`).join('')}</div>`;
}

"""
s=s[:idx]+view+s[idx:]

m=re.search(r"function renderHoleCard\(h,showPriority=false\)\{.*?\n\}",s,re.S)
if not m:
    raise SystemExit("v12.8 patch failed: renderHoleCard not found")
block=m.group(0)
old="""    <div class="hole-top">
      <div><span class="hole-number">${h.hole}</span> <span class="muted">Par ${h.par}</span></div>
      <span class="risk-dot" title="${riskLabel(h)}">${riskLetter(h)}</span>
    </div>"""
new="""    <div class="hole-top">
      <div><span class="hole-number">${h.hole}</span> <span class="muted">Par ${h.par}</span></div>
      <div style="display:flex;align-items:center;gap:6px"><button class="hole-preview-btn" type="button" data-hole-preview="${h.hole}">⛳ View</button><span class="risk-dot" title="${riskLabel(h)}">${riskLetter(h)}</span></div>
    </div>"""
if old not in block:
    raise SystemExit("v12.8 patch failed: renderHoleCard top anchor not found")
block=block.replace(old,new,1)
s=s[:m.start()]+block+s[m.end():]

m=re.search(r"function chatText\(s\)\{.*?\n\}",s,re.S)
if not m:
    raise SystemExit("v12.8 patch failed: chatText not found")
block=m.group(0)
if "return holeLinkifyHtml(out);" not in block:
    if "return out;" not in block:
        raise SystemExit("v12.8 patch failed: chatText return anchor not found")
    block=block.replace("return out;","return holeLinkifyHtml(out);",1)
s=s[:m.start()]+block+s[m.end():]

m=re.search(r"function pregame\(\)\{.*?\n\}",s,re.S)
if not m:
    raise SystemExit("v12.8 patch failed: pregame not found")
block=m.group(0)
block=block.replace(
    """<strong>${k.title}</strong><span class="muted">${k.text}</span>""",
    """<strong>${holeLinkifyPlain(k.title)}</strong><span class="muted">${holeLinkifyPlain(k.text)}</span>"""
)
block=block.replace(
    """<div class="score-strip">${latest.scores.map((s,i)=>`<div class="score-box ${scoreClass(s,c.pars[i])}" title="Hole ${c.holeNumbers?.[i]??i+1} · Par ${c.pars[i]}">${s}</div>`).join('')}</div>""",
    """<div class="score-strip">${latest.scores.map((s,i)=>`<button type="button" class="score-box ${scoreClass(s,c.pars[i])}" data-hole-preview="${c.holeNumbers?.[i]??i+1}" title="View Hole ${c.holeNumbers?.[i]??i+1} · Par ${c.pars[i]}">${s}</button>`).join('')}</div>"""
)
s=s[:m.start()]+block+s[m.end():]

old="app.innerHTML=state.view==='pregame'?pregame():state.view==='rounds'?roundsView():state.view==='groups'?groupsView():myGame();"
new="app.innerHTML=state.view==='pregame'?pregame():state.view==='rounds'?roundsView():state.view==='groups'?groupsView():state.view==='coursePreview'?coursePreviewView():myGame();"
must_replace(old,new,1,"render switch")

m=re.search(r"function render\(\)\{.*?\n\}",s,re.S)
if not m:
    raise SystemExit("v12.8 patch failed: render not found")
block=m.group(0)
anchor=" document.querySelectorAll('[data-round-action]').forEach"
if anchor not in block:
    raise SystemExit("v12.8 patch failed: render round action anchor not found")
handler=""" document.querySelectorAll('[data-hole-preview]').forEach(b=>b.addEventListener('click',e=>{
   e.preventDefault();e.stopPropagation();openHolePreview(Number(b.dataset.holePreview),state.selectedCourseId);
 }));
"""
block=block.replace(anchor,handler+anchor,1)
last=block.rfind("\n}")
block=block[:last]+"""
 if(state.view==='coursePreview'){
   requestAnimationFrame(()=>ensureCoursePreviewLoaded(state.selectedCourseId,state.coursePreviewHole));
 }
"""+block[last:]
s=s[:m.start()]+block+s[m.end():]

for needle in [
    "GolfRecon v12.8 Beta",
    "function coursePreviewView()",
    "openHolePreview",
    "OSM_OVERPASS",
    "data-hole-preview",
    "state.view==='coursePreview'?coursePreviewView()"
]:
    if needle not in s:
        raise SystemExit(f"v12.8 patch failed validation: {needle}")

p.write_text(s)
scripts=re.findall(r"<script>(.*?)</script>",s,re.S)
Path("/tmp/golfrecon-v128.js").write_text("\n".join(scripts))
r=subprocess.run(["node","--check","/tmp/golfrecon-v128.js"],capture_output=True,text=True)
if r.returncode:
    print(r.stderr)
    raise SystemExit("Frontend JavaScript syntax check failed")
print("GolfRecon v12.8 patch applied and JS syntax check passed.")
