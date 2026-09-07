from pathlib import Path
import re, subprocess

p=Path('index.html')
s=p.read_text()

s=s.replace('GolfRecon v13.4 Beta','GolfRecon v13.5 Beta')
s=s.replace('v13.4 Beta','v13.5 Beta')

# Pull point-mapped tees/greens too; a lot of OSM courses do not have a numbered golf=hole way for every hole.
if 'node(around:2800,${geo.lat},${geo.lon})["golf"~"^(tee|green)$"]' not in s:
    needle='(\n way(around:2800,${geo.lat},${geo.lon})["golf"~"^(hole|fairway|green|bunker|tee|water_hazard|lateral_water_hazard)$"];'
    repl='(\n node(around:2800,${geo.lat},${geo.lon})["golf"~"^(tee|green)$"];\n way(around:2800,${geo.lat},${geo.lon})["golf"~"^(hole|fairway|green|bunker|tee|water_hazard|lateral_water_hazard)$"];'
    if needle not in s:
        raise SystemExit('OSM query anchor not found')
    s=s.replace(needle,repl,1)

start=s.find('function selectedHoleGeometry(courseData,hole){')
end=s.find('function osmHoleSvg(geom){',start)
if start<0 or end<0:
    raise SystemExit('selectedHoleGeometry block not found')

new_block=r'''function osmQuickCentroid(el){
  const pts=osmElementPoints(el);if(!pts.length)return null;
  return [pts.reduce((a,p)=>a+p[0],0)/pts.length,pts.reduce((a,p)=>a+p[1],0)/pts.length];
}
function syntheticHoleElement(hole,start,end,source='inferred'){
  if(!start||!end)return null;
  return {type:'way',id:`synthetic-hole-${hole}`,tags:{golf:'hole',ref:String(hole),synthetic:source},geometry:[{lon:start[0],lat:start[1]},{lon:end[0],lat:end[1]}]};
}
function nearestFeatureToElement(anchor,candidates,maxMeters=140){
  const ap=osmElementPoints(anchor);if(!ap.length)return null;
  let best=null,bestD=Infinity;
  for(const c of candidates){
    const cp=osmElementPoints(c);if(!cp.length)continue;
    const d=distanceToHole(cp,ap);
    if(d<bestD && d<=maxMeters){best=c;bestD=d}
  }
  return best;
}
function farEndFeature(anchor,candidates,guide=null){
  const a=osmQuickCentroid(anchor);if(!a)return null;
  const gp=guide?osmElementPoints(guide):null;
  const ranked=[];
  for(const c of candidates){
    const cp=osmElementPoints(c),cc=osmQuickCentroid(c);if(!cp.length||!cc)continue;
    const d=pointDistanceMeters(a,cc);
    if(d<65||d>760)continue;
    const guideD=gp?.length?distanceToHole(cp,gp):0;
    if(gp?.length && guideD>145)continue;
    // Prefer the far end of the same fairway; this avoids pairing a tee with the previous green / next tee nearby.
    ranked.push({c,score:d-guideD*2});
  }
  ranked.sort((x,y)=>y.score-x.score);
  return ranked[0]?.c||null;
}
function bestTeeGreenPair(tees,greens,guide){
  const gp=osmElementPoints(guide);let best=null,bestScore=-Infinity;
  for(const t of tees){
    const tp=osmElementPoints(t),tc=osmQuickCentroid(t);if(!tp.length||!tc)continue;
    if(distanceToHole(tp,gp)>145)continue;
    for(const g of greens){
      const gpts=osmElementPoints(g),gc=osmQuickCentroid(g);if(!gpts.length||!gc)continue;
      if(distanceToHole(gpts,gp)>145)continue;
      const d=pointDistanceMeters(tc,gc);if(d<65||d>760)continue;
      if(d>bestScore){bestScore=d;best={tee:t,green:g}}
    }
  }
  return best;
}
function selectedHoleGeometry(courseData,hole){
  const elements=courseData?.elements||[],target=Number(hole);
  const kind=e=>String(e?.tags?.golf||'').toLowerCase();
  const holes=elements.filter(e=>kind(e)==='hole' && osmElementPoints(e).length>=2);
  const tees=elements.filter(e=>kind(e)==='tee' && osmElementPoints(e).length);
  const greens=elements.filter(e=>kind(e)==='green' && osmElementPoints(e).length);
  const fairways=elements.filter(e=>kind(e)==='fairway' && osmElementPoints(e).length>=2);

  let holeEl=holes.find(e=>osmHoleNumber(e)===target);

  // Many community-mapped courses number the tee/green/fairway but omit the golf=hole path.
  if(!holeEl){
    let tee=tees.find(e=>osmHoleNumber(e)===target)||null;
    let green=greens.find(e=>osmHoleNumber(e)===target)||null;
    let fairway=fairways.find(e=>osmHoleNumber(e)===target)||null;

    if(tee&&!fairway)fairway=nearestFeatureToElement(tee,fairways,125);
    if(green&&!fairway)fairway=nearestFeatureToElement(green,fairways,125);

    if(tee&&!green)green=farEndFeature(tee,greens,fairway);
    if(green&&!tee)tee=farEndFeature(green,tees,fairway);

    if((!tee||!green)&&fairway){
      const pair=bestTeeGreenPair(tees,greens,fairway);
      tee=tee||pair?.tee||null;
      green=green||pair?.green||null;
    }

    if(tee&&green){
      const t=osmQuickCentroid(tee),g=osmQuickCentroid(green);
      holeEl=syntheticHoleElement(target,t,g,'tee-green-fallback');
    }
  }

  // Keep the old fallback only when OSM actually returned an apparently complete set of hole ways.
  // Do not guess Hole 12 from the 12th arbitrary OSM element on sparsely mapped courses.
  if(!holeEl && holes.length>=18){
    const ordered=holes.slice().sort((a,b)=>(Number(a.id)||0)-(Number(b.id)||0));
    holeEl=ordered[target-1]||null;
  }
  if(!holeEl)return null;

  const holePts=osmElementPoints(holeEl);if(holePts.length<2)return null;
  const nearby=elements.filter(e=>{
    const pts=osmElementPoints(e);if(!pts.length)return false;
    const featureKind=osmFeatureKind(e);
    const limit=featureKind==='water'?145:115;
    return distanceToHole(pts,holePts)<=limit;
  });
  if(!nearby.includes(holeEl))nearby.push(holeEl);
  return {holeEl,holePts,elements:nearby,inferred:Boolean(holeEl?.tags?.synthetic)};
}
'''
s=s[:start]+new_block+s[end:]

# Make the unavailable message more accurate when the free data truly lacks enough positional information.
s=s.replace("OpenStreetMap does not have mapped hole geometry for this hole yet.","The free course map does not have enough tee/green/hole data to locate this hole yet.")

p.write_text(s)

scripts=re.findall(r'<script>(.*?)</script>',s,re.S)
Path('/tmp/golfrecon-v135.js').write_text('\n'.join(scripts))
r=subprocess.run(['node','--check','/tmp/golfrecon-v135.js'],capture_output=True,text=True)
if r.returncode:
    print(r.stderr)
    raise SystemExit('JavaScript syntax check failed')
for needle in ['GolfRecon v13.5 Beta','tee-green-fallback','node(around:2800','function selectedHoleGeometry(courseData,hole)']:
    if needle not in s: raise SystemExit('Validation failed: '+needle)
print('GolfRecon v13.5 geometry fallback patch passed syntax validation')
