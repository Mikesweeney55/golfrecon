from pathlib import Path
import re, subprocess

p=Path('index.html')
s=p.read_text()

if '<title>GolfRecon v12.9 Beta</title>' not in s:
    raise SystemExit('Expected v12.9 base title not found')
s=s.replace('<title>GolfRecon v12.9 Beta</title>','<title>GolfRecon v13.0 Beta</title>',1)
s=s.replace('v12.9 Beta','v13.0 Beta')

css=r'''
/* v13.0 Mapbox Course Preview */
.preview-hero-grid{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:12px;align-items:stretch}
.preview-hero-grid .course-preview-map{min-width:0}
.preview-stats-column{display:flex;flex-direction:column;gap:7px;min-width:0}
.preview-side-card{background:rgba(21,32,28,.96);border:1px solid var(--line);border-radius:14px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:42px}
.preview-side-card strong{font-size:17px;line-height:1}.preview-side-card span{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;text-align:right}
.preview-side-card.risk-card{min-height:48px}.preview-side-card.risk-card strong{display:flex;align-items:center;gap:8px;font-size:14px}
.preview-read-card{background:rgba(21,32,28,.96);border:1px solid var(--line);border-radius:14px;padding:11px 12px;margin-top:1px;flex:1;min-height:92px;overflow:hidden}
.preview-read-card .eyebrow{font-size:9px}.preview-read-card p{font-size:11px;line-height:1.35;margin:6px 0 0;color:#dce6e1}
.mapbox-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 9px;font-size:10px;color:var(--muted)}
.mapbox-row button{border:1px solid var(--line);background:#13211b;color:var(--text);border-radius:999px;padding:5px 9px;font-size:10px;font-weight:800}
.mapbox-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:5px;background:var(--warning)}.mapbox-dot.ready{background:var(--good)}
.mapbox-missing{border:1px solid rgba(255,212,0,.32);background:rgba(255,212,0,.06);border-radius:12px;padding:8px 10px;font-size:10px;color:#eadf9d;margin-bottom:9px}
.satellite-stack.mapbox-live:after{content:'MAPBOX SATELLITE';position:absolute;left:10px;bottom:10px;z-index:2;background:rgba(5,12,9,.72);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:4px 7px;color:#fff;font-size:9px;font-weight:900;letter-spacing:.04em;backdrop-filter:blur(5px)}
@media(max-width:760px){.preview-hero-grid{grid-template-columns:1fr}.preview-stats-column{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.preview-read-card{grid-column:1/-1}.preview-side-card{min-height:48px}.course-preview-map,.course-preview-map svg,.preview-map-empty{min-height:390px;height:390px}}
'''
if '</style>' not in s: raise SystemExit('style close not found')
s=s.replace('</style>',css+'\n</style>',1)

anchor='function mercatorWorldPixel('
idx=s.find(anchor)
if idx<0: raise SystemExit('mercatorWorldPixel anchor not found')
helpers=r'''
const MAPBOX_TOKEN_KEY='golfreconMapboxPublicTokenV1';
function mapboxToken(){
  try{return String(localStorage.getItem(MAPBOX_TOKEN_KEY)||'').trim()}catch{return ''}
}
window.configureMapboxToken=()=>{
  const existing=mapboxToken();
  const token=window.prompt('Paste your Mapbox PUBLIC access token (starts with pk.). It is stored only in this browser.',existing);
  if(token===null)return;
  const clean=String(token||'').trim();
  try{
    if(clean)localStorage.setItem(MAPBOX_TOKEN_KEY,clean);
    else localStorage.removeItem(MAPBOX_TOKEN_KEY);
  }catch{}
  render();
};
'''
s=s[:idx]+helpers+s[idx:]

old='''    const src=`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${wrapped}`;
    tiles.push(`<img class="satellite-tile" alt="" draggable="false" src="${src}" style="left:${left}px;top:${top}px" loading="eager">`);'''
new='''    const fallback=`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${wrapped}`;
    const token=mapboxToken();
    const src=token?`https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/${z}/${wrapped}/${ty}@2x.webp?access_token=${encodeURIComponent(token)}`:fallback;
    tiles.push(`<img class="satellite-tile" alt="" draggable="false" src="${src}" data-fallback="${fallback}" onerror="if(this.src!==this.dataset.fallback){this.src=this.dataset.fallback}" style="left:${left}px;top:${top}px" loading="eager">`);'''
if old not in s: raise SystemExit('satellite tile source block not found')
s=s.replace(old,new,1)

oldret='''  return `<div class="satellite-stack">${tiles.join('')}<svg class="satellite-overlay" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Satellite view with GolfRecon hole overlay">${shapes.join('')}</svg><div class="satellite-north">N ↑</div></div>`;'''
newret='''  return `<div class="satellite-stack ${mapboxToken()?'mapbox-live':''}">${tiles.join('')}<svg class="satellite-overlay" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Satellite view with GolfRecon hole overlay">${shapes.join('')}</svg><div class="satellite-north">N ↑</div></div>`;'''
if oldret not in s: raise SystemExit('satellite stack return not found')
s=s.replace(oldret,newret,1)

m=re.search(r"function coursePreviewView\(\)\{.*?\n\}\n\nfunction groupsView\(\)",s,re.S)
if not m: raise SystemExit('coursePreviewView block not found')
newview=r'''function coursePreviewView(){
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
  const mapHtml=satelliteHoleMap(cached?.geom);
  const avgScore=h?.avgScore;
  const over=(h&&Number.isFinite(h.avgScore)&&Number.isFinite(h.par))?h.avgScore-h.par:null;
  const emptyMsg=state.coursePreviewError||cached?.error||'GolfRecon is checking the golf-course data for this hole.';
  const mapBody=mapHtml?mapHtml:`<div class="preview-map-empty"><div><strong>${state.coursePreviewLoading?`Loading Hole ${hole}…`:'Hole geometry not available yet'}</strong><span>${safeText(emptyMsg)}</span></div></div>`;
  const mb=mapboxToken();
  const insight=h?usefulHoleInsight(h):'';
  const stat=(label,value)=>`<div class="preview-side-card"><strong>${value}</strong><span>${label}</span></div>`;
  return `
    <div class="preview-page-head">
      <button class="preview-back" type="button" onclick="closeCoursePreview()">← Back</button>
      <div class="muted">${safeText(c.name)} · ${safeText(c.tees||'')} tees</div>
    </div>
    <div class="section-head"><div><div class="eyebrow">COURSE PREVIEW</div><h2>${safeText(c.name)}</h2></div></div>
    <div class="mapbox-row"><span><span class="mapbox-dot ${mb?'ready':''}"></span>${mb?'Mapbox Satellite ready':'Mapbox Satellite not configured'}</span><button type="button" onclick="configureMapboxToken()">${mb?'Change token':'Set Mapbox token'}</button></div>
    ${mb?'':`<div class="mapbox-missing">For the upgraded satellite imagery, tap <strong>Set Mapbox token</strong> and paste a free public Mapbox token. Until then GolfRecon falls back to the previous imagery source.</div>`}
    <div class="hole-selector">${holes.map(n=>`<button type="button" class="${Number(n)===hole?'active':''}" onclick="selectCoursePreviewHole(${Number(n)})">${n}</button>`).join('')}</div>

    <div class="preview-hero-grid">
      <div>
        <div class="course-preview-map">
          <div class="preview-map-head">
            <div class="preview-hole-title"><strong>Hole ${hole}</strong><span>Par ${h?.par??c.pars?.[holes.map(Number).indexOf(hole)]??'—'} · Mapbox satellite + GolfRecon overlay</span></div>
            ${h?`<span class="risk-dot preview-risk" title="${riskLabel(h)}">${riskLetter(h)}</span>`:''}
          </div>
          <div id="coursePreviewMapBody">${mapBody}</div>
        </div>
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

    <div class="section-head"><div><div class="eyebrow">COURSE MEMORY</div><h2>Hole-by-hole</h2></div></div>
    <div class="risk-legend"><span class="chip"><span class="risk-dot">L</span> Low risk</span><span class="chip"><span class="risk-dot" style="background:var(--warning);color:#2a2200">M</span> Medium risk</span><span class="chip"><span class="risk-dot" style="background:var(--danger);color:#fff">H</span> High risk</span></div>
    <div class="hole-grid">${mem.map(x=>`<div class="${Number(x.hole)===hole?'preview-current-card':''}">${renderHoleCard(x)}</div>`).join('')}</div>`;
}

function groupsView()'''
s=s[:m.start()]+newview+s[m.end():]

for needle in ['GolfRecon v13.0 Beta','MAPBOX_TOKEN_KEY','mapbox/satellite-v9','preview-hero-grid','preview-stats-column','configureMapboxToken']:
    if needle not in s: raise SystemExit('v13 validation missing '+needle)

p.write_text(s)
scripts=re.findall(r'<script>(.*?)</script>',s,re.S)
Path('/tmp/golfrecon-v130.js').write_text('\n'.join(scripts))
r=subprocess.run(['node','--check','/tmp/golfrecon-v130.js'],capture_output=True,text=True)
if r.returncode:
    print(r.stderr)
    raise SystemExit('Frontend JavaScript syntax check failed')
print('GolfRecon v13.0 Mapbox Course Preview patch applied; JS syntax check passed.')
