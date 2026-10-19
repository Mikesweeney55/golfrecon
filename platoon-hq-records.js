(()=>{
'use strict';
/**
 * Platoon HQ Records + Club Eagle (manual / automatic / combined).
 * Persists on the platoon snapshot as `hqMeta` (and server `hq_meta` once v4 migration is applied).
 */
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const CATEGORIES=[
  {id:'birdies',label:'Most Birdies in a Round',unit:'birdies'},
  {id:'ace',label:'Hole in One',unit:'aces'},
  {id:'eagle',label:'Eagles',unit:'eagles'}
];
const MODES=['combined','automatic','manual'];

function getP(){try{return loadPlatoonLocal()}catch{return null}}
function canon(p,raw){return typeof window.grCanonicalMember==='function'?window.grCanonicalMember(p,raw):null}
function memberById(p,id){return (p?.members||[]).find(m=>String(m.id)===String(id))||null}
function displayName(p,raw){return typeof window.grDisplayName==='function'?window.grDisplayName(p,raw):(canon(p,raw)?.name||raw||'Player')}
function aliasesOf(m){return typeof window.grAliasesOf==='function'?window.grAliasesOf(m):[]}
function cleanHoles(holes){
  if(typeof window.grCleanHoles==='function')return window.grCleanHoles(holes);
  const map=new Map();
  for(const h of (Array.isArray(holes)?holes:[])){
    const hole=Number(h?.hole);if(!Number.isInteger(hole)||hole<1||hole>18)continue;
    map.set(hole,{hole,par:finite(h?.par)?Number(h.par):null,score:finite(h?.score)?Number(h.score):null});
  }
  return [...map.values()].sort((a,b)=>a.hole-b.hole);
}
function fmtDate(v){if(!v)return '';try{return new Date(v+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}catch{return String(v)}}

function defaultHqMeta(){
  return {
    version:1,
    modes:{birdies:'combined',ace:'combined',eagle:'combined'},
    records:[],
    eagleBalances:[],
    eagleDetails:[],
    suppressedAuto:[]
  };
}
function normalizeHqMeta(raw){
  const d=defaultHqMeta(),x=(raw&&typeof raw==='object')?raw:{};
  d.modes={...d.modes,...(x.modes&&typeof x.modes==='object'?x.modes:{})};
  for(const k of Object.keys(d.modes))if(!MODES.includes(d.modes[k]))d.modes[k]='combined';
  d.records=Array.isArray(x.records)?x.records.map(normalizeRecord).filter(Boolean):[];
  d.eagleBalances=Array.isArray(x.eagleBalances)?x.eagleBalances.map(normalizeBalance).filter(Boolean):[];
  d.eagleDetails=Array.isArray(x.eagleDetails)?x.eagleDetails.map(normalizeEagleDetail).filter(Boolean):[];
  d.suppressedAuto=Array.isArray(x.suppressedAuto)?x.suppressedAuto.filter(s=>s&&s.fingerprint):[];
  return d;
}
function normalizeRecord(r){
  if(!r||typeof r!=='object')return null;
  const category=String(r.category||'');
  if(!CATEGORIES.some(c=>c.id===category))return null;
  return {
    id:String(r.id||uid('rec')),
    category,
    memberId:r.memberId?String(r.memberId):'',
    playerName:String(r.playerName||'').trim(),
    value:finite(r.value)?Number(r.value):null,
    course:String(r.course||'').trim(),
    hole:finite(r.hole)?Number(r.hole):null,
    date:String(r.date||'').slice(0,10),
    missionId:r.missionId?String(r.missionId):'',
    missionTitle:String(r.missionTitle||'').trim(),
    notes:String(r.notes||'').trim(),
    overrideAuto:!!r.overrideAuto,
    reviewFlag:!!r.reviewFlag,
    fingerprint:String(r.fingerprint||''),
    source:'manual',
    createdAt:r.createdAt||new Date().toISOString(),
    updatedAt:r.updatedAt||new Date().toISOString()
  };
}
function normalizeBalance(b){
  if(!b||typeof b!=='object')return null;
  const count=Number(b.count);if(!Number.isFinite(count)||count<0)return null;
  return {
    id:String(b.id||uid('bal')),
    memberId:b.memberId?String(b.memberId):'',
    playerName:String(b.playerName||'').trim(),
    count:Math.floor(count),
    asOfDate:String(b.asOfDate||'').slice(0,10),
    notes:String(b.notes||'').trim(),
    source:'manual',
    createdAt:b.createdAt||new Date().toISOString(),
    updatedAt:b.updatedAt||new Date().toISOString()
  };
}
function normalizeEagleDetail(e){
  if(!e||typeof e!=='object')return null;
  return {
    id:String(e.id||uid('eg')),
    memberId:e.memberId?String(e.memberId):'',
    playerName:String(e.playerName||'').trim(),
    course:String(e.course||'').trim(),
    hole:finite(e.hole)?Number(e.hole):null,
    date:String(e.date||'').slice(0,10),
    missionId:e.missionId?String(e.missionId):'',
    missionTitle:String(e.missionTitle||'').trim(),
    notes:String(e.notes||'').trim(),
    fingerprint:String(e.fingerprint||fingerprintOf({player:e.playerName,course:e.course,hole:e.hole,date:e.date,kind:'eagle'})),
    source:'manual',
    createdAt:e.createdAt||new Date().toISOString(),
    updatedAt:e.updatedAt||new Date().toISOString()
  };
}

function hqMetaOf(p){return normalizeHqMeta(p?.hqMeta)}
function writeHqMeta(p,meta){
  p.hqMeta=normalizeHqMeta(meta);
  return p;
}
function mergeHqMetaPreserve(serverP,localP){
  if(!serverP)return localP||serverP;
  const localMeta=localP?.hqMeta;
  const serverMeta=serverP?.hqMeta;
  // Prefer server when it actually carries hqMeta; otherwise keep local so sync cannot wipe manuals.
  if(serverMeta&&typeof serverMeta==='object'&&(Object.keys(serverMeta).length||Array.isArray(serverMeta.records))){
    serverP.hqMeta=normalizeHqMeta(serverMeta);
  }else if(localMeta){
    serverP.hqMeta=normalizeHqMeta(localMeta);
  }else{
    serverP.hqMeta=defaultHqMeta();
  }
  return serverP;
}

function fingerprintOf({player,course,hole,date,kind,missionId,value}){
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  return [kind||'',norm(player),norm(course),hole??'',date||'',missionId||'',value??''].join('|');
}

function autoAchievements(p){
  const complete=(p.missions||[]).filter(m=>m.type!=='war'&&m.status==='completed');
  const birdieRounds=[],aces=[],eagles=[];
  for(const m of complete){
    for(const r of (m.results||[])){
      const mm=canon(p,r.player_name)||memberById(p,r.hole_detail_canonical_id);
      const player=mm?.name||displayName(p,r.player_name);
      const memberId=mm?.id||'';
      const holes=cleanHoles(r.holes);
      if(holes.length){
        const birds=holes.filter(h=>finite(h.par)&&h.score===h.par-1);
        if(birds.length){
          const fp=fingerprintOf({player,course:m.locationName,date:m.date,kind:'birdies',missionId:m.id,value:birds.length});
          birdieRounds.push({source:'automatic',category:'birdies',player,memberId,value:birds.length,course:m.locationName||'',date:m.date||'',missionId:m.id,missionTitle:m.title||m.locationName||'Mission',fingerprint:fp});
        }
        for(const h of holes){
          if(Number(h.score)===1){
            const fp=fingerprintOf({player,course:m.locationName,hole:h.hole,date:m.date,kind:'ace',missionId:m.id});
            aces.push({source:'automatic',category:'ace',player,memberId,value:1,course:m.locationName||'',hole:h.hole,date:m.date||'',missionId:m.id,missionTitle:m.title||m.locationName||'Mission',fingerprint:fp});
          }
          if(finite(h.par)&&h.score<=h.par-2){
            const fp=fingerprintOf({player,course:m.locationName,hole:h.hole,date:m.date,kind:'eagle',missionId:m.id});
            eagles.push({source:'automatic',category:'eagle',player,memberId,value:1,course:m.locationName||'',hole:h.hole,date:m.date||'',missionId:m.id,missionTitle:m.title||m.locationName||'Mission',fingerprint:fp});
          }
        }
      }else if(finite(r.eagle_count)&&Number(r.eagle_count)>0){
        // Official eagle_count without hole detail — count toward totals, fingerprint by mission+player.
        const fp=fingerprintOf({player,date:m.date,kind:'eagle-count',missionId:m.id,value:Number(r.eagle_count)});
        eagles.push({source:'automatic',category:'eagle',player,memberId,value:Number(r.eagle_count),course:m.locationName||'',date:m.date||'',missionId:m.id,missionTitle:m.title||m.locationName||'Mission',fingerprint:fp,aggregate:true});
      }
    }
  }
  return {birdieRounds,aces,eagles};
}

function resolvePlayer(p,memberId,playerName){
  const byId=memberById(p,memberId);
  if(byId)return {memberId:byId.id,playerName:byId.name};
  const byName=canon(p,playerName);
  if(byName)return {memberId:byName.id,playerName:byName.name};
  return {memberId:memberId||'',playerName:String(playerName||'').trim()};
}

function clubEagleModel(p){
  const meta=hqMetaOf(p),auto=autoAchievements(p),mode=meta.modes.eagle||'combined';
  const suppressed=new Set((meta.suppressedAuto||[]).map(s=>s.fingerprint));
  const manualFp=new Set((meta.eagleDetails||[]).map(e=>e.fingerprint).filter(Boolean));
  const balances=meta.eagleBalances||[];

  // Per-player map
  const byKey=new Map();
  const touch=(key,name,memberId)=>{
    if(!byKey.has(key))byKey.set(key,{key,playerName:name,memberId:memberId||'',balance:0,auto:0,manualDetails:0,items:[],flags:[]});
    return byKey.get(key);
  };

  for(const b of balances){
    const r=resolvePlayer(p,b.memberId,b.playerName);
    const key=(r.memberId||r.playerName||'').toLowerCase();
    if(!key)continue;
    const row=touch(key,r.playerName,r.memberId);
    row.balance+=Number(b.count)||0;
    row.items.push({...b,kind:'balance',source:'manual'});
  }

  const autoUsable=[];
  for(const e of auto.eagles){
    if(suppressed.has(e.fingerprint))continue;
    if(manualFp.has(e.fingerprint))continue; // covered by manual detail — no double count
    // Starting-balance asOf: ignore automatic eagles on/before asOf for that player
    const r=resolvePlayer(p,e.memberId,e.player);
    const bals=balances.filter(b=>{
      const rb=resolvePlayer(p,b.memberId,b.playerName);
      return (rb.memberId&&rb.memberId===r.memberId)||(!rb.memberId&&rb.playerName.toLowerCase()===r.playerName.toLowerCase());
    });
    const blocked=bals.some(b=>b.asOfDate&&e.date&&String(e.date)<=String(b.asOfDate));
    if(blocked)continue;
    autoUsable.push(e);
    const key=(r.memberId||r.playerName||'').toLowerCase();
    if(!key)continue;
    const row=touch(key,r.playerName,r.memberId);
    row.auto+=Number(e.value)||1;
    row.items.push({...e,kind:'auto'});
  }

  for(const e of meta.eagleDetails||[]){
    const r=resolvePlayer(p,e.memberId,e.playerName);
    const key=(r.memberId||r.playerName||'').toLowerCase();
    if(!key)continue;
    const row=touch(key,r.playerName,r.memberId);
    row.manualDetails+=1;
    row.items.push({...e,kind:'detail',source:'manual'});
    // Flag possible duplicate vs automatic
    if(auto.eagles.some(a=>a.fingerprint===e.fingerprint))row.flags.push('possible_duplicate');
  }

  const leaders=[...byKey.values()].map(row=>{
    let total=0;
    if(mode==='automatic')total=row.auto;
    else if(mode==='manual')total=row.balance+row.manualDetails;
    else total=row.balance+row.auto+row.manualDetails;
    return {...row,total,mode};
  }).filter(r=>r.total>0||r.balance>0||r.manualDetails>0||r.auto>0)
    .sort((a,b)=>b.total-a.total||a.playerName.localeCompare(b.playerName));

  const platoonTotal=leaders.reduce((s,r)=>s+r.total,0);
  return {mode,leaders,platoonTotal,autoCount:autoUsable.reduce((s,e)=>s+(Number(e.value)||1),0),meta};
}

function recordsModel(p){
  const meta=hqMetaOf(p),auto=autoAchievements(p);
  const out={};
  for(const cat of CATEGORIES){
    if(cat.id==='eagle'){
      // Eagles are shown primarily in Club Eagle; still allow Records entries for category eagle.
    }
    const mode=meta.modes[cat.id]||'combined';
    const manual=(meta.records||[]).filter(r=>r.category===cat.id);
    let autoList=cat.id==='birdies'?auto.birdieRounds:cat.id==='ace'?auto.aces:auto.eagles.filter(e=>!e.aggregate);
    const suppressed=new Set((meta.suppressedAuto||[]).filter(s=>!s.category||s.category===cat.id).map(s=>s.fingerprint));
    autoList=autoList.filter(a=>!suppressed.has(a.fingerprint));
    const override=manual.find(r=>r.overrideAuto);
    const flagged=manual.filter(r=>{
      if(!r.fingerprint)return false;
      return autoList.some(a=>a.fingerprint===r.fingerprint);
    });

    let display=[];
    if(mode==='automatic'){
      if(cat.id==='birdies'){
        if(autoList.length){
          const best=Math.max(...autoList.map(x=>x.value));
          display=autoList.filter(x=>x.value===best).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,3)
            .map(x=>({...x,sourceLabel:'Automatic'}));
        }
      }else{
        display=autoList.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(x=>({...x,sourceLabel:'Automatic'}));
      }
    }else if(mode==='manual'){
      display=manual.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(x=>({...x,player:x.playerName,sourceLabel:'Manual'}));
    }else{
      // Combined
      if(override){
        display=[{...override,player:override.playerName,sourceLabel:'Manual override',value:override.value}];
      }else if(cat.id==='birdies'){
        const pool=[
          ...autoList.map(x=>({...x,sourceLabel:'Automatic'})),
          ...manual.map(x=>({...x,player:x.playerName,sourceLabel:'Manual'}))
        ];
        if(pool.length){
          const best=Math.max(...pool.map(x=>Number(x.value)||0));
          display=pool.filter(x=>Number(x.value)===best).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,3);
        }
      }else{
        const seen=new Set();
        display=[];
        for(const x of [...manual.map(m=>({...m,player:m.playerName,sourceLabel:'Manual'})),...autoList.map(a=>({...a,sourceLabel:'Automatic'}))]){
          const fp=x.fingerprint||fingerprintOf({player:x.player||x.playerName,course:x.course,hole:x.hole,date:x.date,kind:cat.id,missionId:x.missionId});
          if(seen.has(fp))continue;seen.add(fp);
          display.push({...x,fingerprint:fp});
        }
        display.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
      }
    }
    out[cat.id]={mode,manual,autoList,display,override,flagged,label:cat.label};
  }
  return out;
}

function canEditHq(p){
  try{
    const role=String((p.members||[]).find(m=>m.linked||m.role==='chief')?.role||p.members?.find(m=>m.role==='chief')?.role||'');
    // Chief / co-chief may edit; also allow if current browser user is chief by role on any linked member.
    const me=(p.members||[]).find(m=>m.linked);
    const r=me?.role||role;
    return r==='chief'||r==='co_chief'||r==='chief';
  }catch{return true}
}

function editIconBtn(kind){
  return `<button type="button" class="gr-hq-edit" data-gr-hq-edit="${esc(kind)}" title="Edit ${esc(kind)}" aria-label="Edit ${esc(kind)}">✎</button>`;
}

function renderClubEagleBubble(p){
  const model=clubEagleModel(p);
  const head=`<div class="gr155-recap-title gr-hq-title-row"><span>CLUB EAGLE</span>${editIconBtn('eagles')}</div>`;
  if(!model.leaders.length){
    return `<section class="gr155-recap-block" data-gr-hq="eagles">${head}<div class="gr155-empty">No eagles recorded yet. Use ✎ to add a historical starting balance.</div><div class="gr-hq-mode-tag">${esc(model.mode)}</div></section>`;
  }
  const rows=model.leaders.slice(0,6).map(r=>`<div class="gr155-recap-row gr155-eagle-row"><span>${esc(r.playerName)}${r.flags.length?' <em class="gr-hq-flag" title="Possible duplicate — review in editor">⚑</em>':''}</span><span>${r.total} eagle${r.total===1?'':'s'}</span></div>`).join('');
  return `<section class="gr155-recap-block" data-gr-hq="eagles">${head}<div class="gr155-eagle-hero"><span>🦅</span><div><strong>${model.platoonTotal}</strong><small>PLATOON EAGLES</small></div></div>${rows}<div class="gr-hq-mode-tag">${esc(model.mode)}</div></section>`;
}

function renderRecordsBubble(p){
  const model=recordsModel(p);
  const head=`<div class="gr155-recap-title gr-hq-title-row"><span>RECORDS</span>${editIconBtn('records')}</div>`;
  const bits=[];
  // Birdies
  const b=model.birdies;
  if(b.display.length){
    const t=b.display[0];
    bits.push(`<div class="gr155-record"><span class="gr155-record-label">Most Birdies in a Round <i class="gr-hq-src">${esc(t.sourceLabel||b.mode)}</i></span><strong>${esc(t.player||t.playerName)} · ${t.value}</strong><small>${esc(t.missionTitle||t.mission||'')}${t.date?` · ${esc(fmtDate(t.date))}`:''}</small></div>`);
  }else{
    bits.push(`<div class="gr155-record"><span class="gr155-record-label">Most Birdies in a Round</span><div class="gr155-empty">No birdie record yet.</div></div>`);
  }
  // Aces
  const a=model.ace;
  if(a.display.length){
    bits.push(a.display.slice(0,4).map(x=>`<div class="gr155-record"><span class="gr155-record-label">Hole in One <i class="gr-hq-src">${esc(x.sourceLabel||a.mode)}</i></span><strong>${esc(x.player||x.playerName)}</strong><small>${esc(x.course||'')}${x.hole!=null?` · Hole ${x.hole}`:''}${x.date?` · ${esc(fmtDate(x.date))}`:''}</small></div>`).join(''));
  }else{
    bits.push(`<div class="gr155-record"><span class="gr155-record-label">Holes in One</span><div class="gr155-empty">No aces recorded yet.</div></div>`);
  }
  // Eagle record line (compact pointer to Club Eagle / manual eagle records)
  const e=model.eagle;
  if(e.manual.length){
    bits.push(`<div class="gr155-record"><span class="gr155-record-label">Eagles (manual entries)</span><strong>${e.manual.length}</strong><small>See Club Eagle for combined totals</small></div>`);
  }
  const flags=[...b.flagged,...a.flagged,...e.flagged];
  if(flags.length)bits.push(`<div class="gr155-record gr-hq-review"><span class="gr155-record-label">Needs review</span><small>${flags.length} possible duplicate${flags.length===1?'':'s'} flagged</small></div>`);
  return `<section class="gr155-recap-block" data-gr-hq="records">${head}${bits.join('')}</section>`;
}

function playerOptions(p,selected){
  const opts=(p.members||[]).map(m=>`<option value="${esc(m.id)}" ${String(selected)===String(m.id)?'selected':''}>${esc(m.name)}</option>`).join('');
  return `<option value="">Custom / new player…</option>${opts}`;
}
function missionOptions(p,selected){
  const ms=(p.missions||[]).filter(m=>m.type!=='war').slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  return `<option value="">Optional Mission…</option>${ms.map(m=>`<option value="${esc(m.id)}" ${String(selected)===String(m.id)?'selected':''}>${esc(m.title||m.locationName||m.id)} (${esc(m.date||'')})</option>`).join('')}`;
}
function modeSelect(name,value){
  return `<select data-mode="${esc(name)}">${MODES.map(m=>`<option value="${m}" ${value===m?'selected':''}>${m[0].toUpperCase()+m.slice(1)}</option>`).join('')}</select>`;
}

function openRecordsEditor(){
  const p=getP();if(!p)return;
  if(!canEditHq(p)){alert('Only the Platoon Chief or Co-Chief can edit Records.');return}
  const meta=hqMetaOf(p);
  const model=recordsModel(p);
  const dlgFn=typeof platoonDialog==='function'?platoonDialog:null;
  if(!dlgFn){alert('Editor unavailable.');return}
  const rows=(meta.records||[]).map((r,i)=>recordRowHtml(p,r,i)).join('')||'<div class="gr155-empty">No manual records yet.</div>';
  const d=dlgFn(`<div class="dialog-head"><div><div class="eyebrow">RECORDS</div><h2 style="margin:5px 0 0">Edit Platoon Records</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div>
    <div class="platoon-notice"><strong>Modes:</strong> Automatic uses verified hole data · Manual uses only your entries · Combined (default) merges both without double-counting. Overrides replace the automatic display for that category.</div>
    <div class="gr-hq-modes grid three">
      <label>Birdies ${modeSelect('birdies',meta.modes.birdies)}</label>
      <label>Holes in One ${modeSelect('ace',meta.modes.ace)}</label>
      <label>Eagles ${modeSelect('eagle',meta.modes.eagle)}</label>
    </div>
    <div class="gr-hq-editor-list" id="grHqRecList">${rows}</div>
    <div class="dialog-actions" style="margin-top:10px">
      <button class="button secondary" type="button" id="grHqRecAdd">+ Add record</button>
      <button class="button secondary" type="button" onclick="closePlatoonDialog()">Cancel</button>
      <button class="button primary" type="button" id="grHqRecSave">Save</button>
    </div>
    <div id="grHqRecMsg" class="gr-hq-msg" hidden></div>`);
  const list=d.querySelector('#grHqRecList');
  d.querySelector('#grHqRecAdd').onclick=()=>{
    const blank=normalizeRecord({category:'birdies',playerName:'',value:1});
    meta.records.push(blank);
    list.insertAdjacentHTML('beforeend',recordRowHtml(p,blank,meta.records.length-1));
  };
  list.onclick=e=>{
    const del=e.target.closest('[data-del-rec]');
    if(!del)return;
    const id=del.getAttribute('data-del-rec');
    if(!confirm('Delete this manual record? Automatic data is not affected.'))return;
    meta.records=meta.records.filter(r=>r.id!==id);
    del.closest('.gr-hq-edit-row')?.remove();
  };
  d.querySelector('#grHqRecSave').onclick=()=>{
    try{
      meta.modes.birdies=d.querySelector('[data-mode="birdies"]').value;
      meta.modes.ace=d.querySelector('[data-mode="ace"]').value;
      meta.modes.eagle=d.querySelector('[data-mode="eagle"]').value;
      const next=[];
      list.querySelectorAll('.gr-hq-edit-row').forEach(row=>{
        const category=row.querySelector('[data-f="category"]').value;
        const memberId=row.querySelector('[data-f="memberId"]').value;
        let playerName=row.querySelector('[data-f="playerName"]').value.trim();
        const resolved=resolvePlayer(p,memberId,playerName);
        if(memberId)playerName=resolved.playerName||playerName;
        const value=Number(row.querySelector('[data-f="value"]').value);
        const course=row.querySelector('[data-f="course"]').value.trim();
        const holeRaw=row.querySelector('[data-f="hole"]').value;
        const hole=holeRaw===''?null:Number(holeRaw);
        const date=row.querySelector('[data-f="date"]').value;
        const missionId=row.querySelector('[data-f="missionId"]').value;
        const mission=missionId?(p.missions||[]).find(m=>m.id===missionId):null;
        const notes=row.querySelector('[data-f="notes"]').value.trim();
        const overrideAuto=!!row.querySelector('[data-f="overrideAuto"]')?.checked;
        if(!playerName&&!memberId)return;
        if(!Number.isFinite(value)||value<=0)throw new Error('Each record needs a positive count/score.');
        const rec=normalizeRecord({
          id:row.dataset.id,category,memberId:resolved.memberId,playerName:resolved.playerName||playerName,
          value,course,hole,date,missionId,missionTitle:mission?.title||mission?.locationName||'',notes,overrideAuto,
          fingerprint:fingerprintOf({player:resolved.playerName||playerName,course,hole,date,kind:category,missionId,value}),
          updatedAt:new Date().toISOString()
        });
        // Flag duplicates vs automatic
        const auto=autoAchievements(p);
        const autoList=category==='birdies'?auto.birdieRounds:category==='ace'?auto.aces:auto.eagles;
        if(autoList.some(a=>a.fingerprint===rec.fingerprint))rec.reviewFlag=true;
        next.push(rec);
      });
      meta.records=next;
      writeHqMeta(p,meta);
      savePlatoonLocal(p);
      d.close();
      setTimeout(()=>{if(typeof render==='function')render()},0);
      alert('Records saved. They sync with your Platoon when online'+(window.__grHqMetaServer?'':' (server column pending migration approval)')+'.');
    }catch(err){
      const msg=d.querySelector('#grHqRecMsg');msg.hidden=false;msg.textContent=err.message||String(err);msg.className='gr-hq-msg err';
    }
  };
}

function recordRowHtml(p,r){
  return `<div class="gr-hq-edit-row" data-id="${esc(r.id)}">
    <div class="grid two">
      <label>Category<select data-f="category">${CATEGORIES.map(c=>`<option value="${c.id}" ${r.category===c.id?'selected':''}>${esc(c.label)}</option>`).join('')}</select></label>
      <label>Count / score<input data-f="value" type="number" min="1" step="1" value="${esc(r.value??1)}"></label>
    </div>
    <div class="grid two">
      <label>Player<select data-f="memberId">${playerOptions(p,r.memberId)}</select></label>
      <label>Name (if custom)<input data-f="playerName" value="${esc(r.playerName||'')}" placeholder="Player name"></label>
    </div>
    <div class="grid two">
      <label>Course<input data-f="course" value="${esc(r.course||'')}"></label>
      <label>Hole<input data-f="hole" type="number" min="1" max="18" value="${r.hole??''}"></label>
    </div>
    <div class="grid two">
      <label>Date<input data-f="date" type="date" value="${esc(r.date||'')}"></label>
      <label>Mission<select data-f="missionId">${missionOptions(p,r.missionId)}</select></label>
    </div>
    <label>Notes<input data-f="notes" value="${esc(r.notes||'')}"></label>
    <label class="gr-hq-check"><input data-f="overrideAuto" type="checkbox" ${r.overrideAuto?'checked':''}> Override automatic display for this category</label>
    ${r.reviewFlag?'<div class="gr-hq-flag-line">⚑ Possible duplicate of an automatic result — review before saving.</div>':''}
    <div class="gr-hq-row-actions"><button type="button" class="button secondary" data-del-rec="${esc(r.id)}">Delete</button><span class="muted" style="font-size:10px">Manual</span></div>
  </div>`;
}

function openEaglesEditor(){
  const p=getP();if(!p)return;
  if(!canEditHq(p)){alert('Only the Platoon Chief or Co-Chief can edit Club Eagle.');return}
  const meta=hqMetaOf(p);
  const dlgFn=typeof platoonDialog==='function'?platoonDialog:null;
  if(!dlgFn){alert('Editor unavailable.');return}
  const balRows=(meta.eagleBalances||[]).map(b=>balanceRowHtml(p,b)).join('')||'<div class="gr155-empty">No starting balances yet.</div>';
  const detRows=(meta.eagleDetails||[]).map(e=>eagleDetailRowHtml(p,e)).join('')||'<div class="gr155-empty">No individual eagle details yet.</div>';
  const d=dlgFn(`<div class="dialog-head"><div><div class="eyebrow">CLUB EAGLE</div><h2 style="margin:5px 0 0">Edit Eagle Totals</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div>
    <div class="platoon-notice"><strong>Starting balances</strong> cover historical eagles without scorecards. Set an <em>As-of date</em> so later automatic imports before that date are not double-counted. Individual details are optional.</div>
    <label>Display mode ${modeSelect('eagle',meta.modes.eagle)}</label>
    <div class="eyebrow" style="margin-top:14px">STARTING BALANCES</div>
    <div id="grHqBalList" class="gr-hq-editor-list">${balRows}</div>
    <button class="button secondary" type="button" id="grHqBalAdd">+ Add balance</button>
    <div class="eyebrow" style="margin-top:16px">INDIVIDUAL EAGLES (MANUAL)</div>
    <div id="grHqEgList" class="gr-hq-editor-list">${detRows}</div>
    <button class="button secondary" type="button" id="grHqEgAdd">+ Add eagle detail</button>
    <div class="dialog-actions sticky-actions">
      <button class="button secondary" type="button" onclick="closePlatoonDialog()">Cancel</button>
      <button class="button primary" type="button" id="grHqEgSave">Save</button>
    </div>
    <div id="grHqEgMsg" class="gr-hq-msg" hidden></div>`);
  const balList=d.querySelector('#grHqBalList'),egList=d.querySelector('#grHqEgList');
  d.querySelector('#grHqBalAdd').onclick=()=>{
    const b=normalizeBalance({playerName:'',count:1,asOfDate:new Date().toISOString().slice(0,10)});
    meta.eagleBalances.push(b);
    if(balList.querySelector('.gr155-empty'))balList.innerHTML='';
    balList.insertAdjacentHTML('beforeend',balanceRowHtml(p,b));
  };
  d.querySelector('#grHqEgAdd').onclick=()=>{
    const e=normalizeEagleDetail({playerName:'',date:''});
    meta.eagleDetails.push(e);
    if(egList.querySelector('.gr155-empty'))egList.innerHTML='';
    egList.insertAdjacentHTML('beforeend',eagleDetailRowHtml(p,e));
  };
  d.onclick=e=>{
    const db=e.target.closest('[data-del-bal]');
    if(db){if(!confirm('Remove this starting balance?'))return;meta.eagleBalances=meta.eagleBalances.filter(x=>x.id!==db.getAttribute('data-del-bal'));db.closest('.gr-hq-edit-row')?.remove();return}
    const de=e.target.closest('[data-del-eg]');
    if(de){if(!confirm('Delete this manual eagle detail?'))return;meta.eagleDetails=meta.eagleDetails.filter(x=>x.id!==de.getAttribute('data-del-eg'));de.closest('.gr-hq-edit-row')?.remove()}
  };
  d.querySelector('#grHqEgSave').onclick=()=>{
    try{
      meta.modes.eagle=d.querySelector('[data-mode="eagle"]').value;
      const bals=[];
      balList.querySelectorAll('.gr-hq-edit-row').forEach(row=>{
        const memberId=row.querySelector('[data-f="memberId"]').value;
        let playerName=row.querySelector('[data-f="playerName"]').value.trim();
        const resolved=resolvePlayer(p,memberId,playerName);
        const count=Number(row.querySelector('[data-f="count"]').value);
        const asOfDate=row.querySelector('[data-f="asOfDate"]').value;
        const notes=row.querySelector('[data-f="notes"]').value.trim();
        if(!resolved.playerName&&!playerName)return;
        if(!Number.isFinite(count)||count<0)throw new Error('Balance counts must be zero or greater.');
        bals.push(normalizeBalance({id:row.dataset.id,memberId:resolved.memberId,playerName:resolved.playerName||playerName,count,asOfDate,notes,updatedAt:new Date().toISOString()}));
      });
      const dets=[];
      egList.querySelectorAll('.gr-hq-edit-row').forEach(row=>{
        const memberId=row.querySelector('[data-f="memberId"]').value;
        let playerName=row.querySelector('[data-f="playerName"]').value.trim();
        const resolved=resolvePlayer(p,memberId,playerName);
        const course=row.querySelector('[data-f="course"]').value.trim();
        const holeRaw=row.querySelector('[data-f="hole"]').value;
        const hole=holeRaw===''?null:Number(holeRaw);
        const date=row.querySelector('[data-f="date"]').value;
        const missionId=row.querySelector('[data-f="missionId"]').value;
        const mission=missionId?(p.missions||[]).find(m=>m.id===missionId):null;
        const notes=row.querySelector('[data-f="notes"]').value.trim();
        if(!resolved.playerName&&!playerName)return;
        dets.push(normalizeEagleDetail({id:row.dataset.id,memberId:resolved.memberId,playerName:resolved.playerName||playerName,course,hole,date,missionId,missionTitle:mission?.title||mission?.locationName||'',notes,updatedAt:new Date().toISOString()}));
      });
      meta.eagleBalances=bals;
      meta.eagleDetails=dets;
      writeHqMeta(p,meta);
      savePlatoonLocal(p);
      d.close();
      setTimeout(()=>{if(typeof render==='function')render()},0);
      alert('Club Eagle saved.');
    }catch(err){
      const msg=d.querySelector('#grHqEgMsg');msg.hidden=false;msg.textContent=err.message||String(err);msg.className='gr-hq-msg err';
    }
  };
}

function balanceRowHtml(p,b){
  return `<div class="gr-hq-edit-row" data-id="${esc(b.id)}">
    <div class="grid two">
      <label>Player<select data-f="memberId">${playerOptions(p,b.memberId)}</select></label>
      <label>Name (if custom)<input data-f="playerName" value="${esc(b.playerName||'')}"></label>
    </div>
    <div class="grid two">
      <label>Starting eagles<input data-f="count" type="number" min="0" step="1" value="${esc(b.count??0)}"></label>
      <label>As-of date<input data-f="asOfDate" type="date" value="${esc(b.asOfDate||'')}" title="Automatic eagles on or before this date are not added again"></label>
    </div>
    <label>Notes<input data-f="notes" value="${esc(b.notes||'')}"></label>
    <div class="gr-hq-row-actions"><button type="button" class="button secondary" data-del-bal="${esc(b.id)}">Remove</button><span class="muted" style="font-size:10px">Manual balance</span></div>
  </div>`;
}
function eagleDetailRowHtml(p,e){
  return `<div class="gr-hq-edit-row" data-id="${esc(e.id)}">
    <div class="grid two">
      <label>Player<select data-f="memberId">${playerOptions(p,e.memberId)}</select></label>
      <label>Name (if custom)<input data-f="playerName" value="${esc(e.playerName||'')}"></label>
    </div>
    <div class="grid two">
      <label>Course<input data-f="course" value="${esc(e.course||'')}"></label>
      <label>Hole<input data-f="hole" type="number" min="1" max="18" value="${e.hole??''}"></label>
    </div>
    <div class="grid two">
      <label>Date<input data-f="date" type="date" value="${esc(e.date||'')}"></label>
      <label>Mission<select data-f="missionId">${missionOptions(p,e.missionId)}</select></label>
    </div>
    <label>Notes<input data-f="notes" value="${esc(e.notes||'')}"></label>
    <div class="gr-hq-row-actions"><button type="button" class="button secondary" data-del-eg="${esc(e.id)}">Delete</button><span class="muted" style="font-size:10px">Manual detail</span></div>
  </div>`;
}

function installStyles(){
  if(document.getElementById('grHqRecStyles'))return;
  const s=document.createElement('style');s.id='grHqRecStyles';
  s.textContent=`
  .gr-hq-title-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .gr-hq-edit{border:1px solid rgba(184,234,104,.35);background:rgba(184,234,104,.08);color:var(--accent,#b8ea68);border-radius:8px;width:28px;height:28px;padding:0;cursor:pointer;font-size:14px;line-height:1}
  .gr-hq-edit:hover{background:rgba(184,234,104,.16)}
  .gr-hq-mode-tag{margin-top:8px;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:800}
  .gr-hq-src{font-style:normal;font-weight:700;opacity:.75;margin-left:4px;text-transform:none;letter-spacing:0}
  .gr-hq-flag{color:#ffcf68;font-style:normal}
  .gr-hq-flag-line,.gr-hq-review small{color:#ffcf68}
  .gr-hq-editor-list{display:grid;gap:10px;margin-top:10px;max-height:45vh;overflow:auto}
  .gr-hq-edit-row{border:1px solid var(--line,#24352d);border-radius:12px;padding:10px;background:#101914}
  .gr-hq-edit-row label{margin-top:6px}
  .gr-hq-check{display:flex!important;align-items:center;gap:8px;flex-direction:row!important;font-size:11px}
  .gr-hq-check input{width:auto}
  .gr-hq-row-actions{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
  .gr-hq-msg{margin-top:10px;padding:8px 10px;border-radius:10px;font-size:11px}
  .gr-hq-msg.err{background:rgba(255,59,48,.1);border:1px solid rgba(255,59,48,.25);color:#ff9b96}
  .gr-hq-modes label{font-size:11px}
  `;
  document.head.appendChild(s);
}

function bindUi(){
  if(document.body.dataset.grHqRecBound)return;
  document.body.dataset.grHqRecBound='1';
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-gr-hq-edit]');
    if(!b)return;
    e.preventDefault();e.stopPropagation();
    const kind=b.getAttribute('data-gr-hq-edit');
    if(kind==='records')openRecordsEditor();
    else if(kind==='eagles')openEaglesEditor();
  },true);
}

// Public API used by results renderer / sync merge
window.grHqMetaNormalize=normalizeHqMeta;
window.grHqMetaDefault=defaultHqMeta;
window.grMergeHqMetaPreserve=mergeHqMetaPreserve;
window.grRenderClubEagleBubble=renderClubEagleBubble;
window.grRenderRecordsBubble=renderRecordsBubble;
window.grClubEagleModel=clubEagleModel;
window.grRecordsModel=recordsModel;
window.grOpenRecordsEditor=openRecordsEditor;
window.grOpenEaglesEditor=openEaglesEditor;
window.grHqRecordsReady=true;

installStyles();
bindUi();
})();
