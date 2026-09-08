from pathlib import Path
import re, subprocess

p=Path('index.html')
s=p.read_text()

if 'GOLF RECON v14.1 — deeper visual conversion' in s:
    raise SystemExit('v14.1 visual system already applied')

s=s.replace('<title>Golf Recon v14 Beta</title>','<title>Golf Recon v14.1 Beta</title>',1)
s=s.replace('<span>v14 Beta</span>','<span>v14.1 Beta</span>',1)
s=s.replace('<div class="eyebrow">GOLFRECON BETA</div>','<div class="eyebrow">GOLF RECON BETA</div>',1)
s=s.replace('New to GolfRecon? Create account','New to Golf Recon? Create account')

css=r'''

/* =========================================================
   GOLF RECON v14.1 — deeper visual conversion
   ========================================================= */
:root{
  --bg:#030806;
  --panel:#0b1511;
  --panel2:#102019;
  --line:#28483a;
  --text:#f3f8f5;
  --muted:#9fb4ab;
  --accent:#c7ff66;
  --accent2:#43b4ff;
  --accent3:#79ffd2;
  --shadow:0 20px 46px rgba(0,0,0,.44);
}
html{background:#030806}
body{
  background:
    radial-gradient(circle at 14% -5%,rgba(121,255,210,.13),transparent 25%),
    radial-gradient(circle at 96% 2%,rgba(67,180,255,.12),transparent 23%),
    radial-gradient(circle at 72% 86%,rgba(199,255,102,.08),transparent 29%),
    linear-gradient(180deg,#06100c 0%,#030806 54%,#020604 100%)!important;
  color:var(--text);
  position:relative;
  overflow-x:hidden;
}
body::before{
  content:'';
  position:fixed;
  inset:0;
  pointer-events:none;
  z-index:0;
  background-image:
    linear-gradient(rgba(199,255,102,.044) 1px,transparent 1px),
    linear-gradient(90deg,rgba(199,255,102,.044) 1px,transparent 1px),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='620' height='620' viewBox='0 0 620 620'%3E%3Cg fill='none' stroke='%2379ffd2' stroke-opacity='.075' stroke-width='1.2'%3E%3Cpath d='M-20 130 C70 70 135 165 225 115 S385 35 505 115 S650 145 705 85'/%3E%3Cpath d='M-25 170 C65 110 145 200 235 150 S395 70 520 150 S650 180 710 120'/%3E%3Cpath d='M-30 210 C55 150 150 235 250 188 S420 110 540 190 S670 215 725 165'/%3E%3Cpath d='M-20 405 C65 350 135 435 230 388 S395 315 505 385 S650 425 710 365'/%3E%3Cpath d='M-15 445 C70 390 150 475 245 425 S410 355 530 425 S655 465 720 405'/%3E%3C/g%3E%3C/svg%3E");
  background-size:34px 34px,34px 34px,620px 620px;
  opacity:.64;
}
body::after{
  content:'';
  position:fixed;
  inset:0;
  pointer-events:none;
  z-index:0;
  background:
    repeating-radial-gradient(circle at 12% 20%,transparent 0 38px,rgba(199,255,102,.026) 38px 40px,transparent 40px 78px),
    repeating-radial-gradient(circle at 83% 73%,transparent 0 48px,rgba(67,180,255,.024) 48px 50px,transparent 50px 96px);
  opacity:.42;
}
.app-shell,.auth-gate{position:relative;z-index:1}
.app-shell{max-width:1180px;padding:16px 20px 108px}

.topbar{
  min-height:76px;
  padding:13px 18px;
  margin-bottom:14px;
  border:1px solid rgba(199,255,102,.17);
  border-radius:16px;
  background:
    linear-gradient(110deg,rgba(15,30,23,.97),rgba(8,16,13,.96) 58%,rgba(10,24,26,.94));
  box-shadow:0 20px 44px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.03),0 0 28px rgba(67,180,255,.055);
  overflow:hidden;
}
.topbar::before{
  content:'';
  position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(199,255,102,.045),transparent 46%,rgba(67,180,255,.035),transparent);
}
.topbar::after{
  content:'';position:absolute;left:18px;right:18px;bottom:0;height:1px;pointer-events:none;
  background:linear-gradient(90deg,transparent,var(--accent),var(--accent2),transparent);opacity:.55;
}
.topbar-left,.topbar-right,.giq-logo{position:relative;z-index:1}
.gr-brand{gap:12px}
.gr-mark{
  width:56px!important;height:56px!important;border-radius:12px!important;
  border:1px solid rgba(199,255,102,.62)!important;
  background:linear-gradient(145deg,rgba(24,54,38,.98),rgba(6,20,14,.98))!important;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.045),0 0 22px rgba(199,255,102,.12)!important;
}
.gr-mark:before{box-shadow:0 0 8px rgba(199,255,102,.35)}
.gr-mark:after{box-shadow:0 0 8px rgba(199,255,102,.35)}
.gr-cross{font-size:19px!important}
.gr-flag{color:var(--accent2)!important;text-shadow:0 0 10px rgba(67,180,255,.5)}
.gr-word strong{font-size:20px!important;letter-spacing:.15em!important;color:#f5faf7}
.gr-word small{font-size:7px!important;letter-spacing:.22em!important;color:#9eb4aa!important}
.brand-meta{margin-top:6px!important;letter-spacing:.10em;text-transform:uppercase}
.giq-logo{
  font-size:42px!important;
  border:1px solid rgba(199,255,102,.15)!important;
  border-radius:12px!important;
  background:linear-gradient(180deg,rgba(18,40,29,.78),rgba(5,17,12,.48))!important;
  padding:7px 14px 10px!important;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.025),0 0 24px rgba(199,255,102,.045)!important;
}
.giq-logo::after{background:linear-gradient(90deg,transparent,var(--accent),var(--accent2),transparent)!important}

.global-course-bar{
  top:7px!important;
  margin-bottom:18px!important;
  padding:12px 14px!important;
  border-radius:14px!important;
  background:linear-gradient(180deg,rgba(14,29,22,.965),rgba(7,18,13,.965))!important;
  border-color:rgba(199,255,102,.19)!important;
  box-shadow:0 16px 36px rgba(0,0,0,.31),0 0 26px rgba(199,255,102,.05)!important;
}
.global-course-label strong{font-size:16px!important;letter-spacing:-.01em}
.global-course-select{height:40px;border-radius:10px!important;background:#0d1d17!important;border-color:rgba(199,255,102,.22)!important}

.card,.hero,.chart-card,.dialog-card,.auth-card,.direction-card,.tendency-card,.hole-card,.course-stat-lines,.chat-msg.assistant{
  background:linear-gradient(180deg,rgba(13,25,20,.975),rgba(8,16,13,.965))!important;
  border-color:rgba(165,220,192,.15)!important;
  border-radius:14px!important;
  box-shadow:0 18px 42px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.025),0 0 22px rgba(67,180,255,.03)!important;
}
.card,.hero,.chart-card,.dialog-card,.auth-card,.direction-card,.tendency-card,.hole-card{overflow:hidden}
.card::before,.hero::before,.chart-card::before,.dialog-card::before,.auth-card::before,.direction-card::before,.tendency-card::before,.hole-card::before{
  content:'';position:absolute;left:0;top:0;width:34px;height:34px;pointer-events:none;
  border-left:2px solid rgba(199,255,102,.5);border-top:2px solid rgba(199,255,102,.5);
}
.card::after,.hero::after,.chart-card::after,.dialog-card::after,.auth-card::after,.direction-card::after,.tendency-card::after,.hole-card::after{
  content:'';position:absolute;right:0;bottom:0;width:34px;height:34px;pointer-events:none;
  border-right:1px solid rgba(67,180,255,.36);border-bottom:1px solid rgba(67,180,255,.36);
}
.hero{
  padding:24px 25px!important;
  background:
    linear-gradient(120deg,rgba(17,36,27,.98),rgba(8,18,13,.97) 58%,rgba(9,22,24,.96))!important;
}
.hero h2{font-size:38px;letter-spacing:-.045em}
.eyebrow{color:var(--accent)!important;letter-spacing:.20em;text-shadow:0 0 12px rgba(199,255,102,.12)}
.section-head{margin:27px 0 11px;padding-bottom:9px;border-bottom:1px solid rgba(199,255,102,.11)}
.section-head h2{font-size:23px;letter-spacing:-.035em}
.muted{color:#a4b9b0!important}
.metric{font-size:34px;letter-spacing:-.055em}
.metric-label{letter-spacing:.14em}

.button{border-radius:10px!important;font-weight:900!important;letter-spacing:.02em}
.button.primary{background:linear-gradient(180deg,#d2ff7c,#a9eb5d)!important;color:#0d1b11!important;box-shadow:0 0 22px rgba(199,255,102,.12)!important}
.button.secondary,.mini-link{background:linear-gradient(180deg,rgba(20,36,29,.98),rgba(12,24,19,.98))!important;border-color:rgba(199,255,102,.14)!important;color:#eef7f2!important}
input,select,textarea,.chat-input,.target-select,.pregame-course-select{
  background:#0c1b15!important;border-color:rgba(199,255,102,.16)!important;border-radius:10px!important;color:#eef7f2!important;
}
input:focus,select:focus,textarea:focus,.chat-input:focus,.pregame-course-select:focus{border-color:rgba(199,255,102,.58)!important;box-shadow:0 0 0 2px rgba(199,255,102,.07)!important}

.pregame-hero{
  background:linear-gradient(120deg,rgba(14,31,23,.99),rgba(7,17,12,.985) 62%,rgba(8,21,22,.98))!important;
  border-color:rgba(199,255,102,.20)!important;
  box-shadow:0 18px 40px rgba(0,0,0,.36),0 0 24px rgba(199,255,102,.045)!important;
}
.pregame-hero .course-stat-lines{background:rgba(4,13,9,.5)!important}
.course-stat-row{border-bottom-color:rgba(199,255,102,.075)!important}
.game-keys-card{background:linear-gradient(180deg,rgba(11,24,18,.96),rgba(7,16,12,.96))!important}
.game-key-pill{background:rgba(199,255,102,.055)!important;border-color:rgba(199,255,102,.23)!important;color:#e7f7dd!important}

.chart-card{padding:16px 14px 12px!important}
.chart-head strong{font-size:20px;letter-spacing:-.025em}
.round-chart{height:264px!important;gap:8px!important;border-bottom-color:rgba(199,255,102,.11)!important}
.bar{background:linear-gradient(180deg,var(--accent),#72dfaa,var(--accent2))!important;box-shadow:0 0 16px rgba(67,180,255,.08)!important}
.bar-value{color:#f4faf6!important}
.stat-tab,.course-pill,.putting-course,.filter-tab,.game-round-btn,.chat-prompt,.chat-clear,.badge{
  background:#0d1d17!important;border-color:rgba(199,255,102,.12)!important;color:#eaf3ef!important;border-radius:999px!important;
}
.stat-tab.active,.course-pill.active,.putting-course.active,.filter-tab.active,.game-round-btn.active{
  background:linear-gradient(180deg,rgba(199,255,102,.18),rgba(67,180,255,.065))!important;
  border-color:rgba(199,255,102,.34)!important;color:#f5fff8!important;box-shadow:0 0 16px rgba(199,255,102,.055)!important;
}
.direction-card{background:radial-gradient(circle at 50% 50%,rgba(67,180,255,.055),rgba(8,17,13,.97) 58%)!important}
.direction-center{background:linear-gradient(145deg,#2d7adf,#48c7ff)!important;box-shadow:0 0 22px rgba(67,180,255,.14)!important}
.direction-ring{border-color:rgba(67,180,255,.15)!important}

.hole-card{background:linear-gradient(180deg,rgba(12,28,20,.98),rgba(7,17,12,.98))!important;border-width:1px!important}
.hole-card.risk-low{box-shadow:inset 0 0 0 1px rgba(35,197,82,.18),0 0 18px rgba(35,197,82,.035)!important}
.hole-card.risk-medium{box-shadow:inset 0 0 0 1px rgba(255,212,0,.17),0 0 18px rgba(255,212,0,.035)!important}
.hole-card.risk-high{box-shadow:inset 0 0 0 1px rgba(255,77,79,.20),0 0 18px rgba(255,77,79,.045)!important}
.hole-preview-btn,.hole-ref-link{background:rgba(199,255,102,.06)!important;border-color:rgba(199,255,102,.25)!important}

.chat-msg.assistant{border-left:2px solid rgba(199,255,102,.46)!important;background:linear-gradient(180deg,rgba(10,22,17,.98),rgba(7,16,12,.98))!important}
.chat-msg.user{background:linear-gradient(180deg,rgba(34,63,46,.97),rgba(21,41,30,.97))!important;border-color:rgba(199,255,102,.18)!important}
.chat-msg.assistant strong,.chat-section{color:var(--accent)!important}

.bottom-nav{
  width:min(820px,calc(100% - 28px))!important;
  background:rgba(5,13,9,.965)!important;
  border-color:rgba(199,255,102,.19)!important;
  border-radius:16px!important;
  padding:8px!important;
  box-shadow:0 18px 36px rgba(0,0,0,.46),0 0 24px rgba(199,255,102,.055)!important;
}
.nav-item{padding:9px 5px!important;border-radius:10px!important}
.nav-item small{text-transform:uppercase;letter-spacing:.10em;font-size:10px!important}
.nav-item.active{background:linear-gradient(180deg,rgba(199,255,102,.17),rgba(67,180,255,.06))!important;color:#f5fff8!important;box-shadow:inset 0 0 0 1px rgba(199,255,102,.19),0 0 15px rgba(199,255,102,.05)!important}

.auth-gate{background:radial-gradient(circle at 50% 0,rgba(67,180,255,.11),transparent 30%),radial-gradient(circle at 20% 20%,rgba(199,255,102,.07),transparent 24%),linear-gradient(180deg,#06100c,#030806)!important}
.auth-card{max-width:470px;padding:30px 28px!important}
.auth-logo{font-size:58px!important;letter-spacing:-3px!important;margin-bottom:15px!important;text-shadow:0 0 20px rgba(199,255,102,.14)}

@media(max-width:760px){
  .app-shell{padding:10px 10px 100px!important}
  .topbar{grid-template-columns:minmax(0,1fr) auto!important;padding:10px 11px!important;border-radius:12px!important;min-height:62px!important}
  .topbar-left{min-width:0}
  .topbar-right{grid-column:2;grid-row:1;align-self:center}
  .giq-logo{display:none!important}
  .gr-mark{width:44px!important;height:44px!important;border-radius:10px!important}
  .gr-word strong{font-size:14px!important;letter-spacing:.12em!important}
  .gr-word small{display:none!important}
  .brand-meta{font-size:8px!important;margin-top:4px!important}
  .global-course-bar{top:4px!important;padding:9px 10px!important;border-radius:11px!important}
  .card,.hero,.chart-card,.dialog-card,.auth-card,.direction-card,.tendency-card,.hole-card{border-radius:12px!important}
  .hero{padding:18px!important}
  .hero h2{font-size:30px!important}
  .section-head{margin-top:22px!important}
  .section-head h2{font-size:20px!important}
  .hole-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .round-chart{height:238px!important}
}
@media(max-width:520px){
  .hole-grid{grid-template-columns:1fr!important}
  .gr-brand{gap:8px!important}
  .topbar-right .button{font-size:10px!important;padding:7px 9px!important}
}
'''

s=s.replace('</style>',css+'\n</style>',1)

# Preserve behavior and verify we did not break the embedded app.
scripts=re.findall(r'<script>(.*?)</script>',s,re.S)
Path('/tmp/golfrecon-v141.js').write_text('\n'.join(scripts))
r=subprocess.run(['node','--check','/tmp/golfrecon-v141.js'],capture_output=True,text=True)
if r.returncode:
    print(r.stderr)
    raise SystemExit('Frontend JavaScript syntax check failed')
if '<small>Platoons</small>' not in s:
    raise SystemExit('Platoons tab missing')
if 'Golf Recon v14.1 Beta' not in s:
    raise SystemExit('v14.1 title missing')

p.write_text(s)
print('Golf Recon v14.1 deeper visual conversion applied; JS syntax check passed.')
