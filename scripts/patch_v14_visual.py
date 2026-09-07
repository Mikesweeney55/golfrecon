from pathlib import Path
import re, subprocess

p=Path('index.html')
s=p.read_text()

def must(old,new,label):
    global s
    if old not in s:
        raise SystemExit(f'v14 patch failed: missing {label}')
    s=s.replace(old,new,1)

must('<title>GolfRecon v13.7 Beta</title>','<title>Golf Recon v14 Beta</title>','title')
must('<div class="gr-brand" aria-label="GolfRecon"><div class="gr-mark"><span class="gr-cross">GR</span><span class="gr-flag">⚑</span></div><div class="gr-word"><strong>GOLFRECON</strong><small>KNOW YOUR GAME. PLAY SMARTER.</small></div></div>',
     '<div class="gr-brand" aria-label="Golf Recon"><div class="gr-mark"><span class="gr-cross">GR</span><span class="gr-flag">⌖</span></div><div class="gr-word"><strong>GOLF RECON</strong><small>SCOUT · PLAN · PLAY · IMPROVE</small></div></div>',
     'Golf Recon brand')
must('<span>v13.7 Beta</span>','<span>v14 Beta</span>','version')

css=r'''

/* =========================================================
   GOLF RECON v14 — Data-Tech + Recon visual system
   ========================================================= */
:root{
  --bg:#050d0b;
  --panel:#0b1713;
  --panel2:#10211a;
  --line:#234235;
  --text:#f4f8f5;
  --muted:#95ada2;
  --accent:#baff67;
  --accent2:#38c9ff;
  --warning:#ffd400;
  --danger:#ff4d4f;
  --good:#35dc72;
  --shadow:0 18px 42px rgba(0,0,0,.34);
}
html{background:#050d0b}
body{
  min-height:100vh;
  background:
    radial-gradient(circle at 18% -8%,rgba(107,211,145,.18),transparent 30%),
    radial-gradient(circle at 108% 6%,rgba(56,201,255,.11),transparent 27%),
    linear-gradient(180deg,#07120e 0%,#050d0b 52%,#040a08 100%);
  color:var(--text);
  position:relative;
  overflow-x:hidden;
}
body::before{
  content:'';
  position:fixed;inset:0;z-index:0;pointer-events:none;
  background-image:
    linear-gradient(rgba(138,221,176,.03) 1px,transparent 1px),
    linear-gradient(90deg,rgba(138,221,176,.03) 1px,transparent 1px),
    repeating-radial-gradient(circle at 12% 28%,transparent 0 34px,rgba(186,255,103,.028) 34px 35px,transparent 35px 69px),
    repeating-radial-gradient(circle at 86% 70%,transparent 0 42px,rgba(56,201,255,.021) 42px 43px,transparent 43px 85px);
  background-size:28px 28px,28px 28px,auto,auto;
  opacity:.7;
}
body::after{
  content:'';position:fixed;inset:0;z-index:0;pointer-events:none;
  background:linear-gradient(90deg,rgba(186,255,103,.018),transparent 28%,transparent 72%,rgba(56,201,255,.015));
}
.app-shell,.auth-screen{position:relative;z-index:1}
.app-shell{max-width:1040px;padding-top:14px}

.topbar{margin-bottom:16px;min-height:62px}
.gr-brand{gap:11px}
.gr-mark{
  width:52px;height:52px;border-radius:17px!important;
  border:1px solid rgba(186,255,103,.56)!important;
  background:linear-gradient(145deg,rgba(25,54,38,.97),rgba(7,21,15,.97))!important;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.04),0 0 22px rgba(186,255,103,.10)!important;
  overflow:visible;
}
.gr-mark:before{height:72%!important;top:14%!important;left:50%!important;opacity:.55!important;box-shadow:0 0 8px rgba(186,255,103,.35)}
.gr-mark:after{width:72%!important;left:14%!important;top:50%!important;opacity:.55!important;box-shadow:0 0 8px rgba(186,255,103,.35)}
.gr-cross{font-size:18px!important;letter-spacing:-.09em!important;text-shadow:0 0 14px rgba(255,255,255,.13)}
.gr-flag{right:-4px!important;top:-6px!important;color:var(--accent)!important;font-size:13px!important;text-shadow:0 0 10px rgba(186,255,103,.55)}
.gr-word strong{font-size:17px!important;letter-spacing:.13em!important;text-shadow:0 0 14px rgba(186,255,103,.10)}
.gr-word small{font-size:7px!important;letter-spacing:.19em!important;color:#a9c1b5!important;margin-top:6px!important}
.brand-meta{margin-top:6px!important;gap:6px!important}
.giq-logo{
  border:1px solid rgba(186,255,103,.13);border-radius:16px;
  background:linear-gradient(180deg,rgba(16,38,28,.72),rgba(6,18,13,.35));
  padding:8px 14px 11px!important;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.025),0 0 25px rgba(186,255,103,.04);
}
.giq-logo::after{background:linear-gradient(90deg,transparent,var(--accent),var(--accent2),transparent)!important}

.card,.hero,.global-course-bar,.dialog-card,.auth-card,.direction-card,.course-stat-lines,.chat-msg.assistant{
  background:linear-gradient(180deg,rgba(10,24,18,.965),rgba(7,17,13,.955))!important;
  border-color:rgba(138,206,169,.18)!important;
  box-shadow:0 15px 34px rgba(0,0,0,.27),inset 0 1px 0 rgba(255,255,255,.025),0 0 0 1px rgba(186,255,103,.018)!important;
}
.card,.hero,.global-course-bar{position:relative}
.card::before,.hero::before,.global-course-bar::before{
  content:'';position:absolute;width:18px;height:18px;left:-1px;top:-1px;pointer-events:none;
  border-left:2px solid rgba(186,255,103,.45);border-top:2px solid rgba(186,255,103,.45);border-radius:inherit 0 0 0;
  opacity:.75;
}
.hero{overflow:visible}
.section-head .eyebrow,.eyebrow{color:var(--accent)!important;text-shadow:0 0 12px rgba(186,255,103,.14)}
.section-head h2{letter-spacing:-.025em}
.muted{color:var(--muted)}

.global-course-select,.pregame-course-select,.course-dropdown,.target-select,.chat-input,.edit-form input,.edit-form select,input,select,textarea{
  background:#091712!important;border-color:rgba(157,215,186,.22)!important;color:var(--text)!important;
}
.global-course-select:focus,.pregame-course-select:focus,.course-dropdown:focus,.chat-input:focus,input:focus,select:focus,textarea:focus{
  border-color:rgba(186,255,103,.62)!important;
  box-shadow:0 0 0 2px rgba(186,255,103,.075),0 0 18px rgba(186,255,103,.06)!important;
}
.button.primary{background:linear-gradient(180deg,#c9ff78,#9ee85b)!important;color:#10200f!important;box-shadow:0 0 20px rgba(186,255,103,.13)!important}
.button.secondary,.filter-tab,.game-tab,.stat-tab,.course-pill,.putting-round,.game-round-btn,.chat-prompt,.chat-clear,.scope-toggle .filter-tab{
  background:linear-gradient(180deg,rgba(18,37,29,.95),rgba(10,24,18,.95))!important;border-color:rgba(133,196,163,.20)!important;
}
.filter-tab.active,.game-tab.active,.stat-tab.active,.course-pill.active,.putting-round.active,.game-round-btn.active{
  background:linear-gradient(180deg,rgba(186,255,103,.20),rgba(52,103,67,.28))!important;
  color:#eaffd3!important;border-color:rgba(186,255,103,.55)!important;box-shadow:0 0 18px rgba(186,255,103,.07)!important;
}

.pregame-hero{
  top:6px!important;
  background:linear-gradient(150deg,rgba(12,29,21,.985),rgba(6,18,13,.98))!important;
  border-color:rgba(186,255,103,.24)!important;
  box-shadow:0 18px 38px rgba(0,0,0,.38),0 0 22px rgba(186,255,103,.05)!important;
}
.pregame-hero .course-stat-lines{background:rgba(4,14,10,.50)!important}
.pregame-course-select{border-color:rgba(186,255,103,.30)!important}

.bar{background:linear-gradient(180deg,var(--accent),#62d79b,var(--accent2))!important;box-shadow:0 0 12px rgba(56,201,255,.08)}
.chart-card,.tendency-card{overflow:hidden}
.chart-head strong{letter-spacing:-.02em}
.badge{background:#10241b!important;border:1px solid rgba(143,205,173,.15)}
.game-key-pill{background:rgba(186,255,103,.055)!important;border-color:rgba(186,255,103,.25)!important;color:#e5f7dc!important}
.game-keys-card{border-color:rgba(186,255,103,.17)!important}
.direction-center{background:linear-gradient(145deg,#217fea,#39c9ff)!important;box-shadow:0 0 20px rgba(56,201,255,.12)}
.direction-ring{border-color:rgba(56,201,255,.15)!important}

.hole-card{background:linear-gradient(180deg,rgba(13,30,22,.97),rgba(8,20,15,.97))!important}
.hole-preview-btn,.hole-ref-link{background:rgba(186,255,103,.065)!important;border-color:rgba(186,255,103,.28)!important}

.chat-msg.assistant{border-left:2px solid rgba(186,255,103,.42)!important}
.chat-msg.user{background:linear-gradient(180deg,rgba(39,69,51,.97),rgba(25,48,35,.96))!important;border-color:rgba(186,255,103,.20)!important}
.chat-msg.assistant strong,.chat-section{color:var(--accent)!important}

.bottom-nav{
  background:rgba(5,14,10,.96)!important;
  border-color:rgba(159,214,185,.25)!important;outline:1px solid rgba(255,255,255,.04)!important;
  box-shadow:0 14px 34px rgba(0,0,0,.43),0 0 20px rgba(186,255,103,.06)!important;
}
.nav-item{transition:background .18s ease,color .18s ease,box-shadow .18s ease}
.nav-item.active{
  background:linear-gradient(180deg,rgba(186,255,103,.16),rgba(56,201,255,.055))!important;
  color:#efffe9!important;box-shadow:inset 0 0 0 1px rgba(186,255,103,.22),0 0 17px rgba(186,255,103,.055)!important;
}
.nav-item.active span{filter:drop-shadow(0 0 6px rgba(186,255,103,.24))}
.groups-hero{background:linear-gradient(145deg,rgba(13,31,22,.98),rgba(7,19,14,.97))!important}
.coming-badge{background:rgba(186,255,103,.055);border-color:rgba(186,255,103,.30)!important}
.auth-screen{background:radial-gradient(circle at 50% 0,rgba(56,201,255,.07),transparent 34%),radial-gradient(circle at 25% 18%,rgba(186,255,103,.08),transparent 28%),linear-gradient(180deg,#07120e,#050d0b)!important}

@media(max-width:700px){
  .app-shell{padding:10px 10px 98px}.topbar{margin-bottom:12px}
  .gr-mark{width:43px;height:43px;border-radius:13px!important}
  .gr-word strong{font-size:13px!important;letter-spacing:.10em!important}
  .gr-word small{display:none!important}
  .giq-logo{font-size:28px!important;padding:7px 8px 9px!important}
  .card{border-radius:16px}.hero{border-radius:18px}
}
'''

if 'GOLF RECON v14 — Data-Tech + Recon visual system' in s:
    raise SystemExit('v14 CSS already applied')
s=s.replace('</style>',css+'\n</style>',1)

if re.search(r'GolfIQ|GOLFIQ|Golf IQ',s,re.I):
    raise SystemExit('Deprecated GolfIQ branding still present')
if '<small>Platoons</small>' not in s:
    raise SystemExit('Platoons tab missing')
if 'GOLF RECON' not in s:
    raise SystemExit('Golf Recon brand missing')

p.write_text(s)
scripts=re.findall(r'<script>(.*?)</script>',s,re.S)
Path('/tmp/golfrecon-v14.js').write_text('\n'.join(scripts))
r=subprocess.run(['node','--check','/tmp/golfrecon-v14.js'],capture_output=True,text=True)
if r.returncode:
    print(r.stderr)
    raise SystemExit('Frontend JavaScript syntax check failed')
print('Golf Recon v14 visual patch applied; JS syntax check passed.')
