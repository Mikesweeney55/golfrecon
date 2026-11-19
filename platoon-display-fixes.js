(()=>{
'use strict';
/**
 * Retired (audit Phase 6). Course cleanup + standings rewrites moved to
 * platoon-recap-shared.js / platoons-v15-real.js. Kept as a no-op for any
 * cached callers of grInstallDisplayFixes.
 */
window.grApplyMissionStandings=function(){};
window.grMissionStandingsBlockMarkup=function(m,p){
  if(typeof window.grMissionStandingsMarkup==='function')return window.grMissionStandingsMarkup(m,p);
  return '';
};
window.grInstallDisplayFixes=function(){};
window.grDisplayFixesRetired=true;
})();
