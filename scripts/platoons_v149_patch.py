from pathlib import Path
import re

p = Path('index.html')
s = p.read_text()

if 'Golf Recon v14.9 Beta' in s:
    print('v14.9 already applied')
    raise SystemExit(0)

assert '<title>Golf Recon v14.8 Beta</title>' in s
assert '<span>v14.8 Beta</span>' in s
s = s.replace('<title>Golf Recon v14.8 Beta</title>', '<title>Golf Recon v14.9 Beta</title>', 1)
s = s.replace('<span>v14.8 Beta</span>', '<span>v14.9 Beta</span>', 1)

css = r'''
/* v14.9 Platoons foundation */
.platoon-shell{display:grid;gap:14px}
.platoon-command{padding:20px;background:radial-gradient(circle at 88% 0,rgba(56,201,255,.08),transparent 36%),linear-gradient(145deg,rgba(13,31,22,.98),rgba(7,19,14,.98));overflow:hidden;position:relative}
.platoon-command:after{content:"";position:absolute;inset:auto -50px -70px auto;width:190px;height:190px;border:1px solid rgba(186,255,103,.09);border-radius:50%;box-shadow:0 0 0 28px rgba(186,255,103,.025),0 0 0 58px rgba(56,201,255,.018);pointer-events:none}
.platoon-command-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;position:relative;z-index:1}
.platoon-title{font-size:28px;line-height:1;margin:6px 0 8px;letter-spacing:-.04em}.platoon-sub{font-size:12px;color:var(--muted);max-width:520px}
.platoon-status{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px;position:relative;z-index:1}.platoon-status .badge{min-width:auto}
.platoon-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:14px;position:relative;z-index:1}
.platoon-kpi{border:1px solid var(--line);background:rgba(8,19,14,.62);border-radius:14px;padding:11px 10px}.platoon-kpi strong{display:block;font-size:18px}.platoon-kpi span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em;margin-top:2px}
.platoon-section-title{display:flex;justify-content:space-between;align-items:end;gap:10px;margin-bottom:10px}.platoon-section-title h3{margin:0;font-size:16px}.platoon-section-title .muted{font-size:10px}
.mission-card{padding:0;overflow:hidden}.mission-banner{padding:16px;background:linear-gradient(135deg,rgba(184,234,104,.08),rgba(56,201,255,.025));border-bottom:1px solid var(--line)}
.mission-tag{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:5px 8px;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.mission-tag.skirmish{color:#d4e3db}.mission-tag.battle{color:#ffe272;border-color:rgba(255,226,114,.35)}.mission-tag.war{color:#ff8d8d;border-color:rgba(255,77,79,.4)}
.mission-empty{padding:22px 16px}.mission-empty strong{display:block;font-size:18px;margin-bottom:5px}.mission-flow{display:flex;gap:6px;align-items:center;margin-top:13px;color:var(--muted);font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.mission-flow b{color:var(--accent)}
.platoon-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr);gap:14px}
.calendar-card{padding:15px}.calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.calendar-dow{text-align:center;color:var(--muted);font-size:8px;text-transform:uppercase;padding:3px}.calendar-day{min-height:42px;border:1px solid rgba(255,255,255,.045);background:rgba(9,18,15,.36);border-radius:9px;padding:5px;font-size:10px;color:#dce7e2}.calendar-day.muted-day{opacity:.22}.calendar-day.today{border-color:rgba(184,234,104,.38);box-shadow:inset 0 0 0 1px rgba(184,234,104,.08)}
.roster-list{display:grid;gap:7px;margin-top:10px}.roster-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.055)}.roster-row:last-child{border-bottom:0}.roster-name{font-weight:850;font-size:12px}.roster-role{font-size:9px;color:var(--muted)}.linked-pill{font-size:8px;padding:3px 6px;border-radius:999px;border:1px solid rgba(184,234,104,.28);color:var(--accent)}
.platoon-feed-item{display:grid;grid-template-columns:34px 1fr;gap:10px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.055)}.platoon-feed-item:last-child{border-bottom:0}.feed-avatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#1b2b24;border:1px solid var(--line);font-size:12px;font-weight:900}.feed-copy strong{display:block;font-size:12px}.feed-copy p{margin:3px 0 0;font-size:11px;color:var(--muted)}
.cup-snapshot{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:9px}.cup-cell{padding:10px;border:1px solid var(--line);background:#101a16;border-radius:12px}.cup-cell strong{display:block;font-size:11px}.cup-cell span{display:block;font-size:9px;color:var(--muted);margin-top:3px}.cup-cell .mission-tag{margin-top:7px}
.eagle-lockup{display:flex;gap:12px;align-items:center}.eagle-mark{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(184,234,104,.28);background:rgba(184,234,104,.06);font-size:22px}.eagle-lockup h3{margin:0 0 3px}.eagle-lockup .muted{font-size:10px}
.privacy-card{border-left:3px solid rgba(56,201,255,.45)}.privacy-stats{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.privacy-stats .badge{min-width:auto}
@media(max-width:700px){.platoon-grid{grid-template-columns:1fr}.platoon-kpis{grid-template-columns:repeat(2,1fr)}.platoon-command{padding:16px}.platoon-title{font-size:24px}.calendar-day{min-height:36px;padding:4px}.platoon-command-head{display:block}}
'''
assert '</style>' in s
s = s.replace('</style>', css + '\n</style>', 1)

new_func = r'''function groupsView(){
  const playerName=db.player?.name||db.player?.username||'Golfer';
  const handicap=db.player?.handicap==null?'—':Number(db.player.handicap).toFixed(1);
  const fullRounds=(db.rounds||[]).filter(r=>Number(r.holes)===18);
  const avgGross=fullRounds.length?(fullRounds.reduce((a,r)=>a+(Number(r.gross)||0),0)/fullRounds.length).toFixed(1):'—';
  const coreCadets=[
    {name:playerName,linked:true,role:'Owner · Golf Recon linked'},
    {name:'Sully',role:'Cadet'},{name:'Steve',role:'Cadet'},{name:'Chuck',role:'Cadet'},{name:'Cunny',role:'Cadet'},{name:'Mannke',role:'Cadet'}
  ];
  const now=new Date(),year=now.getFullYear(),month=now.getMonth();
  const monthName=now.toLocaleString(undefined,{month:'long',year:'numeric'});
  const firstDay=new Date(year,month,1).getDay(),daysInMonth=new Date(year,month+1,0).getDate(),prevDays=new Date(year,month,0).getDate();
  const cells=[];
  for(let i=firstDay-1;i>=0;i--)cells.push(`<div class="calendar-day muted-day">${prevDays-i}</div>`);
  for(let d=1;d<=daysInMonth;d++)cells.push(`<div class="calendar-day ${d===now.getDate()?'today':''}">${d}</div>`);
  let next=1;while(cells.length%7)cells.push(`<div class="calendar-day muted-day">${next++}</div>`);
  return `<div class="section-head"><div><div class="eyebrow">PLATOON HQ</div><h2>My Time</h2></div><span class="coming-badge">V1 FOUNDATION</span></div>
  <div class="platoon-shell">
    <section class="card platoon-command">
      <div class="platoon-command-head"><div><div class="eyebrow">MY TIME · ACTIVE PLATOON</div><div class="platoon-title">Our golf. One memory.</div><div class="platoon-sub">Calendar, Missions, Cup standings, shared stories and the history that lives between the rounds.</div></div></div>
      <div class="platoon-status"><span class="badge">6 core cadets</span><span class="badge">2026 season</span><span class="badge">Private platoon</span></div>
      <div class="platoon-kpis"><div class="platoon-kpi"><strong>—</strong><span>Next Mission</span></div><div class="platoon-kpi"><strong>6</strong><span>Core Cadets</span></div><div class="platoon-kpi"><strong>—</strong><span>Cup Leader</span></div><div class="platoon-kpi"><strong>—</strong><span>Club Eagles</span></div></div>
    </section>
    <section class="card mission-card"><div class="mission-banner"><span class="mission-tag battle">MISSION CONTROL</span></div><div class="mission-empty"><strong>No upcoming mission scheduled.</strong><div class="muted">A Mission will hold the date, course, Skirmish/Battle/War level, cadets, preview, results and recap.</div><div class="mission-flow"><b>Planned</b><span>→</span><span>Ready</span><span>→</span><span>Completed</span></div></div></section>
    <div class="platoon-grid">
      <section class="card calendar-card"><div class="platoon-section-title"><div><div class="eyebrow">MISSION CALENDAR</div><h3>${monthName}</h3></div><span class="muted">Upcoming + history</span></div><div class="calendar-grid">${['S','M','T','W','T','F','S'].map(x=>`<div class="calendar-dow">${x}</div>`).join('')}${cells.join('')}</div><div class="muted" style="font-size:10px;margin-top:10px">Mission markers will appear here once the Platoons database is connected.</div></section>
      <section class="card"><div class="platoon-section-title"><div><div class="eyebrow">CADETS</div><h3>My Time roster</h3></div><span class="muted">Linked + guests</span></div><div class="roster-list">${coreCadets.map(m=>`<div class="roster-row"><div><div class="roster-name">${m.name}</div><div class="roster-role">${m.role}</div></div>${m.linked?'<span class="linked-pill">LINKED</span>':'<span class="linked-pill" style="color:var(--muted);border-color:var(--line)">CADET</span>'}</div>`).join('')}</div></section>
    </div>
    <div class="platoon-grid">
      <section class="card"><div class="platoon-section-title"><div><div class="eyebrow">PLATOON FEED</div><h3>Clubhouse</h3></div><span class="muted">Posts · photos · video</span></div><div class="platoon-feed-item"><div class="feed-avatar">GR</div><div class="feed-copy"><strong>Mission posts live here.</strong><p>Previews, recaps, photos, videos and cadet comments can all attach to the Platoon or a specific Mission.</p></div></div><div class="platoon-feed-item"><div class="feed-avatar">↗</div><div class="feed-copy"><strong>Automatic mission stories</strong><p>Completing a Mission can publish its winner, low gross/net, Cup movement and Club Eagle moments into the feed.</p></div></div></section>
      <section class="card privacy-card"><div class="eyebrow">YOUR PLATOON CARD</div><h3 style="margin:5px 0 4px">${playerName}</h3><div class="muted" style="font-size:10px">Only high-level individual data belongs here. Detailed rounds, putting and swing thoughts stay private.</div><div class="privacy-stats"><span class="badge">HCP ${handicap}</span><span class="badge">Avg ${avgGross}</span><span class="badge">${fullRounds.length} 18-hole rounds</span></div></section>
    </div>
    <div class="platoon-grid">
      <section class="card"><div class="platoon-section-title"><div><div class="eyebrow">MY TIME CUP</div><h3>Standings architecture</h3></div><span class="muted">Raw points → Cup score</span></div><div class="cup-snapshot"><div class="cup-cell"><strong>Skirmish</strong><span>Low-value mission</span><span class="mission-tag skirmish">LOW</span></div><div class="cup-cell"><strong>Battle</strong><span>Medium-value mission</span><span class="mission-tag battle">MED</span></div><div class="cup-cell"><strong>War</strong><span>High-value mission</span><span class="mission-tag war">HIGH</span></div></div><div class="muted" style="font-size:10px;margin-top:10px">Mission points stay historical. Cup scoring is normalized separately so the formula can evolve without rewriting results.</div></section>
      <section class="card"><div class="eagle-lockup"><div class="eagle-mark">🦅</div><div><div class="eyebrow">CLUB EAGLE</div><h3>Platoon honors</h3><div class="muted">Every eagle links back to the Mission and, when available, the golfer's detailed round.</div></div></div><div class="empty" style="padding:18px 0 4px">No eagle records loaded yet.</div></section>
    </div>
  </div>`;
}'''

pattern = r'function groupsView\(\)\{.*?\n\}\n\nfunction myGame'
m = re.search(pattern, s, re.S)
assert m, 'groupsView block not found'
s = s[:m.start()] + new_func + '\n\nfunction myGame' + s[m.end():]
p.write_text(s)
