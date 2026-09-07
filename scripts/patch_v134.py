from pathlib import Path
import re, subprocess

p=Path('index.html')
s=p.read_text()

def rep(old,new,label,count=1):
    global s
    if old not in s:
        raise SystemExit(f'missing anchor: {label}')
    s=s.replace(old,new,count)

rep('<title>GolfRecon v13.3 Beta</title>','<title>GolfRecon v13.4 Beta</title>','title')
s=s.replace('v13.3 Beta','v13.4 Beta')

old="""let state = {view:'pregame', selectedCourseId:'four-oaks-white-18-holes', roundStat:'score', roundFilter:'18', roundCourseId:'four-oaks-white-18-holes', selectedRoundId:null, gameCourseId:'four-oaks-white-18-holes', gameRoundLimit:'all', puttingCourse:'all', pregameChats:{}, chatBusy:false, coursePreviewHole:1, coursePreviewReturnView:'pregame', coursePreviewLoading:false, coursePreviewError:null};"""
new="""let state = {view:'pregame', selectedCourseId:'four-oaks-white-18-holes', roundStat:'score', roundFilter:'18', roundCourseId:'four-oaks-white-18-holes', selectedRoundId:null, gameCourseId:'four-oaks-white-18-holes', gameRoundLimit:'all', puttingCourse:'all', pregameChats:{}, chatBusy:false, coursePreviewHole:1, coursePreviewReturnView:'pregame', coursePreviewLoading:false, coursePreviewError:null, coursePreviewShowAll:false, coursePreviewCourseId:null};"""
rep(old,new,'state')

css="""
/* v13.4 embedded Pregame Hole Insights */
.pregame-hole-insights{scroll-margin-top:110px}
.pregame-hole-insights .section-head{margin-bottom:10px}
.pregame-hole-insights .hole-selector{margin-bottom:10px}
.pregame-hole-insights .preview-hero-grid{margin-top:0}
.pregame-hole-insights .mapbox-missing{margin-bottom:10px}
"""
rep('</style>',css+'\n</style>','style close')

anchor='function pregame(){\n'
if anchor not in s:
    raise SystemExit('missing anchor: pregame')
helper=r'''function pregameHoleInsightsHtml(c,priority=[]){
  const holes=(c.holeNumbers?.length?c.holeNumbers.slice():c.pars?.map((_,i)=>i+1)||[]);
  if(!holes.length)holes.push(...Array.from({length:18},(_,i)=>i+1));
  if(state.coursePreviewCourseId!==c.id){
    state.coursePreviewCourseId=c.id;
    state.coursePreviewHole=Number(priority?.[0]?.hole)||Number(holes[0])||1;
    state.coursePreviewShowAll=false;
    state.coursePreviewError=null;
  }
  let hole=Number(state.coursePreviewHole)||Number(holes[0])||1;
  if(!holes.map(Number).includes(hole))hole=Number(priority?.[0]?.hole)||Number(holes[0])||1;
  state.coursePreviewHole=hole;
  const mem=holeMemory(c.id),h=mem.find(x=>Number(x.hole)===hole);
  const last=h?holeLastRound(c.id,hole):null;
  const cached=coursePreviewCache.get(`preview:${c.id}:${hole}`);
  const avgScore=h?.avgScore;
  const over=(h&&Number.isFinite(h.avgScore)&&Number.isFinite(h.par))?h.avgScore-h.par:null;
  const emptyMsg=state.coursePreviewError||cached?.error||'GolfRecon is loading the golf-course data for this hole.';
  const mb=mapboxToken();
  const mapReady=Boolean(mb&&cached?.geom);
  const waiting=!cached&&!state.coursePreviewError;
  const mapBody=mapReady
    ? `<div id="coursePreviewMap" aria-label="Interactive satellite view for Hole ${hole}"></div>`
    : `<div class="preview-map-empty"><div><strong>${state.coursePreviewLoading||waiting?`Loading Hole ${hole}…`:(!mb?'Mapbox token required':'Hole geometry not available yet')}</strong><span>${safeText(!mb?'Set your Mapbox token to enable the interactive satellite hole view.':emptyMsg)}</span></div></div>`;
  const titleBuilt=cached?.geom?buildCoursePreviewGeoJSON(cached.geom):null;
  const holeIdx=Math.max(0,holes.map(Number).indexOf(hole));
  const holePar=h?.par??c.pars?.[holeIdx]??'—';
  const holeHcp=c.handicaps?.[holeIdx]??'—';
  const holeYd=previewHoleYardage(c,hole,titleBuilt);
  const yardageText=holeYd?`${holeYd.approx?'~':''}${holeYd.value} yd`:'— yd';
  const insight=h?usefulHoleInsight(h):'';
  const stat=(label,value)=>`<div class="preview-side-card"><strong>${value}</strong><span>${label}</span></div>`;
  return `
    <section id="pregameHoleInsights" class="pregame-hole-insights">
      <div class="section-head">
        <div><div class="eyebrow">HOLE INSIGHTS</div><h2>Hole ${hole}</h2></div>
        <button class="button secondary" type="button" onclick="toggleCoursePreviewHoles()">${state.coursePreviewShowAll?'Hide holes':'Show all holes'}</button>
      </div>
      ${!mb?`<div class="mapbox-missing">Satellite view needs your Mapbox public token. <button type="button" class="hole-preview-btn" onclick="configureMapboxToken()">Set Mapbox token</button></div>`:''}
      ${state.coursePreviewShowAll?`<div class="hole-selector">${holes.map(n=>`<button type="button" class="${Number(n)===hole?'active':''}" onclick="selectCoursePreviewHole(${Number(n)})">${n}</button>`).join('')}</div>`:''}
      <div class="preview-hero-grid">
        <div>
          <div class="course-preview-map">
            <div class="preview-map-head">
              <div class="preview-hole-title"><strong>Hole ${hole}</strong><span>Par ${holePar} · ${yardageText} · HCP ${holeHcp}</span></div>
              ${h?`<span class="risk-dot preview-risk" title="${riskLabel(h)}">${riskLetter(h)}</span>`:''}
            </div>
            <div id="coursePreviewMapBody">${mapBody}</div>
          </div>
          <div class="preview-map-tools"><span>Drag to pan · scroll or pinch to zoom</span><button type="button" onclick="resetCoursePreviewMap()">Fit hole</button></div>
          <div class="preview-attribution">Satellite imagery © Mapbox / providers · Golf geometry © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a></div>
        </div>
        <aside class="preview-stats-column" aria-label="Hole ${hole} statistics">
          ${h?`<div class="preview-side-card risk-card"><strong><span class="risk-dot" title="${riskLabel(h)}">${riskLetter(h)}</span> ${safeText(riskLabel(h))}</strong><span>Risk</span></div>`:''}
          ${stat('Rounds',h?.played??'—')}
          ${stat('Avg score',avgScore==null?'—':avgScore.toFixed(1))}
          ${stat('Vs par',over==null?'—':`${over>=0?'+':''}${over.toFixed(1)}`)}
          ${stat('Double+',h?.doubleRate==null?'—':h.doubleRate+'%')}
          ${stat('Fairways',h?.par===3?'—':(h?.fw==null?'—':h.fw+'%'))}
          ${stat('GIR',h?.gir==null?'—':h.gir+'%')}
          ${stat('Avg putts',h?.putts==null?'—':h.putts.toFixed(1))}
          ${stat('Last score',last?.score??'—')}
          <div class="preview-read-card"><div class="eyebrow">GOLFRECON READ</div><p>${safeText(insight||'More history will sharpen the hole-specific read.')}</p></div>
        </aside>
      </div>
    </section>`;
}
window.toggleCoursePreviewHoles=()=>{
  state.coursePreviewShowAll=!state.coursePreviewShowAll;
  render();
  requestAnimationFrame(()=>document.getElementById('pregameHoleInsights')?.scrollIntoView({behavior:'smooth',block:'start'}));
};

'''
s=s.replace(anchor,helper+anchor,1)

old="""    ${pregameChatHtml(c)}

    <div class=\"section-head\"><div><div class=\"eyebrow\">COURSE MEMORY</div><h2>Priority holes</h2></div><button class=\"button secondary\" onclick=\"openCourseMemory()\">See all</button></div>"""
new="""    ${pregameChatHtml(c)}

    ${pregameHoleInsightsHtml(c,priority)}

    <div class=\"section-head\"><div><div class=\"eyebrow\">COURSE MEMORY</div><h2>Priority holes</h2></div></div>"""
rep(old,new,'pregame placement')

rep("if(state.view!=='coursePreview')return;","if(!['pregame','coursePreview'].includes(state.view))return;",'map init view gate')
rep("const c=course(courseId); if(!c||state.view!=='coursePreview')return;","const c=course(courseId); if(!c||!['pregame','coursePreview'].includes(state.view))return;",'geometry load view gate')
rep("if(state.view==='coursePreview')render();","if(state.view==='pregame'||state.view==='coursePreview')render();",'geometry load rerender')

old=r'''window.openHolePreview=(hole,courseId=state.selectedCourseId)=>{
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
window.selectCoursePreviewHole=hole=>{state.coursePreviewHole=Number(hole)||1;state.coursePreviewError=null;render()};'''
new=r'''window.openHolePreview=(hole,courseId=state.selectedCourseId)=>{
  if(!course(courseId))return;
  state.selectedCourseId=courseId;
  state.gameCourseId=courseId;
  state.roundCourseId=courseId;
  state.coursePreviewCourseId=courseId;
  state.coursePreviewHole=Number(hole)||1;
  state.coursePreviewError=null;
  state.view='pregame';
  refreshGlobalCourseSelector();
  render();
  requestAnimationFrame(()=>document.getElementById('pregameHoleInsights')?.scrollIntoView({behavior:'smooth',block:'start'}));
};
window.closeCoursePreview=()=>{state.view='pregame';render()};
window.selectCoursePreviewHole=hole=>{
  state.coursePreviewCourseId=state.selectedCourseId;
  state.coursePreviewHole=Number(hole)||1;
  state.coursePreviewError=null;
  render();
  requestAnimationFrame(()=>document.getElementById('pregameHoleInsights')?.scrollIntoView({behavior:'smooth',block:'start'}));
};'''
rep(old,new,'embedded hole navigation')

old="""app.innerHTML=state.view==='pregame'?pregame():state.view==='rounds'?roundsView():state.view==='groups'?groupsView():state.view==='coursePreview'?coursePreviewView():myGame();"""
new="""app.innerHTML=state.view==='pregame'?pregame():state.view==='rounds'?roundsView():state.view==='groups'?groupsView():myGame();"""
rep(old,new,'render switch')

old=""" if(state.view==='pregame')requestAnimationFrame(()=>{const l=document.getElementById('pregameChatLog');if(l)l.scrollTop=l.scrollHeight});
 if(state.view==='coursePreview'){
   requestAnimationFrame(()=>{ensureCoursePreviewLoaded(state.selectedCourseId,state.coursePreviewHole);requestAnimationFrame(initInteractiveCourseMap);});
 }
"""
new=""" if(state.view==='pregame')requestAnimationFrame(()=>{
   const l=document.getElementById('pregameChatLog');if(l)l.scrollTop=l.scrollHeight;
   ensureCoursePreviewLoaded(state.selectedCourseId,state.coursePreviewHole);
   requestAnimationFrame(initInteractiveCourseMap);
 });
"""
rep(old,new,'pregame map initialization')

p.write_text(s)

for needle in ['GolfRecon v13.4 Beta','function pregameHoleInsightsHtml','Show all holes',"state.view='pregame'","ensureCoursePreviewLoaded(state.selectedCourseId,state.coursePreviewHole)","${pregameHoleInsightsHtml(c,priority)}"]:
    if needle not in s: raise SystemExit(f'missing validation: {needle}')
if "state.view==='coursePreview'?coursePreviewView()" in s:
    raise SystemExit('separate Course Preview route still present')

scripts=re.findall(r'<script(?: [^>]*)?>(.*?)</script>',s,re.S)
inline='\n'.join(x for x in scripts if x.strip())
Path('/tmp/golfrecon-v134.js').write_text(inline)
r=subprocess.run(['node','--check','/tmp/golfrecon-v134.js'],capture_output=True,text=True)
if r.returncode:
    print(r.stderr)
    raise SystemExit('JavaScript syntax check failed')
print('GolfRecon v13.4 Pregame Hole Insights patch applied; JavaScript syntax OK.')
