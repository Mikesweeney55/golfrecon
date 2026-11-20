(()=>{
'use strict';
// Audit Phase 6: do not async-load platoon-display-fixes.js (race with results/real).
for(const src of ['dev-mobile-pregame-fix-core.js?v=5']){
  const s=document.createElement('script');s.src=src;document.head.appendChild(s);
}
})();
