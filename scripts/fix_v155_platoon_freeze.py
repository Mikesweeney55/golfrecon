from pathlib import Path

p=Path('dev-v15.5-results.js')
s=p.read_text()

old="""function enhanceAll(){installStyles();document.querySelectorAll('.gr-mission').forEach(enhanceMissionCard)}
installStyles();
new MutationObserver(enhanceAll).observe(document.body,{childList:true,subtree:true});
setTimeout(enhanceAll,0);setTimeout(enhanceAll,250);setTimeout(enhanceAll,900);
"""
new="""function enhanceAll(){installStyles();document.querySelectorAll('.gr-mission').forEach(enhanceMissionCard)}
installStyles();
let gr155EnhanceQueued=false;
function scheduleEnhanceAll(){
  if(gr155EnhanceQueued)return;
  gr155EnhanceQueued=true;
  requestAnimationFrame(()=>{
    gr155EnhanceQueued=false;
    enhanceAll();
  });
}
new MutationObserver(mutations=>{
  const relevant=mutations.some(mu=>[...mu.addedNodes].some(n=>
    n&&n.nodeType===1&&(
      n.matches?.('.gr-mission,#grPlatoonDialog')||
      n.querySelector?.('.gr-mission,#grPlatoonDialog')
    )
  ));
  if(relevant)scheduleEnhanceAll();
}).observe(document.body,{childList:true,subtree:true});
setTimeout(scheduleEnhanceAll,0);setTimeout(scheduleEnhanceAll,250);setTimeout(scheduleEnhanceAll,900);
"""

if old not in s:
    if new in s:
        raise SystemExit('already patched')
    raise SystemExit('observer anchor not found')

s=s.replace(old,new)
p.write_text(s)
