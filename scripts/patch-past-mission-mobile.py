from pathlib import Path

js = Path('past-mission-import.js')
text = js.read_text()

marker = "grPastMissionMobileFix"
if marker not in text:
    needle = "'use strict';\n"
    patch = """'use strict';
if(!document.getElementById('grPastMissionMobileFix')){
  const style=document.createElement('style');
  style.id='grPastMissionMobileFix';
  style.textContent=`
#grPastMissionDialog{width:min(720px,calc(100vw - 20px))!important;max-height:calc(100dvh - 20px)!important;overflow:hidden!important;padding:0!important}
#grPastMissionDialog .dialog-card{max-height:calc(100dvh - 20px)!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important;touch-action:pan-y!important;padding-bottom:calc(28px + env(safe-area-inset-bottom))!important}
#grPastMissionDialog input,#grPastMissionDialog select,#grPastMissionDialog textarea{width:100%!important;min-width:0!important;max-width:100%!important}
@media(max-width:700px){
  #grPastMissionDialog{width:calc(100vw - 16px)!important;max-height:calc(100dvh - 16px)!important}
  #grPastMissionDialog .dialog-card{max-height:calc(100dvh - 16px)!important;padding:18px 14px calc(34px + env(safe-area-inset-bottom))!important}
  #grPastMissionDialog .grid.two{grid-template-columns:1fr!important}
  #grPastMissionDialog .dialog-actions{position:sticky!important;bottom:0!important;background:#16221d!important;padding:12px 0 4px!important;z-index:5!important}
}
`;
  document.head.appendChild(style);
}
"""
    if needle not in text:
        raise SystemExit('Could not find strict-mode marker in past-mission-import.js')
    text = text.replace(needle, patch, 1)

old = "function aliasesOf(m){let a=[];if(Array.isArray(m?.aliases))a=m.aliases;else if(typeof m?.aliases==='string')a=m.aliases.split(/[,|]/);else if(typeof m?.nickname==='string')a=m.nickname.split(/[,|]/);return a.map(x=>String(x||'').trim()).filter(Boolean)}\nfunction canonicalMember(p,raw){const n=norm(raw);if(!n)return null;const exact=(p?.members||[]).filter(m=>[m.name,...aliasesOf(m)].map(norm).includes(n));if(exact.length===1)return exact[0];const first=n.split(' ')[0],fm=(p?.members||[]).filter(m=>norm(m.name).split(' ')[0]===first);return fm.length===1?fm[0]:null}"
new = "const DEFAULT_ALIASES={mike:['Mike','Mike S.','Sweeney'],ryan:['Ryan','Ryan S.','Sully'],steve:['Steve','Stephen'],charlie:['Charlie','Chuck'],kevin:['Kevin','Kevin C.','Cunny'],josh:['Josh','Joshua','Mannke']};\nfunction aliasesOf(m){let a=[];if(Array.isArray(m?.aliases))a=m.aliases;else if(typeof m?.aliases==='string')a=m.aliases.split(/[,|]/);else if(typeof m?.nickname==='string')a=m.nickname.split(/[,|]/);a=a.map(x=>String(x||'').trim()).filter(Boolean);if(!a.length){const first=norm(m?.name).split(' ')[0];a=DEFAULT_ALIASES[first]||[]}return [...new Set(a)]}\nfunction canonicalMember(p,raw){const n=norm(raw);if(!n)return null;const exact=(p?.members||[]).filter(m=>[m.name,...aliasesOf(m)].map(norm).includes(n));if(exact.length===1)return exact[0];const first=n.split(' ')[0];const aliasFirst=(p?.members||[]).filter(m=>[m.name,...aliasesOf(m)].map(norm).some(v=>v.split(' ')[0]===first));if(aliasFirst.length===1)return aliasFirst[0];return null}"
if old in text:
    text = text.replace(old, new, 1)
elif 'const DEFAULT_ALIASES=' not in text:
    raise SystemExit('Could not patch historical alias matching')

needle = "function fmtBytes(n){if(!Number.isFinite(n))return'';if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(1)} KB`;return`${(n/1048576).toFixed(1)} MB`}"
if 'function cleanCourseName(' not in text:
    repl = needle + "\nfunction cleanCourseName(v){return String(v||'').replace(/\\s*\\([^)]*(?:\\.\\.\\.|…)[^)]*\\)\\s*/g,' ').replace(/\\s*\\?{2,}\\s*$/,'').replace(/\\s{2,}/g,' ').trim()}"
    if needle not in text:
        raise SystemExit('Could not add course cleaner')
    text = text.replace(needle, repl, 1)

text = text.replace("value=\"${esc(ev.course_name||'')}\"", "value=\"${esc(cleanCourseName(ev.course_name||''))}\"")

old = "if(!saved.length)return alert('Match at least one player before creating the Mission.');\n        const story=d.querySelector('#grPastStory')?.value.trim()||'';"
new = "if(!saved.length)return alert('Match at least one player before creating the Mission.');\n        if(saved.length<results.length){const missing=[...out.querySelectorAll('.gr-past-result')].filter(row=>!row.querySelector('[data-match]')?.value).map(row=>results[Number(row.dataset.i)]?.player_name).filter(Boolean);return alert(`Match every player before creating the Mission.${missing.length?` Still unmatched: ${missing.join(', ')}`:''}`)}\n        const story=d.querySelector('#grPastStory')?.value.trim()||'';"
if old in text:
    text = text.replace(old, new, 1)
elif 'Match every player before creating the Mission' not in text:
    raise SystemExit('Could not add unmatched-player guard')

old = "const mission={id:uid(),date,teeTime,type:'battle',courseId:'',locationName,title,format,notes:'',status:'completed',participants:[...new Set(participants)],results:saved};if(story)mission.recap_note=story;"
new = "const mission={id:uid(),date,teeTime,type:'battle',courseId:'',locationName,title,format,notes:story,status:'completed',participants:[...new Set(participants)],results:saved};if(story)mission.recap_note=story;"
if old in text:
    text = text.replace(old, new, 1)
elif 'notes:story' not in text:
    raise SystemExit('Could not persist round story')

js.write_text(text)

results_js = Path('dev-v15.5-results.js')
rtext = results_js.read_text()
rtext = rtext.replace("const note=String(m?.recap_note||'').trim();", "const note=String(m?.recap_note||m?.notes||'').trim();")
results_js.write_text(rtext)

idx = Path('index.html')
html = idx.read_text()
html = html.replace('past-mission-import.js?v=3', 'past-mission-import.js?v=4')
html = html.replace('dev-v15.5-results.js?v=157', 'dev-v15.5-results.js?v=158')
idx.write_text(html)
