from pathlib import Path
import re, subprocess
p=Path('index.html')
s=p.read_text()

s=s.replace('Golf Recon v14.4 Beta','Golf Recon v14.5 Beta')
s=s.replace('<span>v14.4 Beta</span>','<span>v14.5 Beta</span>',1)

css=r'''

/* =========================================================
   v14.5 mobile usability fixes
   - import/review modal scrolls on iPhone
   - Pregame course + stats command bar remains pinned on scroll
   ========================================================= */

/* iOS/Safari dialog: the later v14 visual rule set overflow:hidden on
   .dialog-card, which trapped the review content and hid Save Round. */
dialog{
  max-height:100dvh!important;
  overflow:visible!important;
  margin:auto!important;
}
dialog .import-card{
  width:min(94vw,760px)!important;
  max-height:calc(100dvh - 24px)!important;
  overflow-x:hidden!important;
  overflow-y:auto!important;
  -webkit-overflow-scrolling:touch!important;
  overscroll-behavior:contain;
  touch-action:pan-y;
  padding-bottom:max(24px,env(safe-area-inset-bottom))!important;
}
dialog .dialog-head{
  position:sticky;
  top:0;
  z-index:8;
  margin:-4px -4px 8px;
  padding:4px 4px 10px;
  background:linear-gradient(180deg,rgba(8,18,13,.995) 0%,rgba(8,18,13,.97) 82%,rgba(8,18,13,0) 100%);
}
#importStepReview .dialog-actions,
#backfillReviewStep .dialog-actions{
  position:sticky;
  bottom:calc(-1 * max(24px,env(safe-area-inset-bottom)));
  z-index:9;
  margin:18px -4px 0;
  padding:12px 4px max(12px,env(safe-area-inset-bottom));
  background:linear-gradient(0deg,rgba(7,17,12,.995) 0%,rgba(7,17,12,.97) 78%,rgba(7,17,12,0) 100%);
}

/* Pregame command bar: keep the selected course and Last/All stats visible
   as the page scrolls, including mobile Safari. */
main#app{overflow:visible!important;contain:none!important}
.pregame-hero{
  position:sticky!important;
  top:6px!important;
  z-index:80!important;
  overflow:visible!important;
  isolation:isolate;
}
@media(max-width:760px){
  .pregame-hero{
    top:max(4px,env(safe-area-inset-top))!important;
    z-index:90!important;
    padding:8px 9px 7px!important;
    margin-bottom:10px!important;
    box-shadow:0 12px 28px rgba(0,0,0,.48),0 0 18px rgba(199,255,102,.05)!important;
  }
  .pregame-hero-head{gap:3px!important}
  .pregame-title-line{gap:6px!important}
  .pregame-hero h2{font-size:18px!important;line-height:1!important}
  .pregame-course-meta{font-size:8px!important;line-height:1.1!important}
  .pregame-course-picker{grid-template-columns:38px minmax(0,1fr)!important;gap:5px!important}
  .pregame-course-select{height:29px!important;font-size:10px!important;padding-top:3px!important;padding-bottom:3px!important}
  .pregame-hero .course-stat-lines{margin-top:4px!important;padding:0 6px!important}
  .pregame-hero .course-stat-row{padding:3px 0!important}
  .pregame-hero .course-stat strong{font-size:11px!important}
  .pregame-hero .course-stat span,.pregame-hero .course-stat-row .row-label{font-size:7px!important}
  dialog{width:100vw!important;max-width:none!important;padding:6px!important}
  dialog .import-card{width:100%!important;max-height:calc(100dvh - 12px)!important;border-radius:12px!important;padding:14px 12px max(18px,env(safe-area-inset-bottom))!important}
  .import-review{padding-bottom:4px}
}
'''

if 'v14.5 mobile usability fixes' not in s:
    s=s.replace('</style>',css+'\n</style>',1)

# Guard the two requested behaviors.
for token in ['id="importStepReview"','id="saveImport"','class="hero pregame-hero"','class="pregame-course-select"','class="course-stat-lines"']:
    if token not in s:
        raise SystemExit('missing required UI token: '+token)

p.write_text(s)
# JS syntax
scripts=re.findall(r'<script(?:[^>]*)>(.*?)</script>',s,re.S)
Path('/tmp/golfrecon-v145.js').write_text('\n'.join(scripts))
r=subprocess.run(['node','--check','/tmp/golfrecon-v145.js'],capture_output=True,text=True)
if r.returncode:
    print(r.stderr)
    raise SystemExit('JS syntax failed')
print('v14.5 patched; mobile import scrolling + sticky Pregame guards passed; JS syntax passed')
