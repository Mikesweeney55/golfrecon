from pathlib import Path
import re, subprocess

p=Path('index.html')
s=p.read_text()

# Version
s=s.replace('GolfRecon v13.0 Beta','GolfRecon v13.1 Beta')
s=s.replace('v13.0 Beta','v13.1 Beta')

# Mapbox GL assets
if 'mapbox-gl-js/v3.14.0/mapbox-gl.css' not in s:
    s=s.replace('</title>', '</title>\n  <link href="https://api.mapbox.com/mapbox-gl-js/v3.14.0/mapbox-gl.css" rel="stylesheet">\n  <script src="https://api.mapbox.com/mapbox-gl-js/v3.14.0/mapbox-gl.js"></script>', 1)

# Interactive map CSS
css = r'''
/* v13.1 Interactive Course Preview */
.course-preview-map{height:520px;min-height:520px}
#coursePreviewMap{position:absolute;inset:0;width:100%;height:100%;z-index:0}
.course-preview-map .mapboxgl-map{font:inherit}
.course-preview-map .mapboxgl-ctrl-top-right{top:76px;right:6px}
.course-preview-map .mapboxgl-ctrl-group{border-radius:11px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.35)}
.course-preview-map .mapboxgl-ctrl button{width:34px;height:34px}
.course-preview-map .mapboxgl-ctrl-attrib{background:rgba(5,12,9,.72);color:#dce6e1}
.course-preview-map .mapboxgl-ctrl-attrib a{color:#dce6e1}
.preview-map-tools{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px;font-size:10px;color:var(--muted)}
.preview-map-tools button{border:1px solid var(--line);background:#13211b;color:var(--text);border-radius:999px;padding:6px 10px;font-size:10px;font-weight:850}
.preview-map-tools span{min-width:0}
.preview-hero-grid{grid-template-columns:minmax(0,1fr) 258px}
.preview-side-card{min-height:41px}
.preview-read-card{min-height:88px}
@media(max-width:760px){.course-preview-map{height:430px;min-height:430px}.preview-map-tools{align-items:flex-start;flex-direction:column}.preview-map-tools button{align-self:flex-start}}
'''
if 'v13.1 Interactive Course Preview' not in s:
    s=s.replace('</style>', css+'\n</style>', 1)

# Add interactive map helpers immediately before ensureCoursePreviewLoaded
anchor='async function ensureCoursePreviewLoaded(courseId,hole){'
if anchor not in s:
    raise SystemExit('missing ensureCoursePreviewLoaded anchor')
helpers = r'''
let coursePreviewMapInstance=null;
let coursePreviewMapFocusBounds=null;
function destroyCoursePreviewMap(){
  if(coursePreviewMapInstance){try{coursePreviewMapInstance.remove()}catch{}coursePreviewMapInstance=null;}
  coursePreviewMapFocusBounds=null;
}
function ptsCentroid(pts){
  if(!pts?.length)return null;
  return [pts.reduce((a,p)=>a+Number(p[0]),0)/pts.length,pts.reduce((a,p)=>a+Number(p[1]),0)/pts.length];
}
function elementCentroid(el){return ptsCentroid(osmElementPoints(el))}
function meterXY(p,origin){
  const lat=((Number(p[1])+Number(origin[1]))/2)*Math.PI/180;
  return [(Number(p[0])-Number(origin[0]))*111320*Math.cos(lat),(Number(p[1])-Number(origin[1]))*110540];
}
function pointSegmentDistanceMeters(p,a,b){
  const origin=a,A=[0,0],B=meterXY(b,origin),P=meterXY(p,origin);
  const vx=B[0],vy=B[1],wx=P[0],wy=P[1],den=vx*vx+vy*vy;
  const t=den?Math.max(0,Math.min(1,(wx*vx+wy*vy)/den)):0;
  return Math.hypot(wx-t*vx,wy-t*vy);
}
function pointPolylineDistanceMeters(p,line){
  if(!line?.length)return Infinity;if(line.length===1)return pointDistanceMeters(p,line[0]);
  let best=Infinity;for(let i=1;i<line.length;i++)best=Math.min(best,pointSegmentDistanceMeters(p,line[i-1],line[i]));return best;
}
function nearestKindElement(geom,kind,target,maxDist=140){
  let best=null,bestD=Infinity;
  for(const el of geom?.elements||[]){if(osmFeatureKind(el)!==kind)continue;const c=elementCentroid(el);if(!c)continue;const d=pointDistanceMeters(c,target);if(d<bestD){bestD=d;best=el}}
  return bestD<=maxDist?best:null;
}
function pointInRing(point,ring){
  if(!ring?.length)return false;let inside=false;const x=point[0],y=point[1];
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
    const hit=((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/((yj-yi)||1e-12)+xi);if(hit)inside=!inside;
  }
  return inside;
}
function orientedHoleContext(geom){
  let path=[...(geom?.holePts||[])];if(path.length<2)return null;
  let start=path[0],end=path[path.length-1];
  const teeAtStart=nearestKindElement(geom,'tee',start),teeAtEnd=nearestKindElement(geom,'tee',end);
  const ds=teeAtStart?pointDistanceMeters(elementCentroid(teeAtStart),start):Infinity;
  const de=teeAtEnd?pointDistanceMeters(elementCentroid(teeAtEnd),end):Infinity;
  if(de+5<ds){path.reverse();start=path[0];end=path[path.length-1];}
  const teeEl=nearestKindElement(geom,'tee',start,120);
  const greenEl=nearestKindElement(geom,'green',end,150);
  const tee=elementCentroid(teeEl)||start,green=elementCentroid(greenEl)||end;
  return {path,start:tee,end:green,teeEl,greenEl};
}
function primaryFairwayElement(geom,ctx){
  const fairways=(geom?.elements||[]).filter(el=>osmFeatureKind(el)==='fairway'&&osmElementPoints(el).length>=3);
  if(!fairways.length)return null;
  const mid=ctx.path[Math.floor(ctx.path.length/2)]||[(ctx.start[0]+ctx.end[0])/2,(ctx.start[1]+ctx.end[1])/2];
  const containing=fairways.find(el=>pointInRing(mid,osmElementPoints(el)));
  if(containing)return containing;
  return fairways.map(el=>({el,d:pointPolylineDistanceMeters(elementCentroid(el),ctx.path)})).sort((a,b)=>a.d-b.d)[0]?.el||null;
}
function fairwayCenterLine(fairway,start,end){
  const ring=osmElementPoints(fairway);if(ring.length<4)return [];
  const origin=start,B=meterXY(end,origin),len=Math.hypot(B[0],B[1]);if(len<30)return [];
  const ux=B[0]/len,uy=B[1]/len,vx=-uy,vy=ux;
  const local=p=>{const q=meterXY(p,origin);return [q[0]*ux+q[1]*uy,q[0]*vx+q[1]*vy]};
  const toLL=([x,y])=>{const east=x*ux+y*vx,north=x*uy+y*vy,lat=origin[1]+north/110540,lon=origin[0]+east/(111320*Math.cos(((origin[1]+lat)/2)*Math.PI/180));return [lon,lat]};
  const poly=ring.map(local),out=[start];
  for(let k=1;k<=9;k++){
    const x=len*k/10,ys=[];
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[j],b=poly[i];if((a[0]<=x&&b[0]>=x)||(b[0]<=x&&a[0]>=x)){
        const dx=b[0]-a[0];if(Math.abs(dx)<1e-6)continue;const t=(x-a[0])/dx;if(t>=0&&t<=1)ys.push(a[1]+t*(b[1]-a[1]));
      }
    }
    if(ys.length>=2){ys.sort((a,b)=>a-b);out.push(toLL([x,(ys[0]+ys[ys.length-1])/2]));}
  }
  out.push(end);return out.length>=4?out:[];
}
function focusedPreviewElements(geom,ctx,fairway,playLine){
  const keep=[];if(fairway)keep.push(fairway);if(ctx.teeEl&&!keep.includes(ctx.teeEl))keep.push(ctx.teeEl);if(ctx.greenEl&&!keep.includes(ctx.greenEl))keep.push(ctx.greenEl);
  for(const el of geom?.elements||[]){
    const kind=osmFeatureKind(el);if(!['bunker','water'].includes(kind))continue;const c=elementCentroid(el);if(!c)continue;
    if(pointPolylineDistanceMeters(c,playLine.length?playLine:ctx.path)<=58)keep.push(el);
  }
  return keep;
}
function elementFeatures(el){
  const kind=osmFeatureKind(el),features=[];
  const add=pts=>{if(!pts||pts.length<2)return;let coords=pts.map(p=>[Number(p[0]),Number(p[1])]);const areaKind=['fairway','green','bunker','tee','water'].includes(kind);if(areaKind&&coords.length>=3){const a=coords[0],b=coords[coords.length-1];if(a[0]!==b[0]||a[1]!==b[1])coords=[...coords,a];features.push({type:'Feature',properties:{kind},geometry:{type:'Polygon',coordinates:[coords]}})}else features.push({type:'Feature',properties:{kind},geometry:{type:'LineString',coordinates:coords}})};
  if(Array.isArray(el?.geometry)&&el.geometry.length)add(el.geometry.map(p=>[p.lon,p.lat]));
  for(const m of el?.members||[]){if(Array.isArray(m?.geometry)&&m.geometry.length)add(m.geometry.map(p=>[p.lon,p.lat]));}
  if(!features.length){const pts=osmElementPoints(el);if(pts.length)add(pts)}
  return features;
}
function buildCoursePreviewGeoJSON(geom){
  const ctx=orientedHoleContext(geom);if(!ctx)return null;
  const fairway=primaryFairwayElement(geom,ctx);
  const center=fairwayCenterLine(fairway,ctx.start,ctx.end);
  const playLine=center.length?center:[];
  const focus=focusedPreviewElements(geom,ctx,fairway,playLine);
  const features=[];focus.forEach(el=>features.push(...elementFeatures(el)));
  if(playLine.length)features.push({type:'Feature',properties:{kind:'playline'},geometry:{type:'LineString',coordinates:playLine}});
  features.push({type:'Feature',properties:{kind:'marker',label:'TEE'},geometry:{type:'Point',coordinates:ctx.start}});
  features.push({type:'Feature',properties:{kind:'marker',label:'GREEN'},geometry:{type:'Point',coordinates:ctx.end}});
  const focusPoints=[ctx.start,ctx.end,...(fairway?osmElementPoints(fairway):ctx.path)];
  return {collection:{type:'FeatureCollection',features},focusPoints,ctx,fairway,playLine};
}
function previewBounds(points){
  if(!points?.length)return null;let minLon=Infinity,minLat=Infinity,maxLon=-Infinity,maxLat=-Infinity;
  points.forEach(p=>{minLon=Math.min(minLon,p[0]);maxLon=Math.max(maxLon,p[0]);minLat=Math.min(minLat,p[1]);maxLat=Math.max(maxLat,p[1])});
  return [[minLon,minLat],[maxLon,maxLat]];
}
function fitCoursePreviewMap(extraZoom=true){
  if(!coursePreviewMapInstance||!coursePreviewMapFocusBounds)return;
  try{const camera=coursePreviewMapInstance.cameraForBounds(coursePreviewMapFocusBounds,{padding:{top:24,bottom:24,left:22,right:22}});if(camera){if(extraZoom)camera.zoom=Math.min(19.5,(camera.zoom||18)+0.35);coursePreviewMapInstance.jumpTo(camera)}}catch{}
}
window.resetCoursePreviewMap=()=>fitCoursePreviewMap(false);
function initInteractiveCourseMap(){
  if(state.view!=='coursePreview')return;
  const container=document.getElementById('coursePreviewMap'),token=mapboxToken();if(!container||!token||!window.mapboxgl)return;
  const cached=coursePreviewCache.get(`preview:${state.selectedCourseId}:${state.coursePreviewHole}`);if(!cached?.geom)return;
  const built=buildCoursePreviewGeoJSON(cached.geom);if(!built)return;
  destroyCoursePreviewMap();
  window.mapboxgl.accessToken=token;
  const center=ptsCentroid(built.focusPoints)||built.ctx.start;
  const map=new window.mapboxgl.Map({container,style:'mapbox://styles/mapbox/satellite-v9',center,zoom:18.2,bearing:0,pitch:0,attributionControl:false,dragRotate:false,pitchWithRotate:false,touchPitch:false,maxZoom:20.5});
  coursePreviewMapInstance=map;coursePreviewMapFocusBounds=previewBounds(built.focusPoints);
  map.addControl(new window.mapboxgl.NavigationControl({showCompass:true,showZoom:true,visualizePitch:false}),'top-right');
  map.addControl(new window.mapboxgl.AttributionControl({compact:true}),'bottom-right');
  map.on('load',()=>{
    if(coursePreviewMapInstance!==map)return;
    map.addSource('golfiq-hole',{type:'geojson',data:built.collection});
    const fill=(id,kind,color,opacity)=>map.addLayer({id,type:'fill',source:'golfiq-hole',filter:['==',['get','kind'],kind],paint:{'fill-color':color,'fill-opacity':opacity,'fill-outline-color':color}});
    fill('golfiq-fairway','fairway','#b8ea68',0.05);
    fill('golfiq-water','water','#47aef2',0.12);
    fill('golfiq-bunker','bunker','#ffe06b',0.14);
    fill('golfiq-tee','tee','#b8ea68',0.10);
    fill('golfiq-green','green','#d7ff9f',0.16);
    map.addLayer({id:'golfiq-playline',type:'line',source:'golfiq-hole',filter:['==',['get','kind'],'playline'],paint:{'line-color':'#d7ff9f','line-width':3,'line-opacity':0.9,'line-dasharray':[2,2]}});
    map.addLayer({id:'golfiq-markers',type:'circle',source:'golfiq-hole',filter:['==',['get','kind'],'marker'],paint:{'circle-radius':6,'circle-color':['case',['==',['get','label'],'TEE'],'#b8ea68','#ffffff'],'circle-stroke-color':'#07100c','circle-stroke-width':2}});
    map.addLayer({id:'golfiq-labels',type:'symbol',source:'golfiq-hole',filter:['==',['get','kind'],'marker'],layout:{'text-field':['get','label'],'text-size':12,'text-offset':[0.9,0],'text-anchor':'left','text-allow-overlap':true},paint:{'text-color':'#ffffff','text-halo-color':'#07100c','text-halo-width':2}});
    fitCoursePreviewMap(true);
  });
}
'''
if 'function initInteractiveCourseMap()' not in s:
    s=s.replace(anchor, helpers+anchor, 1)

# Change preview map body from static tile compositor to interactive Mapbox GL container
old_block = """  const cached=coursePreviewCache.get(`preview:${c.id}:${hole}`);\n  const mapHtml=satelliteHoleMap(cached?.geom);\n  const avgScore=h?.avgScore;\n  const over=(h&&Number.isFinite(h.avgScore)&&Number.isFinite(h.par))?h.avgScore-h.par:null;\n  const emptyMsg=state.coursePreviewError||cached?.error||'GolfRecon is checking the golf-course data for this hole.';\n  const mapBody=mapHtml?mapHtml:`<div class=\"preview-map-empty\"><div><strong>${state.coursePreviewLoading?`Loading Hole ${hole}…`:'Hole geometry not available yet'}</strong><span>${safeText(emptyMsg)}</span></div></div>`;\n  const mb=mapboxToken();"""
new_block = """  const cached=coursePreviewCache.get(`preview:${c.id}:${hole}`);\n  const avgScore=h?.avgScore;\n  const over=(h&&Number.isFinite(h.avgScore)&&Number.isFinite(h.par))?h.avgScore-h.par:null;\n  const emptyMsg=state.coursePreviewError||cached?.error||'GolfRecon is checking the golf-course data for this hole.';\n  const mb=mapboxToken();\n  const mapReady=Boolean(mb&&cached?.geom);\n  const mapBody=mapReady?`<div id=\"coursePreviewMap\" aria-label=\"Interactive satellite view for Hole ${hole}\"></div>`:`<div class=\"preview-map-empty\"><div><strong>${state.coursePreviewLoading?`Loading Hole ${hole}…`:(!mb?'Mapbox token required':'Hole geometry not available yet')}</strong><span>${safeText(!mb?'Set your Mapbox token above to enable the interactive satellite hole view.':emptyMsg)}</span></div></div>`;"""
if old_block not in s:
    raise SystemExit('course preview map block anchor not found')
s=s.replace(old_block,new_block,1)

# Add interaction hint + recenter control, and update attribution text
old_attr='''        <div class="preview-attribution">Satellite imagery © Mapbox / providers · Golf geometry © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a></div>'''
new_attr='''        <div class="preview-map-tools"><span>Drag to pan · scroll or pinch to zoom · use + / − for step zoom</span><button type="button" onclick="resetCoursePreviewMap()">Fit hole</button></div>\n        <div class="preview-attribution">Satellite imagery © Mapbox / providers · Golf geometry © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a></div>'''
if old_attr not in s:
    raise SystemExit('attribution anchor not found')
s=s.replace(old_attr,new_attr,1)

# Clarify subtitle: fairway-derived line, not raw OSM hole line
s=s.replace('satellite + GolfRecon overlay','interactive satellite + GolfRecon overlay')

# Ensure map lifecycle is safe and initialize after each render
if 'function render(){\n destroyCoursePreviewMap();' not in s:
    s=s.replace('function render(){','function render(){\n destroyCoursePreviewMap();',1)
old_hook=""" if(state.view==='coursePreview'){\n   requestAnimationFrame(()=>ensureCoursePreviewLoaded(state.selectedCourseId,state.coursePreviewHole));\n }"""
new_hook=""" if(state.view==='coursePreview'){\n   requestAnimationFrame(()=>{ensureCoursePreviewLoaded(state.selectedCourseId,state.coursePreviewHole);requestAnimationFrame(initInteractiveCourseMap);});\n }"""
if old_hook not in s:
    raise SystemExit('course preview render hook not found')
s=s.replace(old_hook,new_hook,1)

# Validation
for needle in ['GolfRecon v13.1 Beta','mapbox-gl-js/v3.14.0/mapbox-gl.js','function initInteractiveCourseMap()','function fairwayCenterLine(','id="coursePreviewMap"','resetCoursePreviewMap','destroyCoursePreviewMap();']:
    if needle not in s: raise SystemExit('validation missing '+needle)

p.write_text(s)
# syntax check inline JS only
scripts=re.findall(r'<script(?: [^>]*)?>(.*?)</script>',s,re.S)
inline='\n'.join(x for x in scripts if x.strip())
Path('/tmp/golfrecon-v131.js').write_text(inline)
r=subprocess.run(['node','--check','/tmp/golfrecon-v131.js'],capture_output=True,text=True)
if r.returncode:
    print(r.stderr)
    raise SystemExit('JS syntax check failed')
print('GolfRecon v13.1 interactive Course Preview patch applied; JS syntax OK')
