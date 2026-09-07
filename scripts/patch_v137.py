from pathlib import Path
import re, subprocess

p=Path('index.html')
s=p.read_text()

def rep(old,new,count=1,label='anchor'):
    global s
    if old not in s:
        raise SystemExit(f'missing {label}')
    s=s.replace(old,new,count)

rep('<title>GolfRecon v13.6 Beta</title>','<title>GolfRecon v13.7 Beta</title>',1,'title')
s=s.replace('v13.6 Beta','v13.7 Beta')

css=r'''
/* v13.7 tighter sticky Pregame header */
.pregame-hero{
  padding:10px 14px 9px;
  border-radius:17px;
  margin-bottom:12px!important;
}
.pregame-hero-head{
  grid-template-columns:minmax(0,1fr) minmax(200px,280px);
  align-items:end;
  gap:12px;
}
.pregame-title-line{
  display:flex;
  align-items:baseline;
  gap:10px;
  flex-wrap:wrap;
  min-width:0;
}
.pregame-hero h2{
  font-size:23px;
  margin:2px 0 0;
  white-space:nowrap;
}
.pregame-course-meta{
  margin:0!important;
  font-size:10px;
  line-height:1.15;
  white-space:nowrap;
}
.pregame-course-picker{
  align-self:end;
  margin-bottom:-2px;
}
.pregame-course-picker span{font-size:7px}
.pregame-course-select{
  height:32px;
  padding:4px 30px 4px 9px;
  border-radius:10px;
  font-size:10px;
}
.pregame-hero .course-stat-lines{
  margin-top:5px;
  border-radius:10px;
  padding:0 8px;
}
.pregame-hero .course-stat-row{padding:4px 0}
.pregame-hero .course-stat strong{font-size:12px}
.pregame-hero .course-stat span,.pregame-hero .course-stat-row .row-label{font-size:7px}
@media(max-width:640px){
  .pregame-hero{padding:9px 10px 8px}
  .pregame-hero-head{grid-template-columns:1fr;gap:4px}
  .pregame-title-line{gap:7px}
  .pregame-hero h2{font-size:20px}
  .pregame-course-meta{font-size:9px;white-space:normal}
  .pregame-course-picker{grid-template-columns:40px minmax(0,1fr);margin-bottom:0}
  .pregame-course-select{height:30px}
  .pregame-hero .course-stat-lines{margin-top:4px}
  .pregame-hero .course-stat-row{padding:4px 0}
}
'''
rep('</style>',css+'\n</style>',1,'style close')

old='''          <div class="pregame-hero-title"><div class="eyebrow">TOMORROW'S PREGAME</div><h2>${c.name}</h2></div>
          <label class="pregame-course-picker"><span>COURSE</span><select class="pregame-course-select" aria-label="Pregame course" onchange="setGlobalCourse(this.value)">${courseDropdownOptions(c.id)}</select></label>
        </div>
        <p class="muted pregame-course-meta">${c.tees} tees · Par ${c.par??'—'} · ${c.rating??'—'}/${c.slope??'—'} · ${rounds.length} round${rounds.length===1?'':'s'} in memory</p>'''
new='''          <div class="pregame-hero-title">
            <div class="eyebrow">TOMORROW'S PREGAME</div>
            <div class="pregame-title-line">
              <h2>${c.name}</h2>
              <span class="muted pregame-course-meta">${c.tees} tees · Par ${c.par??'—'} · ${c.rating??'—'}/${c.slope??'—'} · ${rounds.length} round${rounds.length===1?'':'s'} in memory</span>
            </div>
          </div>
          <label class="pregame-course-picker"><span>COURSE</span><select class="pregame-course-select" aria-label="Pregame course" onchange="setGlobalCourse(this.value)">${courseDropdownOptions(c.id)}</select></label>
        </div>'''
rep(old,new,1,'pregame header markup')

p.write_text(s)
scripts=re.findall(r'<script>(.*?)</script>',s,re.S)
Path('/tmp/golfrecon-v137.js').write_text('\n'.join(scripts))
r=subprocess.run(['node','--check','/tmp/golfrecon-v137.js'],capture_output=True,text=True)
if r.returncode:
    print(r.stderr)
    raise SystemExit('JS syntax check failed')
print('GolfRecon v13.7 patch applied; JS syntax OK')
