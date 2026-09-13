(()=>{
'use strict';
const load=(src,done)=>{const s=document.createElement('script');s.src=src;s.onload=()=>done&&done();document.head.appendChild(s)};
load('dev-mobile-pregame-fix-core.js?v=2');
window.addEventListener('load',()=>{
  load('dev-platoon-recap-v1.js?v=2',()=>{
    load('dev-post-mission-recap-v1.js?v=2');
  });
},{once:true});
})();
