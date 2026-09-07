from pathlib import Path
import re, subprocess

p=Path('index.html')
s=p.read_text()

def rep(old,new,label):
    global s
    if old not in s:
        raise SystemExit(f'missing anchor: {label}')
    s=s.replace(old,new,1)

# Version
rep('<title>GolfRecon v13.1 Beta</title>','<title>GolfRecon v13.2 Beta</title>','title')
s=s.replace('v13.1 Beta','v13.2 Beta')

# Guarantee a visible play line, preferring the fairway-derived centerline.
old="""  const fairway=primaryFairwayElement(geom,ctx);
  const center=fairwayCenterLine(fairway,ctx.start,ctx.end);
  const playLine=center.length?center:[];
  const focus=focusedPreviewElements(geom,ctx,fairway,playLine);"""
new="""  const fairway=primaryFairwayElement(geom,ctx);
  const center=fairwayCenterLine(fairway,ctx.start,ctx.end);
  const fairwayMid=fairway?elementCentroid(fairway):null;
  let playLine=center.length?center:(fairwayMid?[ctx.start,fairwayMid,ctx.end]:[ctx.start,ctx.end]);
  if(playLine.length){
    if(pointDistanceMeters(playLine[0],ctx.start)>12)playLine=[ctx.start,...playLine];
    if(pointDistanceMeters(playLine[playLine.length-1],ctx.end)>12)playLine=[...playLine,ctx.end];
  }
  const focus=focusedPreviewElements(geom,ctx,fairway,playLine);"""
rep(old,new,'play line fallback')

# Back initial framing off slightly and use more breathing room.
old="""function fitCoursePreviewMap(extraZoom=true){
  if(!coursePreviewMapInstance||!coursePreviewMapFocusBounds)return;
  try{const camera=coursePreviewMapInstance.cameraForBounds(coursePreviewMapFocusBounds,{padding:{top:24,bottom:24,left:22,right:22}});if(camera){if(extraZoom)camera.zoom=Math.min(19.5,(camera.zoom||18)+0.35);coursePreviewMapInstance.jumpTo(camera)}}catch{}
}"""
new="""function fitCoursePreviewMap(extraZoom=true){
  if(!coursePreviewMapInstance||!coursePreviewMapFocusBounds)return;
  try{
    const camera=coursePreviewMapInstance.cameraForBounds(coursePreviewMapFocusBounds,{padding:{top:54,bottom:54,left:48,right:48}});
    if(camera){
      if(extraZoom)camera.zoom=Math.max(14,Math.min(19,(camera.zoom||18)-0.18));
      coursePreviewMapInstance.jumpTo(camera);
    }
  }catch{}
}"""
rep(old,new,'initial map framing')

# Add concise title metadata helper. Uses stored tee yardage if available; otherwise clearly marks map-derived yardage as approximate.
anchor="""function coursePreviewView(){
  const c=course(state.selectedCourseId);"""
helper="""function previewPolylineYards(points){
  if(!Array.isArray(points)||points.length<2)return null;
  let meters=0;
  for(let i=1;i<points.length;i++)meters+=pointDistanceMeters(points[i-1],points[i]);
  return meters>0?Math.round(meters/0.9144):null;
}
function previewHoleYardage(c,hole,built){
  const nums=(c?.holeNumbers||[]).map(Number),idx=Math.max(0,nums.indexOf(Number(hole)));
  const arrays=[c?.yardages,c?.holeYardages,c?.hole_yardages];
  for(const arr of arrays){
    const v=Number(arr?.[idx]);
    if(Number.isFinite(v)&&v>0)return {value:Math.round(v),approx:false};
  }
  const hv=c?.holes?.find?.(x=>Number(x?.hole??x?.number??x?.hole_number)===Number(hole));
  const direct=Number(hv?.yardage??hv?.yards??hv?.distance);
  if(Number.isFinite(direct)&&direct>0)return {value:Math.round(direct),approx:false};
  const pts=built?.playLine?.length?built.playLine:built?.ctx?.path;
  const approx=previewPolylineYards(pts);
  return approx?{value:approx,approx:true}:null;
}

function coursePreviewView(){
  const c=course(state.selectedCourseId);"""
rep(anchor,helper,'title metadata helper')

# Compute the title stats from the selected course/hole.
old="""  const mb=mapboxToken();
  const mapReady=Boolean(mb&&cached?.geom);
  const mapBody=mapReady?`<div id=\"coursePreviewMap\" aria-label=\"Interactive satellite view for Hole ${hole}\"></div>`:`<div class=\"preview-map-empty\"><div><strong>${state.coursePreviewLoading?`Loading Hole ${hole}…`:(!mb?'Mapbox token required':'Hole geometry not available yet')}</strong><span>${safeText(!mb?'Set your Mapbox token above to enable the interactive satellite hole view.':emptyMsg)}</span></div></div>`;
  const insight=h?usefulHoleInsight(h):'';"""
new="""  const mb=mapboxToken();
  const mapReady=Boolean(mb&&cached?.geom);
  const mapBody=mapReady?`<div id=\"coursePreviewMap\" aria-label=\"Interactive satellite view for Hole ${hole}\"></div>`:`<div class=\"preview-map-empty\"><div><strong>${state.coursePreviewLoading?`Loading Hole ${hole}…`:(!mb?'Mapbox token required':'Hole geometry not available yet')}</strong><span>${safeText(!mb?'Set your Mapbox token above to enable the interactive satellite hole view.':emptyMsg)}</span></div></div>`;
  const titleBuilt=cached?.geom?buildCoursePreviewGeoJSON(cached.geom):null;
  const holeIdx=Math.max(0,holes.map(Number).indexOf(hole));
  const holePar=h?.par??c.pars?.[holeIdx]??'—';
  const holeHcp=c.handicaps?.[holeIdx]??'—';
  const holeYd=previewHoleYardage(c,hole,titleBuilt);
  const yardageText=holeYd?`${holeYd.approx?'~':''}${holeYd.value} yd`:'— yd';
  const insight=h?usefulHoleInsight(h):'';"""
rep(old,new,'title metadata computation')

# Strip the extra title copy and show only the requested hole facts.
old="""            <div class=\"preview-hole-title\"><strong>Hole ${hole}</strong><span>Par ${h?.par??c.pars?.[holes.map(Number).indexOf(hole)]??'—'} · Mapbox interactive satellite + GolfRecon overlay</span></div>"""
new="""            <div class=\"preview-hole-title\"><strong>Hole ${hole}</strong><span>Par ${holePar} · ${yardageText} · HCP ${holeHcp}</span></div>"""
rep(old,new,'compact hole title')

p.write_text(s)

# Validate JS syntax.
scripts=re.findall(r'<script(?: [^>]*)?>(.*?)</script>',s,re.S)
inline='\n'.join(x for x in scripts if x.strip() and 'src=' not in x[:50])
Path('/tmp/golfrecon-v132.js').write_text(inline)
r=subprocess.run(['node','--check','/tmp/golfrecon-v132.js'],capture_output=True,text=True)
if r.returncode:
    print(r.stderr)
    raise SystemExit('JavaScript syntax check failed')
print('GolfRecon v13.2 patch applied; JavaScript syntax OK.')
