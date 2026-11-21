(()=>{
'use strict';
// Prefer a direct <script src="dev-mobile-pregame-form-core.js"> in index.html.
// Kept as a tiny sync loader so older cached HTML still works without racing Setup/HQ.
if(!window.__grSupabaseFirstSaveInstalled){
  const s=document.createElement('script');
  s.src='dev-mobile-pregame-form-core.js?v=7';
  s.async=false;
  document.head.appendChild(s);
}
})();
