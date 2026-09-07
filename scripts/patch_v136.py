from pathlib import Path
import re, subprocess

p=Path('index.html')
s=p.read_text()

def req(old,new,count=1,label='anchor'):
    global s
    if old not in s:
        raise SystemExit(f'v13.6 patch failed: missing {label}')
    s=s.replace(old,new,count)

# Version
req('<title>GolfRecon v13.5 Beta</title>','<title>GolfRecon v13.6 Beta</title>',1,'title')
s=s.replace('v13.5 Beta','v13.6 Beta')

# Compact sticky Pregame hero + compact 2-column Game Keys.
css=r'''
/* v13.6 Pregame sticky command header */
.pregame-hero{
  position:sticky;top:8px;z-index:24;
  margin:0 0 16px!important;padding:15px 18px 14px;
  border-radius:20px;
  background:linear-gradient(145deg,rgba(27,42,36,.97),rgba(17,26,23,.97));
  backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);
  box-shadow:0 12px 30px rgba(0,0,0,.34),0 0 0 1px rgba(184,234,104,.04);
}
.pregame-hero .hero-copy{max-width:none}
.pregame-hero-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,300px);align-items:end;gap:16px}
.pregame-hero-title{min-width:0}
.pregame-hero .eyebrow{font-size:9px;letter-spacing:.14em}
.pregame-hero h2{font-size:26px;line-height:1.02;margin:3px 0 0}
.pregame-course-picker{display:grid;gap:4px;min-width:0}
.pregame-course-picker span{font-size:8px;letter-spacing:.13em;font-weight:900;color:var(--accent)}
.pregame-course-select{width:100%;height:36px;padding:6px 34px 6px 10px;border-radius:11px;border:1px solid rgba(184,234,104,.28);background:#102019;color:var(--text);font-size:11px;font-weight:800}
.pregame-course-meta{margin:7px 0 0!important;font-size:11px;line-height:1.25}
.pregame-hero .course-stat-lines{margin-top:9px;border-radius:12px;padding:0 9px}
.pregame-hero .course-stat-row{padding:6px 0}
.pregame-hero .course-stat strong{font-size:13px}
.pregame-hero .course-stat span,.pregame-hero .course-stat-row .row-label{font-size:8px}

/* v13.6 compact Game Keys */
.game-keys-card{margin:14px 0 10px;padding:13px 16px 11px}
.game-keys-title{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:6px}
.game-keys-title h2{font-size:17px;line-height:1.1;margin:0}
.game-keys-title .eyebrow{font-size:9px}
.game-keys-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 22px}
.game-key-column{min-width:0}
.game-key-group{padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.game-key-column .game-key-group:last-child{border-bottom:0}
.game-key-group strong{font-size:10px;display:block;margin-bottom:4px}
.game-key-list{margin-top:0;display:flex;gap:5px;flex-wrap:wrap}
.game-key-pill{font-size:9px;padding:4px 7px;line-height:1.2}
@media(max-width:640px){
  .pregame-hero{top:4px;padding:12px 12px 11px;border-radius:17px}
  .pregame-hero-head{grid-template-columns:1fr;gap:7px;align-items:start}
  .pregame-hero h2{font-size:23px}
  .pregame-course-picker{grid-template-columns:44px minmax(0,1fr);align-items:center;gap:6px}
  .pregame-course-picker span{font-size:7px}
  .pregame-course-select{height:33px;font-size:10px}
  .pregame-course-meta{font-size:10px;margin-top:5px!important}
  .pregame-hero .course-stat-lines{margin-top:7px}
  .pregame-hero .course-stat-row{padding:5px 0}
  .game-keys-card{padding:12px 13px 10px}
  .game-keys-title{display:block;margin-bottom:5px}.game-keys-title h2{font-size:16px;margin-top:2px}
  .game-keys-grid{grid-template-columns:1fr 1fr;gap:0 12px}
  .game-key-group{padding:6px 0}
  .game-key-pill{font-size:8px;padding:4px 6px}
}
'''
req('</style>',css+'\n</style>',1,'style close')

# Game Keys: integrated compact card with Driver/Irons left and Chipping/Putting right.
pat=r"function gameKeysPregameHtml\(\)\{.*?\n\}"
m=re.search(pat,s,re.S)
if not m:
    raise SystemExit('v13.6 patch failed: gameKeysPregameHtml not found')
new_game=r'''function gameKeysPregameHtml(){
  const defs=[['driver','Driver'],['irons','Irons'],['chipping','Chipping'],['putting','Putting']];
  const active=defs.filter(([k])=>swingLines(k).length);
  if(!active.length)return '';
  const group=([k,label])=>`<div class="game-key-group"><strong>${label}</strong><div class="game-key-list">${swingLines(k).map(x=>`<span class="game-key-pill">${safeText(x)}</span>`).join('')}</div></div>`;
  const left=defs.slice(0,2).filter(([k])=>swingLines(k).length).map(group).join('');
  const right=defs.slice(2,4).filter(([k])=>swingLines(k).length).map(group).join('');
  return `<div class="card game-keys-card">
    <div class="game-keys-title"><div><div class="eyebrow">YOUR GAME KEYS</div><h2>Keep these in your head</h2></div></div>
    <div class="game-keys-grid"><div class="game-key-column">${left}</div><div class="game-key-column">${right}</div></div>
  </div>`;
}'''
s=s[:m.start()]+new_game+s[m.end():]

# Replace the Pregame hero only: dropdown is now inside the sticky main box.
hero_pat=r'''    <section class="hero" style="margin-top:0">.*?    </section>'''
hm=re.search(hero_pat,s,re.S)
if not hm:
    raise SystemExit('v13.6 patch failed: Pregame hero not found')
new_hero=r'''    <section class="hero pregame-hero">
      <div class="hero-copy">
        <div class="pregame-hero-head">
          <div class="pregame-hero-title"><div class="eyebrow">TOMORROW'S PREGAME</div><h2>${c.name}</h2></div>
          <label class="pregame-course-picker"><span>COURSE</span><select class="pregame-course-select" aria-label="Pregame course" onchange="setGlobalCourse(this.value)">${courseDropdownOptions(c.id)}</select></label>
        </div>
        <p class="muted pregame-course-meta">${c.tees} tees · Par ${c.par??'—'} · ${c.rating??'—'}/${c.slope??'—'} · ${rounds.length} round${rounds.length===1?'':'s'} in memory</p>
        <div class="course-stat-lines">
          <div class="course-stat-row">
            <div class="row-label">Last</div>
            <div class="course-stat"><strong>${lastStats.score??'—'}</strong><span>Score</span></div>
            <div class="course-stat"><strong>${pctVal(lastStats.fw)}</strong><span>FH</span></div>
            <div class="course-stat"><strong>${pctVal(lastStats.gir)}</strong><span>GIR</span></div>
            <div class="course-stat"><strong>${numVal(lastStats.putts)}</strong><span>Putts</span></div>
          </div>
          <div class="course-stat-row">
            <div class="row-label">All</div>
            <div class="course-stat"><strong>${allStats.score==null?'—':allStats.score.toFixed(1)}</strong><span>Avg</span></div>
            <div class="course-stat"><strong>${pctVal(allStats.fw)}</strong><span>FH</span></div>
            <div class="course-stat"><strong>${pctVal(allStats.gir)}</strong><span>GIR</span></div>
            <div class="course-stat"><strong>${numVal(allStats.putts)}</strong><span>Putts</span></div>
          </div>
        </div>
      </div>
    </section>'''
s=s[:hm.start()]+new_hero+s[hm.end():]

# Hide the old separate global Course box while Pregame is active; preserve it on other tabs.
render_anchor="function render(){\n destroyCoursePreviewMap();"
render_new="function render(){\n destroyCoursePreviewMap();\n const globalCourseBar=document.querySelector('.global-course-bar');\n if(globalCourseBar)globalCourseBar.style.display=state.view==='pregame'?'none':'grid';"
req(render_anchor,render_new,1,'render/global course bar')

# Basic validation.
for needle in [
  'GolfRecon v13.6 Beta',
  'hero pregame-hero',
  'pregame-course-select',
  'game-keys-grid',
  "globalCourseBar.style.display=state.view==='pregame'?'none':'grid'"
]:
    if needle not in s:
        raise SystemExit(f'v13.6 validation failed: {needle}')

p.write_text(s)
js='\n'.join(re.findall(r'<script>(.*?)</script>',s,re.S))
Path('/tmp/golfrecon-v136.js').write_text(js)
r=subprocess.run(['node','--check','/tmp/golfrecon-v136.js'],capture_output=True,text=True)
if r.returncode:
    print(r.stderr)
    raise SystemExit('v13.6 JavaScript syntax check failed')
print('GolfRecon v13.6 patch applied; JavaScript syntax OK.')
