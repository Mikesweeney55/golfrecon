(()=>{
'use strict';

window.GR_PREVIEW_MODE=true;

const previewBadge=document.createElement('div');
previewBadge.id='grPreviewBadge';
previewBadge.textContent='PREVIEW v15.5 · Platoon changes stay in this preview';
Object.assign(previewBadge.style,{
  position:'fixed',top:'8px',left:'50%',transform:'translateX(-50%)',zIndex:'99999',
  background:'#f0c419',color:'#16120a',border:'1px solid rgba(0,0,0,.35)',borderRadius:'999px',
  padding:'7px 11px',fontSize:'11px',fontWeight:'900',letterSpacing:'.03em',boxShadow:'0 4px 16px rgba(0,0,0,.3)'
});

function installBadge(){if(!document.getElementById('grPreviewBadge'))document.body.appendChild(previewBadge)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installBadge,{once:true});else installBadge();

const originalCall=typeof window.callPlatoonFunction==='function'?window.callPlatoonFunction:null;
if(originalCall){
  const previewCall=async payload=>{
    if(payload&&payload.action==='save_state'){
      let platoon=null;
      try{platoon=typeof loadPlatoonLocal==='function'?loadPlatoonLocal():null}catch{}
      return {preview:true,platoon};
    }
    return originalCall(payload);
  };
  try{window.callPlatoonFunction=previewCall}catch{}
  try{callPlatoonFunction=previewCall}catch{}
}

function localOnlySave(p){
  try{if(typeof writePlatoonLocal==='function')writePlatoonLocal(p)}catch{}
  try{if(typeof render==='function')render()}catch{}
  return p;
}
try{window.savePlatoonLocal=localOnlySave}catch{}
try{savePlatoonLocal=localOnlySave}catch{}
try{window.queuePlatoonServerSave=()=>{}}catch{}
try{queuePlatoonServerSave=()=>{}}catch{}
try{window.pushPlatoonServer=async()=>({preview:true})}catch{}
try{pushPlatoonServer=async()=>({preview:true})}catch{}

})();
