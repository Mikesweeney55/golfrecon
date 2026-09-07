from pathlib import Path
import re, subprocess

p=Path('index.html')
s=p.read_text()

def must(old,new,count=1,label='anchor'):
    global s
    if old not in s:
        raise SystemExit(f'v12.9 patch failed: missing {label}')
    s=s.replace(old,new,count)

must('<title>GolfRecon v12.8 Beta</title>','<title>GolfRecon v12.9 Beta</title>',1,'title')
s=s.replace('v12.8 Beta','v12.9 Beta')

css=r'''
/* v12.9 Satellite Course Preview */
.satellite-stack{position:absolute;inset:0;overflow:hidden;background:#101410}
.satellite-tile{position:absolute;width:256px;height:256px;max-width:none;pointer-events:none;user-select:none;-webkit-user-drag:none}
.satellite-overlay{position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none}
.sat-fairway{fill:rgba(184,234,104,.055);stroke:rgba(184,234,104,.68);stroke-width:2.2;vector-effect:non-scaling-stroke}
.sat-green{fill:rgba(184,234,104,.18);stroke:rgba(211,255,145,.95);stroke-width:2.5;vector-effect:non-scaling-stroke}
.sat-bunker{fill:rgba(255,212,0,.12);stroke:rgba(255,224,111,.92);stroke-width:2;vector-effect:non-scaling-stroke}
.sat-water{fill:rgba(68,169,238,.11);stroke:rgba(103,194,255,.86);stroke-width:2;vector-effect:non-scaling-stroke}
.sat-tee{fill:rgba(184,234,104,.14);stroke:rgba(184,234,104,.92);stroke-width:2.2;vector-effect:non-scaling-stroke}
.sat-other{fill:transparent;stroke:rgba(255,255,255,.22);stroke-width:1.2;vector-effect:non-scaling-stroke}
.sat-hole-line{fill:none;stroke:#d7ff9f;stroke-width:3;stroke-dasharray:8 6;vector-effect:non-scaling-stroke;filter:drop-shadow(0 1px 2px rgba(0,0,0,.85))}
.sat-tee-dot{fill:#b8ea68;stroke:#08110d;stroke-width:2.5;vector-effect:non-scaling-stroke}.sat-pin{fill:#fff;stroke:#08110d;stroke-width:2.5;vector-effect:non-scaling-stroke}
.sat-label{fill:#fff;font-size:12px;font-weight:900;paint-order:stroke;stroke:#07100c;stroke-width:4px;stroke-linejoin:round}
.satellite-north{position:absolute;right:10px;bottom:10px;z-index:2;background:rgba(5,12,9,.74);border:1px solid rgba(255,255,255,.18);border-radius:9px;padding:5px 7px;color:#fff;font-size:10px;font-weight:900;backdrop-filter:blur(5px)}
.preview-map-head{z-index:3}
'''
must('</style>',css+'\n</style>',1,'style end')

anchor='async function ensureCoursePreviewLoaded(courseId,hole){'
if anchor not in s:
    raise SystemExit('v12.9 patch failed: Course Preview helper anchor missing')

satellite_js=r'''
function mercatorWorldPixel(pt,z){
  const lon=Number(pt?.[0]),lat0=Number(pt?.[1]);
  if(!Number.isFinite(lon)||!Number.isFinite(lat0))return [0,0];
  const lat=Math.max(-85.05112878,Math.min(85.05112878,lat0));
  const size=256*Math.pow(2,z);
  const sin=Math.sin(lat*Math.PI/180);
  return [
    (lon+180)/360*size,
    (0.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*size
  ];
}
function satelliteHoleMap(geom){
  if(!geom?.holePts?.length)return '';
  const all=geom.elements.flatMap(osmElementPoints);
  if(!all.length)return '';
  const W=720,H=440,padX=64,padY=54;
  let z=18,bounds=null;
  for(let candidate=20;candidate>=14;candidate--){
    const px=all.map(p=>mercatorWorldPixel(p,candidate));
    const minX=Math.min(...px.map(p=>p[0])),maxX=Math.max(...px.map(p=>p[0]));
    const minY=Math.min(...px.map(p=>p[1])),maxY=Math.max(...px.map(p=>p[1]));
    if((maxX-minX)<=W-padX*2 && (maxY-minY)<=H-padY*2){z=candidate;bounds={minX,maxX,minY,maxY};break}
    if(candidate===14){z=candidate;bounds={minX,maxX,minY,maxY}}
  }
  if(!bounds)return '';
  const cx=(bounds.minX+bounds.maxX)/2,cy=(bounds.minY+bounds.maxY)/2;
  const originX=cx-W/2,originY=cy-H/2;
  const tileMinX=Math.floor(originX/256),tileMaxX=Math.floor((originX+W)/256);
  const tileMinY=Math.floor(originY/256),tileMaxY=Math.floor((originY+H)/256);
  const tileCount=Math.pow(2,z),tiles=[];
  for(let tx=tileMinX;tx<=tileMaxX;tx++)for(let ty=tileMinY;ty<=tileMaxY;ty++){
    if(ty<0||ty>=tileCount)continue;
    const wrapped=((tx%tileCount)+tileCount)%tileCount;
    const left=Math.round(tx*256-originX),top=Math.round(ty*256-originY);
    const src=`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${wrapped}`;
    tiles.push(`<img class="satellite-tile" alt="" draggable="false" src="${src}" style="left:${left}px;top:${top}px" loading="eager">`);
  }
  const project=p=>{const q=mercatorWorldPixel(p,z);return [q[0]-originX,q[1]-originY]};
  const path=pts=>pts.map((p,i)=>{const [x,y]=project(p);return `${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`}).join(' ');
  const order={other:0,water:1,fairway:2,tee:3,bunker:4,green:5};
  const shapes=[];
  const els=[...geom.elements].filter(e=>e!==geom.holeEl).sort((a,b)=>(order[osmFeatureKind(a)]||0)-(order[osmFeatureKind(b)]||0));
  for(const el of els){
    const kind=osmFeatureKind(el),groups=[];
    if(Array.isArray(el.geometry)&&el.geometry.length)groups.push(osmElementPoints({geometry:el.geometry}));
    for(const mem of el.members||[]){const pts=osmElementPoints({geometry:mem.geometry});if(pts.length)groups.push(pts)}
    for(const pts of groups){
      if(pts.length<2)continue;
      const closed=pts.length>2&&pointDistanceMeters(pts[0],pts[pts.length-1])<8;
      shapes.push(`<path class="sat-${kind}" d="${path(pts)}${closed?' Z':''}"/>`);
    }
  }
  shapes.push(`<path class="sat-hole-line" d="${path(geom.holePts)}"/>`);
  const first=geom.holePts[0],last=geom.holePts[geom.holePts.length-1];
  const [tx,ty]=project(first),[gx,gy]=project(last);
  shapes.push(`<circle class="sat-tee-dot" cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="6"/>`);
  shapes.push(`<circle class="sat-pin" cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" r="6"/>`);
  const teeLabelY=ty<28?ty+23:ty-11,greenLabelY=gy<28?gy+23:gy-11;
  shapes.push(`<text class="sat-label" x="${(tx+9).toFixed(1)}" y="${teeLabelY.toFixed(1)}">TEE</text>`);
  shapes.push(`<text class="sat-label" x="${(gx+9).toFixed(1)}" y="${greenLabelY.toFixed(1)}">GREEN</text>`);
  return `<div class="satellite-stack">${tiles.join('')}<svg class="satellite-overlay" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Satellite view with GolfRecon hole overlay">${shapes.join('')}</svg><div class="satellite-north">N ↑</div></div>`;
}
'''
s=s.replace(anchor,satellite_js+'\n'+anchor,1)

must('const svg=osmHoleSvg(cached?.geom);','const mapHtml=satelliteHoleMap(cached?.geom);',1,'course preview map variable')
must("const mapBody=svg?svg:`<div class=\"preview-map-empty\"", "const mapBody=mapHtml?mapHtml:`<div class=\"preview-map-empty\"",1,'course preview map body')
s=s.replace(' · golf-specific map</span>',' · satellite + GolfRecon overlay</span>',1)
old_attr='''<div class="preview-attribution">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a></div>'''
new_attr='''<div class="preview-attribution">Satellite imagery © Esri · Golf geometry © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a></div>'''
must(old_attr,new_attr,1,'attribution')
old_note='''<div class="preview-osm-note">GolfRecon draws the hole from mapped golf features — fairway, green, bunkers, tees and water when available. Coverage varies by course.</div>'''
new_note='''<div class="preview-osm-note">Satellite imagery is the base. GolfRecon overlays the mapped hole line, tee, green, fairway, bunkers and water when OpenStreetMap has them.</div>'''
must(old_note,new_note,1,'preview note')

# Basic validation
for needle in ['GolfRecon v12.9 Beta','function satelliteHoleMap(geom)','World_Imagery/MapServer/tile','satellite + GolfRecon overlay','Satellite imagery © Esri']:
    if needle not in s: raise SystemExit(f'v12.9 validation failed: {needle}')

p.write_text(s)
scripts=re.findall(r'<script>(.*?)</script>',s,re.S)
Path('/tmp/golfrecon-v129.js').write_text('\n'.join(scripts))
r=subprocess.run(['node','--check','/tmp/golfrecon-v129.js'],capture_output=True,text=True)
if r.returncode:
    print(r.stderr)
    raise SystemExit('v12.9 frontend JavaScript syntax check failed')
print('GolfRecon v12.9 satellite Course Preview patch applied; JavaScript syntax OK.')
