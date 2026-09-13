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
    js.write_text(text)

idx = Path('index.html')
html = idx.read_text()
html = html.replace('past-mission-import.js?v=2', 'past-mission-import.js?v=3')
idx.write_text(html)

# workflow trigger marker v1
