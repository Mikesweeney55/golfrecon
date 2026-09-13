(()=>{
'use strict';
for(const src of ['dev-mobile-pregame-fix-core.js?v=1','dev-platoon-recap-v1.js?v=1','dev-post-mission-recap-v1.js?v=1']){
  const s=document.createElement('script');
  s.src=src;
  document.head.appendChild(s);
}
})();
