from pathlib import Path
import re

p=Path('index.html')
s=p.read_text()
assert 'Golf Recon v14.10 Beta' in s
assert "const PLATOON_LOCAL_KEY='golfreconPlatoonV1410';" in s
assert 'function openPlatoonSetup(){' in s
assert 'function openMissionEditor(' in s
assert 'async function callPlatoonFunction(' in s

s=s.replace('Golf Recon v14.10 Beta','Golf Recon v14.11 Beta')
s=s.replace('v14.10 Beta','v14.11 Beta')

css=r'''
/* v14.11 Platoons cross-device sync + logo */
.platoon-logo{position:absolute;right:18px;top:18px;width:72px;height:72px;border-radius:18px;object-fit:cover;border:1px solid rgba(184,234,104,.32);background:#0b1511;box-shadow:0 8px 26px rgba(0,0,0,.28);z-index:2}
.platoon-logo-setup{display:flex;gap:12px;align-items:center;margin-top:12px;padding:10px;border:1px solid var(--line);border-radius:14px;background:#101914}
.platoon-logo-preview{width:58px;height:58px;border-radius:14px;object-fit:cover;border:1px solid var(--line);background:#0c1511;display:grid;place-items:center;color:var(--muted);font-size:9px;text-align:center;overflow:hidden}
.platoon-logo-preview img{width:100%;height:100%;object-fit:cover}.platoon-logo-actions{display:flex;gap:7px;flex-wrap:wrap}.platoon-logo-actions .button{padding:8px 10px;font-size:10px}
.platoon-sync-error{font-size:9px;color:#ffb1b1;margin-top:8px}
@media(max-width:700px){.platoon-logo{width:58px;height:58px;right:13px;top:13px}.platoon-command-head{padding-right:66px}}
'''
s=s.replace('</style>',css+'\n</style>',1)

s=s.replace("const PLATOON_LOCAL_KEY='golfreconPlatoonV1410';","const PLATOON_LOCAL_KEY='golfreconPlatoonV1411';\nlet platoonSyncTimer=null,platoonSyncBusy=false,platoonSyncError='';")
s=s.replace("return {id:'my-time-local',name:'My Time',motto:\"It's Not About The Golf\",season:new Date().getFullYear(),visibility:'Private',chief,coChief:'',members:[",
            "return {id:'my-time-local',name:'My Time',motto:\"It's Not About The Golf\",logoData:'',season:new Date().getFullYear(),visibility:'Private',chief,coChief:'',members:[")

old="function savePlatoonLocal(p){try{localStorage.setItem(PLATOON_LOCAL_KEY,JSON.stringify(p))}catch{} render()}"
new=r'''function writePlatoonLocal(p){try{localStorage.setItem(PLATOON_LOCAL_KEY,JSON.stringify(p))}catch{}}
function savePlatoonLocal(p,push=true){writePlatoonLocal(p);render();if(push)queuePlatoonServerSave(p)}
function queuePlatoonServerSave(p){clearTimeout(platoonSyncTimer);platoonSyncTimer=setTimeout(()=>pushPlatoonServer(p),250)}
async function pushPlatoonServer(p){
  try{
    const out=await callPlatoonFunction({action:'save_state',snapshot:p});
    if(out?.platoon)writePlatoonLocal(out.platoon);
    platoonSyncError='';
    if(state.view==='groups')render();
  }catch(e){
    platoonSyncError=String(e?.message||e||'Platoon sync unavailable');
    if(state.view==='groups')render();
  }
}
async function syncPlatoonFromServer(){
  if(platoonSyncBusy)return;
  platoonSyncBusy=true;
  try{
    const out=await callPlatoonFunction({action:'bootstrap',snapshot:loadPlatoonLocal()});
    if(out?.platoon)writePlatoonLocal(out.platoon);
    platoonSyncError='';
    if(state.view==='groups')render();
  }catch(e){
    platoonSyncError=String(e?.message||e||'Platoon sync unavailable');
    if(state.view==='groups')render();
  }finally{platoonSyncBusy=false}
}'''
assert old in s
s=s.replace(old,new,1)

setup_start=s.index('function openPlatoonSetup(){')
setup_end=s.index('function openMissionEditor(',setup_start)
setup=r'''async function platoonLogoFromFile(file){
  if(!file)return '';
  if(!String(file.type||'').startsWith('image/'))throw new Error('Choose an image file.');
  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=reject;r.readAsDataURL(file)});
  const img=await new Promise((resolve,reject)=>{const x=new Image();x.onload=()=>resolve(x);x.onerror=reject;x.src=data});
  const size=320,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d');
  const scale=Math.max(size/img.width,size/img.height),w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);
  return canvas.toDataURL('image/webp',.82);
}
function openPlatoonSetup(){
  const p=loadPlatoonLocal();
  let pendingLogoData=p.logoData||'';
  const coOptions=['<option value="">No Co-Chief selected</option>',...(p.members||[]).filter(m=>m.role!=='chief').map(m=>`<option value="${safeText(m.id)}" ${p.coChief===m.id?'selected':''}>${safeText(m.name)}</option>`)].join('');
  const logoPreview=pendingLogoData?`<img src="${safeText(pendingLogoData)}" alt="Platoon logo">`:'No logo';
  const d=platoonDialog(`<div class="dialog-head"><div><div class="eyebrow">PLATOON SETUP</div><h2 style="margin:5px 0 0">${safeText(p.name)}</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div>
    <div class="platoon-logo-setup"><div class="platoon-logo-preview" id="platoonLogoPreview">${logoPreview}</div><div><div class="eyebrow">PLATOON LOGO</div><div class="platoon-logo-actions" style="margin-top:7px"><label class="button secondary" style="display:inline-flex;margin:0;cursor:pointer">Upload logo<input id="platoonSetupLogoFile" type="file" accept="image/*" style="display:none"></label><button class="button secondary" id="removePlatoonLogo" type="button">Remove</button></div></div></div>
    <div class="platoon-form-grid" style="margin-top:16px"><label>Platoon name<input id="platoonSetupName" value="${safeText(p.name)}"></label><label>Season<input id="platoonSetupSeason" type="number" min="2020" max="2100" value="${Number(p.season)||new Date().getFullYear()}"></label></div>
    <label>Motto<input id="platoonSetupMotto" value="${safeText(p.motto||'')}" placeholder="Optional"></label>
    <div class="platoon-form-grid"><label>Platoon Chief<input value="${safeText(p.chief||'')}" disabled></label><label>Co-Chief<select id="platoonSetupCoChief">${coOptions}</select></label></div>
    <label>Add a cadet<input id="platoonSetupNewCadet" placeholder="Name"></label>
    <div class="platoon-notice">The Platoon Chief has full control. The Co-Chief can create and manage Missions, participants and result imports.</div>
    <div class="dialog-actions"><button class="button secondary" type="button" onclick="closePlatoonDialog()">Cancel</button><button class="button primary" id="savePlatoonSetupBtn" type="button">Save Setup</button></div>`);
  d.querySelector('#platoonSetupLogoFile').onchange=async e=>{
    try{pendingLogoData=await platoonLogoFromFile(e.target.files?.[0]);d.querySelector('#platoonLogoPreview').innerHTML=pendingLogoData?`<img src="${pendingLogoData}" alt="Platoon logo">`:'No logo'}catch(err){alert(err.message||String(err))}
  };
  d.querySelector('#removePlatoonLogo').onclick=()=>{pendingLogoData='';d.querySelector('#platoonLogoPreview').textContent='No logo'};
  d.querySelector('#savePlatoonSetupBtn').onclick=()=>{
    p.name=String(d.querySelector('#platoonSetupName').value||'').trim()||'My Time';
    p.motto=String(d.querySelector('#platoonSetupMotto').value||'').trim();
    p.logoData=pendingLogoData;
    p.season=Number(d.querySelector('#platoonSetupSeason').value)||new Date().getFullYear();
    p.coChief=String(d.querySelector('#platoonSetupCoChief').value||'');
    p.members=(p.members||[]).map(m=>({...m,role:m.role==='chief'?'chief':(p.coChief===m.id?'co_chief':(m.linked?'member':'cadet'))}));
    const newCadet=String(d.querySelector('#platoonSetupNewCadet').value||'').trim();
    if(newCadet&&!p.members.some(m=>m.name.toLowerCase()===newCadet.toLowerCase()))p.members.push({id:'cadet-'+Date.now(),name:newCadet,linked:false,role:'cadet'});
    savePlatoonLocal(p);d.close();
  };
}
'''
s=s[:setup_start]+setup+s[setup_end:]

call_start=s.index('async function callPlatoonFunction(')
call_end=s.index('function openMissionImport(',call_start)
call=r'''async function callPlatoonFunction(payload,retry=true){
  const session=await ensureAuthSession();if(!session?.access_token)throw new Error('Please sign in again.');
  let res;
  try{
    res=await fetch(`${SUPABASE_URL}/functions/v1/platoon-import`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify(payload)});
  }catch(e){throw new Error('Platoon server is not online yet. The platoon-import Edge Function still needs to be deployed in Supabase.')}
  const body=await res.json().catch(()=>({error:'Invalid server response'}));
  if(res.status===401&&retry&&authSession?.refresh_token){try{await refreshAuthSession();return callPlatoonFunction(payload,false)}catch{}}
  if(!res.ok){
    if(body.error==='PLATOON_SCHEMA_NOT_READY')throw new Error('Platoon cloud sync is not ready yet. Apply the Platoons database migration in Supabase.');
    throw new Error(body.error||body.message||`Platoon request failed (${res.status})`);
  }
  return body;
}
'''
s=s[:call_start]+call+s[call_end:]

marker='<div class="platoon-shell"><section class="card platoon-command">'
assert marker in s
s=s.replace(marker,marker+'${p.logoData?`<img class="platoon-logo" src="${safeText(p.logoData)}" alt="${safeText(p.name)} logo">`:``}',1)

old='const resultCount=missions.filter(m=>Array.isArray(m.results)&&m.results.length).length;\n  return `'
new="const resultCount=missions.filter(m=>Array.isArray(m.results)&&m.results.length).length;\n  const syncMsg=platoonSyncError?`<div class=\"platoon-sync-error\">${safeText(platoonSyncError)}</div>`:'';\n  return `"
assert old in s
s=s.replace(old,new,1)
s=s.replace('<div class="platoon-shell"><section class="card platoon-command">','${syncMsg}<div class="platoon-shell"><section class="card platoon-command">',1)

old_nav="document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));"
new_nav="document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>{setView(b.dataset.view);if(b.dataset.view==='groups')syncPlatoonFromServer()}));"
assert old_nav in s
s=s.replace(old_nav,new_nav,1)

p.write_text(s)
