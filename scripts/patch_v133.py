from pathlib import Path
import re, subprocess

p=Path('index.html')
s=p.read_text()

def rep(old,new,label):
    global s
    if old not in s:
        raise SystemExit(f'missing anchor: {label}')
    s=s.replace(old,new,1)

# Version bump
rep('<title>GolfRecon v13.2 Beta</title>','<title>GolfRecon v13.3 Beta</title>','title')
s=s.replace('v13.2 Beta','v13.3 Beta')

anchor="""function buildCoursePreviewGeoJSON(geom){
  const ctx=orientedHoleContext(geom);if(!ctx)return null;"""
helper="""function pointAlongPolyline(points,fraction){
  if(!Array.isArray(points)||!points.length)return null;
  if(points.length===1)return points[0];
  const f=Math.max(0,Math.min(1,Number(fraction)||0));
  const lengths=[];let total=0;
  for(let i=1;i<points.length;i++){
    const d=pointDistanceMeters(points[i-1],points[i]);
    lengths.push(d);total+=d;
  }
  if(total<=0)return points[Math.min(points.length-1,Math.round(f*(points.length-1)))];
  const target=total*f;let walked=0;
  for(let i=1;i<points.length;i++){
    const seg=lengths[i-1];
    if(walked+seg>=target){
      const t=seg?((target-walked)/seg):0;
      return [points[i-1][0]+(points[i][0]-points[i-1][0])*t,points[i-1][1]+(points[i][1]-points[i-1][1])*t];
    }
    walked+=seg;
  }
  return points[points.length-1];
}
function previewHolePar(){
  const c=course(state.selectedCourseId);if(!c)return null;
  const holes=(c.holeNumbers||[]).map(Number),idx=holes.indexOf(Number(state.coursePreviewHole));
  const p=Number(c.pars?.[idx>=0?idx:Number(state.coursePreviewHole)-1]);
  return Number.isFinite(p)?p:null;
}
function segmentedPlayLine(ctx,fairway,center){
  const par=previewHolePar();
  if(par===3)return [ctx.start,ctx.end];
  const guide=(center&&center.length>=2)?center:(fairway?osmElementPoints(fairway):ctx.path);
  if(par===4){
    const mid=pointAlongPolyline(guide,.5) || (fairway?elementCentroid(fairway):null) || pointAlongPolyline([ctx.start,ctx.end],.5);
    return mid?[ctx.start,mid,ctx.end]:[ctx.start,ctx.end];
  }
  if(par===5){
    const p1=pointAlongPolyline(guide,1/3),p2=pointAlongPolyline(guide,2/3);
    if(p1&&p2)return [ctx.start,p1,p2,ctx.end];
    const mid=fairway?elementCentroid(fairway):pointAlongPolyline([ctx.start,ctx.end],.5);
    if(mid){
      const a=pointAlongPolyline([ctx.start,mid],.67),b=pointAlongPolyline([mid,ctx.end],.33);
      if(a&&b)return [ctx.start,a,b,ctx.end];
    }
    return [ctx.start,ctx.end];
  }
  return (center&&center.length)?[ctx.start,...center.slice(1,-1),ctx.end]:[ctx.start,ctx.end];
}

function buildCoursePreviewGeoJSON(geom){
  const ctx=orientedHoleContext(geom);if(!ctx)return null;"""
rep(anchor,helper,'segmented line helpers')

old="""  const fairway=primaryFairwayElement(geom,ctx);
  const center=fairwayCenterLine(fairway,ctx.start,ctx.end);
  const fairwayMid=fairway?elementCentroid(fairway):null;
  let playLine=center.length?center:(fairwayMid?[ctx.start,fairwayMid,ctx.end]:[ctx.start,ctx.end]);
  if(playLine.length){
    if(pointDistanceMeters(playLine[0],ctx.start)>12)playLine=[ctx.start,...playLine];
    if(pointDistanceMeters(playLine[playLine.length-1],ctx.end)>12)playLine=[...playLine,ctx.end];
  }
  const focus=focusedPreviewElements(geom,ctx,fairway,playLine);"""
new="""  const fairway=primaryFairwayElement(geom,ctx);
  const center=fairwayCenterLine(fairway,ctx.start,ctx.end);
  const playLine=segmentedPlayLine(ctx,fairway,center);
  const focus=focusedPreviewElements(geom,ctx,fairway,playLine);"""
rep(old,new,'par driven line')

old="""    map.addLayer({id:'golfiq-playline',type:'line',source:'golfiq-hole',filter:['==',['get','kind'],'playline'],paint:{'line-color':'#d7ff9f','line-width':3,'line-opacity':0.9,'line-dasharray':[2,2]}});"""
new="""    map.addLayer({id:'golfiq-playline',type:'line',source:'golfiq-hole',filter:['==',['get','kind'],'playline'],layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#d7ff9f','line-width':3.5,'line-opacity':0.95,'line-dasharray':[2,2]}});"""
rep(old,new,'play line styling')

p.write_text(s)

scripts=re.findall(r'<script(?: [^>]*)?>(.*?)</script>',s,re.S)
inline='\n'.join(x for x in scripts if x.strip())
Path('/tmp/golfrecon-v133.js').write_text(inline)
r=subprocess.run(['node','--check','/tmp/golfrecon-v133.js'],capture_output=True,text=True)
if r.returncode:
    print(r.stderr)
    raise SystemExit('JavaScript syntax check failed')
print('GolfRecon v13.3 patch applied; JavaScript syntax OK.')
