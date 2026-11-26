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
/** Records board is birdies + aces only — eagles live in Club Eagle. */
const RECORD_CATEGORIES=CATEGORIES.filter(c=>c.id==='birdies'||c.id==='ace');
const MODES=['combined','automatic','manual'];

function getP(){try{return loadPlatoonLocal()}catch{return null}}
function canon(p,raw){return typeof window.grCanonicalMember==='function'?window.grCanonicalMember(p,raw):null}
function memberById(p,id){return (p?.members||[]).find(m=>String(m.id)===String(id))||null}
function memberLabel(m){return typeof window.grMemberLabel==='function'?window.grMemberLabel(m):(String(m?.displayName||'').trim()||String(m?.name||'').trim()||'Player')}
function displayName(p,raw){return typeof window.grDisplayName==='function'?window.grDisplayName(p,raw):(canon(p,raw)?memberLabel(canon(p,raw)):(raw||'Player'))}
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
    suppressedAuto:[],
    constitution:'',
    guestPool:[],
    rosterEmails:{},
    rosterProfiles:{},
    blogPosts:[]
  };
}
const BLOG_TONES=new Set(['trash','flex','recap','prop','chatter']);
function normalizeBlogReply(r){
  if(!r||typeof r!=='object')return null;
  const body=String(r.body||'').trim().slice(0,400);
  if(!body)return null;
  return {
    id:String(r.id||uid('br')),
    authorId:String(r.authorId||'').trim(),
    authorName:String(r.authorName||'').trim()||'Cadet',
    body,
    createdAt:r.createdAt||new Date().toISOString()
  };
}
function normalizeBlogReactions(raw){
  const out={fire:[],dead:[],salute:[],cap:[]};
  if(!raw||typeof raw!=='object')return out;
  for(const key of Object.keys(out)){
    const arr=Array.isArray(raw[key])?raw[key]:[];
    out[key]=[...new Set(arr.map(x=>String(x||'').trim()).filter(Boolean))].slice(0,40);
  }
  return out;
}
function normalizeBlogPost(post){
  if(!post||typeof post!=='object')return null;
  const body=String(post.body||'').trim().slice(0,800);
  const tone=BLOG_TONES.has(post.tone)?post.tone:'chatter';
  const replies=Array.isArray(post.replies)?post.replies.map(normalizeBlogReply).filter(Boolean).slice(0,40):[];
  return {
    id:String(post.id||uid('bp')),
    authorId:String(post.authorId||'').trim(),
    authorName:String(post.authorName||'').trim()||'Cadet',
    body,
    tone,
    hasPhoto:!!post.hasPhoto,
    photoId:post.hasPhoto?String(post.photoId||post.id||''):'',
    createdAt:post.createdAt||new Date().toISOString(),
    updatedAt:post.updatedAt||post.createdAt||new Date().toISOString(),
    pinned:!!post.pinned,
    reactions:normalizeBlogReactions(post.reactions),
    replies
  };
}
function normalizeRosterEmails(raw){
  const out={};
  if(!raw||typeof raw!=='object')return out;
  for(const [id,email] of Object.entries(raw)){
    const key=String(id||'').trim();
    const em=String(email||'').trim().toLowerCase();
    if(key&&em.includes('@'))out[key]=em;
  }
  return out;
}
function normalizeRosterProfiles(raw){
  const out={};
  if(!raw||typeof raw!=='object')return out;
  for(const [id,prof] of Object.entries(raw)){
    const key=String(id||'').trim();
    if(!key||!prof||typeof prof!=='object')continue;
    const fullName=String(prof.fullName||prof.name||'').trim();
    const displayName=String(prof.displayName||'').trim();
    if(!fullName&&!displayName)continue;
    out[key]={fullName,displayName};
  }
  return out;
}
function normalizeHqMeta(raw){
  const d=defaultHqMeta(),x=(raw&&typeof raw==='object')?raw:{};
  d.modes={...d.modes,...(x.modes&&typeof x.modes==='object'?x.modes:{})};
  for(const k of Object.keys(d.modes))if(!MODES.includes(d.modes[k]))d.modes[k]='combined';
  d.records=Array.isArray(x.records)?x.records.map(normalizeRecord).filter(Boolean):[];
  d.eagleBalances=Array.isArray(x.eagleBalances)?x.eagleBalances.map(normalizeBalance).filter(Boolean):[];
  d.eagleDetails=Array.isArray(x.eagleDetails)?x.eagleDetails.map(normalizeEagleDetail).filter(Boolean):[];
  d.suppressedAuto=Array.isArray(x.suppressedAuto)?x.suppressedAuto.filter(s=>s&&s.fingerprint):[];
  d.constitution=String(x.constitution||'').trim();
  d.guestPool=Array.isArray(x.guestPool)?x.guestPool.map(normalizeGuestPoolEntry).filter(Boolean):[];
  d.rosterEmails=normalizeRosterEmails(x.rosterEmails);
  d.rosterProfiles=normalizeRosterProfiles(x.rosterProfiles);
  d.blogPosts=Array.isArray(x.blogPosts)?x.blogPosts.map(normalizeBlogPost).filter(Boolean).slice(0,120):[];
  return d;
}
function blogPostsOf(p){return hqMetaOf(p).blogPosts||[]}
function mergeBlogPosts(serverPosts,localPosts){
  const byId=new Map();
  for(const post of [...(serverPosts||[]),...(localPosts||[])]){
    if(!post?.id)continue;
    const prev=byId.get(post.id);
    if(!prev||String(post.updatedAt||'')>=String(prev.updatedAt||''))byId.set(post.id,post);
  }
  return [...byId.values()]
    .sort((a,b)=>Number(b.pinned)-Number(a.pinned)||String(b.createdAt||'').localeCompare(String(a.createdAt||'')))
    .slice(0,120);
}
function normalizeGuestPoolEntry(g){
  if(!g||typeof g!=='object')return null;
  const name=String(g.name||'').trim();
  if(!name)return null;
  const aliases=Array.isArray(g.aliases)?g.aliases.map(a=>String(a||'').trim()).filter(Boolean)
    :(typeof g.aliases==='string'?g.aliases.split(/[,|]/).map(a=>a.trim()).filter(Boolean):[]);
  return {
    id:String(g.id||uid('gst')),
    name,
    aliases:[...new Set(aliases)],
    createdAt:g.createdAt||new Date().toISOString(),
    updatedAt:g.updatedAt||new Date().toISOString()
  };
}
function guestPoolOf(p){return hqMetaOf(p).guestPool||[]}
function constitutionOf(p){return hqMetaOf(p).constitution||''}
function upsertGuestPool(p,name,{aliases=[]}={}){
  const meta=hqMetaOf(p);
  const clean=String(name||'').trim();
  if(!clean)return null;
  const key=clean.toLowerCase();
  let g=meta.guestPool.find(x=>String(x.name||'').toLowerCase()===key
    ||(x.aliases||[]).some(a=>String(a).toLowerCase()===key));
  if(g){
    const extra=[...aliases,clean].map(a=>String(a||'').trim()).filter(Boolean);
    g.aliases=[...new Set([...(g.aliases||[]),...extra.filter(a=>a.toLowerCase()!==String(g.name).toLowerCase())])];
    g.updatedAt=new Date().toISOString();
  }else{
    g=normalizeGuestPoolEntry({id:uid('gst'),name:clean,aliases:aliases.filter(a=>String(a).toLowerCase()!==key)});
    meta.guestPool.push(g);
  }
  writeHqMeta(p,meta);
  return g;
}
function setConstitution(p,text){
  const meta=hqMetaOf(p);
  meta.constitution=String(text||'').trim();
  writeHqMeta(p,meta);
  return meta.constitution;
}
function openConstitutionEditor(){
  const p=getP();if(!p)return;
  if(!canEditHq(p)){alert('Only the Platoon Chief or Co-Chief can edit the Constitution.');return}
  const dlgFn=typeof platoonDialog==='function'?platoonDialog:null;
  if(!dlgFn){alert('Editor unavailable.');return}
  const cur=constitutionOf(p);
  const d=dlgFn(`<div class="dialog-head"><div><div class="eyebrow">CLUBHOUSE</div><h2>My Time Constitution</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div>
    <p class="muted" style="font-size:var(--fs-data);margin:0 0 10px">House rules, vibe, dues, dress code — whatever defines My Time. Shows on the Clubhouse board.</p>
    <label>Constitution<textarea id="grConstitutionText" rows="8" placeholder="e.g. Be ready on the first tee. No sandbagging. Winner buys the first round…">${esc(cur)}</textarea></label>
    <div class="dialog-actions sticky-actions"><button class="button secondary" type="button" onclick="closePlatoonDialog()">Cancel</button><button class="button primary" id="grConstitutionSave" type="button">Save</button></div>`);
  d.querySelector('#grConstitutionSave').onclick=()=>{
    setConstitution(p,d.querySelector('#grConstitutionText').value);
    if(typeof writePlatoonLocal==='function')writePlatoonLocal(p);
    if(typeof savePlatoonLocal==='function')savePlatoonLocal(p,!window.grTestEnvActive);
    d.close();
    setTimeout(()=>{if(typeof render==='function')render()},0);
  };
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
function hqMetaWeight(meta){
  const m=normalizeHqMeta(meta);
  return (m.eagleBalances?.length||0)+(m.eagleDetails?.length||0)+(m.records?.length||0)+(m.blogPosts?.length||0);
}
function mergeHqMetaPreserve(serverP,localP){
  if(!serverP)return localP||serverP;
  const localMeta=localP?.hqMeta?normalizeHqMeta(localP.hqMeta):null;
  const serverRaw=serverP?.hqMeta;
  const serverMeta=serverRaw&&typeof serverRaw==='object'?normalizeHqMeta(serverRaw):null;
  const localW=localMeta?hqMetaWeight(localMeta):0;
  const serverW=serverMeta?hqMetaWeight(serverMeta):0;
  // Never let an empty/lagging server snapshot wipe richer local Club Eagle / Records edits.
  if(!serverMeta||serverW===0&&localW>0||(!serverP.hqMetaSupported&&localW>=serverW&&localW>0)||localW>serverW){
    serverP.hqMeta=localMeta||defaultHqMeta();
  }else{
    serverP.hqMeta=serverMeta;
  }
  // Always preserve Constitution + Guest Pool + Blog + roster emails (do not wipe on lagging server).
  const out=normalizeHqMeta(serverP.hqMeta);
  if(localMeta){
    if((localMeta.constitution||'').length>=(out.constitution||'').length)out.constitution=localMeta.constitution||out.constitution;
    const byId=new Map((out.guestPool||[]).map(g=>[g.id,g]));
    for(const g of (localMeta.guestPool||[])){
      const hit=[...byId.values()].find(x=>x.id===g.id||x.name.toLowerCase()===g.name.toLowerCase());
      if(hit){
        hit.aliases=[...new Set([...(hit.aliases||[]),...(g.aliases||[])])];
        if((g.updatedAt||'')>(hit.updatedAt||''))Object.assign(hit,{name:g.name,updatedAt:g.updatedAt});
      }else byId.set(g.id,g);
    }
    out.guestPool=[...byId.values()];
    out.blogPosts=mergeBlogPosts(out.blogPosts,localMeta.blogPosts);
    out.rosterEmails={...(localMeta.rosterEmails||{}),...(out.rosterEmails||{})};
    out.rosterProfiles={...(localMeta.rosterProfiles||{}),...(out.rosterProfiles||{})};
  }
  serverP.hqMeta=out;
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
  // Birdies + aces only — eagles belong to Club Eagle.
  for(const cat of RECORD_CATEGORIES){
    const mode=meta.modes[cat.id]||'combined';
    const manual=(meta.records||[]).filter(r=>r.category===cat.id);
    let autoList=cat.id==='birdies'?auto.birdieRounds:auto.aces;
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
    const me=(p.members||[]).find(m=>m.linked);
    if(me)return me.role==='chief'||me.role==='co_chief';
    // Local-only snapshots (no linked member yet): allow chief/co-chief roster roles only.
    const admin=(p.members||[]).find(m=>m.role==='chief'||m.role==='co_chief');
    return !!admin && (admin.role==='chief'||admin.role==='co_chief');
  }catch{return false}
}

function editIconBtn(kind){
  return `<button type="button" class="gr-hq-edit" data-gr-hq-edit="${esc(kind)}" title="Edit ${esc(kind)}" aria-label="Edit ${esc(kind)}">✎</button>`;
}

const HONOR_MARKS={eagles:'🦅',birdies:'🐦',ace:'⛳',records:'★',standings:'🏆'};

function honorHead(kind,title,sub,{addHtml=''}={}){
  const mark=HONOR_MARKS[kind]||'★';
  const markClass=kind==='eagles'?'gr-honor-eagle':kind==='birdies'?'gr-honor-birdies':kind==='ace'?'gr-honor-ace':'gr-honor-records';
  return `<div class="eagle-lockup gr-honor-lockup">
    <div class="eagle-mark gr-honor-mark ${markClass}" aria-hidden="true">${mark}</div>
    <div class="gr-honor-copy"><div class="eyebrow">${esc(title)}</div><div class="gr-honor-sub">${esc(sub)}</div></div>
    <div class="gr-honor-actions">${addHtml}${editIconBtn(kind)}</div>
  </div>`;
}

function eagleEventFeed(model){
  const events=[];
  for(const r of model.leaders||[]){
    for(const it of (r.items||[])){
      if(it.kind==='balance')continue;
      events.push({
        playerName:r.playerName,
        course:it.course||it.missionTitle||'',
        hole:it.hole!=null?it.hole:null,
        date:it.date||'',
        kind:it.kind||'detail'
      });
    }
  }
  return events.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,12);
}

function birdieBoardModel(p){
  const complete=(p.missions||[]).filter(m=>m.type!=='war'&&m.status==='completed');
  const map=new Map((p.members||[]).map(m=>[m.id,{memberId:m.id,playerName:m.name,birds:0}]));
  for(const m of complete)for(const r of (m.results||[])){
    const mm=canon(p,r.player_name)||memberById(p,r.hole_detail_canonical_id);
    if(!mm||!map.has(mm.id))continue;
    const st=detailStatsLocal(r);
    if(st.holes.length)map.get(mm.id).birds+=st.birds.length;
  }
  return [...map.values()].filter(x=>x.birds>0).sort((a,b)=>b.birds-a.birds||a.playerName.localeCompare(b.playerName));
}

function renderStandingsBubble(p,standingRows){
  const season=p?.season||new Date().getFullYear();
  const active=standingRows.filter(x=>Number(x.played||0)>0);
  const lockup=`<div class="eagle-lockup gr-honor-lockup">
    <div class="eagle-mark gr-honor-mark gr-honor-standings" aria-hidden="true">⛳</div>
    <div class="gr-honor-copy"><div class="eyebrow">MY TIME ⛳ POINTS</div><div class="gr-honor-sub">${esc(String(season))} · 18Birdies pts ÷ rounds</div></div>
  </div>`;
  const lead=active[0];
  const hero=lead?`<div class="gr-eagle-spotlight gr-standings-spotlight"><div class="gr-eagle-spotlight-label">Cup lead</div><div class="gr-eagle-spotlight-name">${esc(lead.member?.name||lead.name)}</div><div class="gr-eagle-spotlight-count">${lead.points}<span> /rnd</span></div><div class="gr-standings-hero-meta">${Number(lead.totalPoints||0)} 18Birdies · ${Number(lead.played||0)} round${Number(lead.played)===1?'':'s'}</div></div>`:'';
  const rows=active.length
    ? active.map((x,i)=>`<div class="gr155-recap-row gr-standings-row ${i===0?'is-lead':''}"><span><b>${i+1}</b> ${esc(x.member?memberLabel(x.member):(x.name||'Player'))}<small class="gr-standings-meta">${Number(x.totalPoints||0)} pts · ${Number(x.played||0)} rnd</small></span><span class="gr-standings-pts">${x.points}</span></div>`).join('')
    : '<div class="gr155-empty">No My Time ⛳ Points yet — finish a Mission to open the cup.</div>';
  return `<section class="gr155-recap-block gr-honor-card gr-honor-standings-card" data-gr-hq="standings">${lockup}${hero}${rows}</section>`;
}

function renderClubEagleBubble(p){
  const model=clubEagleModel(p);
  const add=`<button type="button" class="button secondary gr-hq-add-eg" data-gr-hq-edit="eagles" data-gr-hq-add="1">+ Eagle</button>`;
  const head=honorHead('eagles','CLUB EAGLE','Each eagle, with course & date',{addHtml:add});
  if(!model.leaders.length){
    return `<section class="gr155-recap-block gr-honor-card gr-honor-eagle-card" data-gr-hq="eagles">${head}<div class="gr155-empty">No eagles yet. Tap + Eagle to log one — each player keeps their own total.</div></section>`;
  }
  const lead=model.leaders[0];
  const hero=`<div class="gr-eagle-spotlight"><div class="gr-eagle-spotlight-label">Pace setter</div><div class="gr-eagle-spotlight-name">${esc(lead.playerName)}</div><div class="gr-eagle-spotlight-count">${lead.total}<span> eagle${lead.total===1?'':'s'}</span></div></div>`;
  const feed=eagleEventFeed(model);
  const rows=feed.length
    ? feed.map(e=>{
        const meta=[e.course,e.hole!=null?`Hole ${e.hole}`:'',e.date?fmtDate(e.date):''].filter(Boolean).join(' · ');
        return `<div class="gr155-recap-row gr155-eagle-row gr-eagle-event"><span><strong>${esc(e.playerName)}</strong>${meta?`<small class="gr-eagle-meta">${esc(meta)}</small>`:''}</span><span class="gr-eagle-pip" aria-hidden="true">🦅</span></div>`;
      }).join('')
    : model.leaders.slice(0,8).map((r,i)=>`<div class="gr155-recap-row gr155-eagle-row ${i===0?'is-lead':''}"><span><strong>${esc(r.playerName)}</strong></span><span class="gr-eagle-total">${r.total}</span></div>`).join('');
  const totals=`<div class="gr-eagle-board-label">Running totals</div>${model.leaders.slice(0,6).map((r,i)=>`<div class="gr155-recap-row gr155-eagle-row ${i===0?'is-lead':''}"><span><strong>${esc(r.playerName)}</strong></span><span class="gr-eagle-total">${r.total}</span></div>`).join('')}`;
  return `<section class="gr155-recap-block gr-honor-card gr-honor-eagle-card" data-gr-hq="eagles">${head}${hero}<div class="gr-eagle-board-label">Recent eagles</div>${rows}${totals}</section>`;
}

function renderBirdiesBubble(p){
  const board=birdieBoardModel(p);
  const head=honorHead('birdies','BIRDIES','Season running list',{addHtml:''});
  // Edit opens records editor (birdies/aces)
  const headFixed=head.replace('data-gr-hq-edit="birdies"','data-gr-hq-edit="records"');
  if(!board.length){
    return `<section class="gr155-recap-block gr-honor-card gr-honor-birdies-card" data-gr-hq="birdies">${headFixed}<div class="gr155-empty">No birdies logged yet — hole detail will fill this board.</div></section>`;
  }
  const lead=board[0];
  const hero=`<div class="gr-eagle-spotlight gr-birdies-spotlight"><div class="gr-eagle-spotlight-label">Birdie lead</div><div class="gr-eagle-spotlight-name">${esc(lead.playerName)}</div><div class="gr-eagle-spotlight-count">${lead.birds}<span> birdie${lead.birds===1?'':'s'}</span></div></div>`;
  const rows=board.slice(0,10).map((r,i)=>`<div class="gr155-recap-row gr-birdie-row ${i===0?'is-lead':''}"><span><strong>${esc(r.playerName)}</strong></span><span class="gr-birdie-total">${r.birds}</span></div>`).join('');
  return `<section class="gr155-recap-block gr-honor-card gr-honor-birdies-card" data-gr-hq="birdies">${headFixed}${hero}${rows}</section>`;
}

function renderAceBubble(p){
  const model=recordsModel(p);
  const a=model.ace||{display:[],flagged:[]};
  const head=honorHead('ace','HOLE IN ONE','Rare air',{addHtml:''}).replace('data-gr-hq-edit="ace"','data-gr-hq-edit="records"');
  let body;
  if(a.display.length){
    body=a.display.slice(0,4).map(x=>{
      const meta=[x.course||'',x.hole!=null?`Hole ${x.hole}`:'',x.date?fmtDate(x.date):''].filter(Boolean).join(' · ');
      return `<div class="gr155-record gr-record-flash gr-ace-row"><strong>${esc(x.player||x.playerName)}</strong><small>${esc(meta)}</small></div>`;
    }).join('');
  }else{
    body=`<div class="gr155-empty">Waiting on the first ace — this block stays ready.</div>`;
  }
  return `<section class="gr155-recap-block gr-honor-card gr-honor-ace-card gr-honor-ace-compact" data-gr-hq="ace">${head}${body}</section>`;
}

/** @deprecated Records combined card — kept for tests / callers; HQ now uses birdies + ace blocks. */
function renderRecordsBubble(p){
  return `${renderBirdiesBubble(p)}${renderAceBubble(p)}`;
}

function playerOptions(p,selected,{placeholder='Choose player…'}={}){
  const opts=(p.members||[]).map(m=>`<option value="${esc(m.id)}" ${String(selected)===String(m.id)?'selected':''}>${esc(m.name)}</option>`).join('');
  return `<option value="">${esc(placeholder)}</option>${opts}`;
}
function missionOptions(p,selected){
  const ms=(p.missions||[]).filter(m=>m.type!=='war').slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  return `<option value="">Optional Mission…</option>${ms.map(m=>`<option value="${esc(m.id)}" ${String(selected)===String(m.id)?'selected':''}>${esc(m.title||m.locationName||m.id)} (${esc(m.date||'')})</option>`).join('')}`;
}
function modeSelect(name,value){
  return `<select data-mode="${esc(name)}">${MODES.map(m=>`<option value="${m}" ${value===m?'selected':''}>${m[0].toUpperCase()+m.slice(1)}</option>`).join('')}</select>`;
}
function courseNameList(current){
  const names=[];
  try{if(typeof db!=='undefined'&&Array.isArray(db.courses))db.courses.forEach(c=>{const n=String(c?.baseName||c?.name||'').trim();if(n)names.push(n)})}catch{}
  try{(getP()?.missions||[]).forEach(m=>{const n=String(m?.locationName||'').trim();if(n&&n!=='Course TBD'&&n!=='Multi-course')names.push(n)})}catch{}
  const cur=String(current||'').trim();if(cur)names.push(cur);
  return [...new Set(names)].sort((a,b)=>a.localeCompare(b));
}
function courseSelectHtml(current){
  const cur=String(current||'').trim();
  const opts=courseNameList(cur).map(n=>`<option value="${esc(n)}" ${n===cur?'selected':''}>${esc(n)}</option>`).join('');
  return `<select data-f="course" class="gr-mission-select"><option value="">Select course…</option>${opts}<option value="__custom__">＋ Custom course…</option></select>`;
}
function holeSelectHtml(current){
  const cur=current==null||current===''?'':Number(current);
  const opts=Array.from({length:18},(_,i)=>i+1).map(h=>`<option value="${h}" ${cur===h?'selected':''}>${h}</option>`).join('');
  return `<select data-f="hole" class="gr-mission-select"><option value="">—</option>${opts}</select>`;
}
function dateFieldHtml(field,value,label){
  return `<label>${esc(label)}
    <input data-f="${esc(field)}" class="gr-datetime gr-date-picker" type="date" value="${esc(value||'')}" inputmode="none" autocomplete="off">
    <div class="gr-date-quick">
      <button type="button" class="gr-time-chip" data-date-preset="today">Today</button>
      <button type="button" class="gr-time-chip" data-date-preset="sat">Next Sat</button>
      <button type="button" class="gr-time-chip" data-date-preset="sun">Next Sun</button>
    </div>
  </label>`;
}
function isoFromPreset(kind){
  const now=new Date();
  let target=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(kind==='sat'){const day=target.getDay();const add=((6-day)+7)%7||7;target.setDate(target.getDate()+add)}
  if(kind==='sun'){const day=target.getDay();const add=((0-day)+7)%7||7;target.setDate(target.getDate()+add)}
  return `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}-${String(target.getDate()).padStart(2,'0')}`;
}
function bindDateChips(root){
  root.addEventListener('click',e=>{
    const chip=e.target.closest('[data-date-preset]');
    if(!chip||!root.contains(chip))return;
    e.preventDefault();
    const input=chip.closest('label')?.querySelector('input[type="date"]');
    if(!input)return;
    input.value=isoFromPreset(chip.dataset.datePreset);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
}
function bindCourseCustom(root){
  root.addEventListener('change',e=>{
    const sel=e.target.closest('select[data-f="course"]');
    if(!sel||sel.value!=='__custom__')return;
    const name=String(prompt('Course name')||'').trim();
    if(!name){sel.value='';return}
    let o=[...sel.options].find(x=>x.value===name);
    if(!o){o=document.createElement('option');o.value=name;o.textContent=name;const add=[...sel.options].find(x=>x.value==='__custom__');sel.insertBefore(o,add||null)}
    sel.value=name;
  });
}

function openRecordsEditor(){
  const p=getP();if(!p)return;
  if(!canEditHq(p)){alert('Only the Platoon Chief or Co-Chief can edit Records.');return}
  const meta=hqMetaOf(p);
  const model=recordsModel(p);
  const dlgFn=typeof platoonDialog==='function'?platoonDialog:null;
  if(!dlgFn){alert('Editor unavailable.');return}
  const editable=(meta.records||[]).filter(r=>r.category==='birdies'||r.category==='ace');
  const rows=editable.map((r,i)=>recordRowHtml(p,r,i)).join('')||'<div class="gr155-empty">No manual records yet.</div>';
  const d=dlgFn(`<div class="dialog-head"><div><div class="eyebrow">RECORDS</div><h2 style="margin:5px 0 0">Birdies &amp; holes in one</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div>
    <div class="platoon-notice"><strong>Modes:</strong> Automatic uses verified hole data · Manual uses only your entries · Combined (default) merges both without double-counting. Eagles live in Club Eagle.</div>
    <div class="gr-hq-modes grid two">
      <label>Birdies ${modeSelect('birdies',meta.modes.birdies)}</label>
      <label>Holes in One ${modeSelect('ace',meta.modes.ace)}</label>
    </div>
    <div class="gr-hq-editor-list" id="grHqRecList">${rows}</div>
    <div class="dialog-actions sticky-actions" style="margin-top:10px">
      <button class="button secondary" type="button" id="grHqRecAdd">+ Add record</button>
      <button class="button secondary" type="button" onclick="closePlatoonDialog()">Cancel</button>
      <button class="button primary" type="button" id="grHqRecSave">Save</button>
    </div>
    <div id="grHqRecMsg" class="gr-hq-msg" hidden></div>`);
  const list=d.querySelector('#grHqRecList');
  bindDateChips(d);bindCourseCustom(d);
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
      const next=[];
      list.querySelectorAll('.gr-hq-edit-row').forEach(row=>{
        let category=row.querySelector('[data-f="category"]').value;
        if(category!=='birdies'&&category!=='ace')category='birdies';
        const memberId=row.querySelector('[data-f="memberId"]').value;
        let playerName=row.querySelector('[data-f="playerName"]').value.trim();
        const resolved=resolvePlayer(p,memberId,playerName);
        if(memberId)playerName=resolved.playerName||playerName;
        const value=Number(row.querySelector('[data-f="value"]').value);
        let course=row.querySelector('[data-f="course"]').value.trim();
        if(course==='__custom__')course='';
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
      // Drop legacy eagle category rows — eagles belong in Club Eagle only.
      meta.records=next.filter(r=>r.category==='birdies'||r.category==='ace');
      writeHqMeta(p,meta);
      if(typeof writePlatoonLocal==='function')writePlatoonLocal(p);
      if(typeof savePlatoonLocal==='function')savePlatoonLocal(p,!window.grTestEnvActive);
      d.close();
      setTimeout(()=>{if(typeof render==='function')render()},0);
      alert(window.grTestEnvActive
        ?'Records saved on this device (TEST build — server sync off).'
        :('Records saved. They sync with your Platoon when online'+(window.__grHqMetaServer?'':' (server column pending migration approval)')+'.'));
    }catch(err){
      const msg=d.querySelector('#grHqRecMsg');msg.hidden=false;msg.textContent=err.message||String(err);msg.className='gr-hq-msg err';
    }
  };
}

function recordRowHtml(p,r){
  return `<div class="gr-hq-edit-row" data-id="${esc(r.id)}">
    <div class="grid two">
      <label>Category<select data-f="category" class="gr-mission-select">${RECORD_CATEGORIES.map(c=>`<option value="${c.id}" ${r.category===c.id?'selected':''}>${esc(c.label)}</option>`).join('')}</select></label>
      <label>Count / score<input data-f="value" type="number" min="1" step="1" value="${esc(r.value??1)}"></label>
    </div>
    <div class="grid two">
      <label>Player<select data-f="memberId" class="gr-mission-select">${playerOptions(p,r.memberId)}</select></label>
      <label>Name (if custom)<input data-f="playerName" value="${esc(r.playerName||'')}" placeholder="Player name"></label>
    </div>
    <div class="grid two">
      <label>Course${courseSelectHtml(r.course)}</label>
      <label>Hole${holeSelectHtml(r.hole)}</label>
    </div>
    <div class="grid two">
      ${dateFieldHtml('date',r.date,'Date')}
      <label>Mission<select data-f="missionId" class="gr-mission-select">${missionOptions(p,r.missionId)}</select></label>
    </div>
    <label>Notes<input data-f="notes" value="${esc(r.notes||'')}"></label>
    <label class="gr-hq-check"><input data-f="overrideAuto" type="checkbox" ${r.overrideAuto?'checked':''}> Override automatic display for this category</label>
    ${r.reviewFlag?'<div class="gr-hq-flag-line">⚑ Possible duplicate of an automatic result — review before saving.</div>':''}
    <div class="gr-hq-row-actions"><button type="button" class="button secondary" data-del-rec="${esc(r.id)}">Delete</button><span class="muted" style="font-size:var(--fs-data)">Manual</span></div>
  </div>`;
}

function eagleTotalsStripHtml(p){
  const model=clubEagleModel(p);
  if(!model.leaders.length)return `<div class="gr-eagle-live"><div class="gr155-empty">No running totals yet — log the first eagle below.</div></div>`;
  return `<div class="gr-eagle-live">${model.leaders.map(r=>`<div class="gr-eagle-chip"><span>${esc(r.playerName)}</span><strong>${r.total}</strong></div>`).join('')}</div>`;
}
function eagleHistoryHtml(p,meta){
  const dets=[...(meta.eagleDetails||[])].slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  if(!dets.length)return `<div class="gr155-empty">No logged eagles yet.</div>`;
  return dets.map(e=>{
    const who=resolvePlayer(p,e.memberId,e.playerName).playerName||e.playerName||'Player';
    const where=[e.course,e.hole!=null?`Hole ${e.hole}`:'',e.date?fmtDate(e.date):''].filter(Boolean).join(' · ');
    return `<div class="gr-eagle-hist" data-eg-id="${esc(e.id)}">
      <div><strong>${esc(who)}</strong><div class="muted" style="font-size:var(--fs-data)">${esc(where||'Details TBD')}</div></div>
      <div class="gr-eagle-hist-actions">
        <button type="button" class="button secondary" data-edit-eg="${esc(e.id)}" style="padding:6px 8px;font-size:var(--fs-data)">Edit</button>
        <button type="button" class="button secondary" data-del-eg="${esc(e.id)}" style="padding:6px 8px;font-size:var(--fs-data)">Delete</button>
      </div>
    </div>`;
  }).join('');
}
function blankEagleFormHtml(p,e={}){
  return `<div class="gr-hq-edit-row gr-eagle-log-form" data-edit-id="${esc(e.id||'')}">
    <div class="eyebrow" id="grEgFormTitle">${e.id?'EDIT EAGLE':'LOG AN EAGLE'}</div>
    <div class="grid two">
      <label>Player<select data-f="memberId" class="gr-mission-select">${playerOptions(p,e.memberId||'',{placeholder:'Choose player…'})}</select></label>
      <label>Custom name<input data-f="playerName" value="${esc(e.playerName||'')}" placeholder="Only if not in roster"></label>
    </div>
    <div class="grid two">
      <label>Course${courseSelectHtml(e.course||'')}</label>
      <label>Hole${holeSelectHtml(e.hole)}</label>
    </div>
    <div class="grid two">
      ${dateFieldHtml('date',e.date||'','Date')}
      <label>Mission<select data-f="missionId" class="gr-mission-select">${missionOptions(p,e.missionId||'')}</select></label>
    </div>
    <label>Notes<input data-f="notes" value="${esc(e.notes||'')}" placeholder="Optional"></label>
    <div class="dialog-actions" style="margin-top:10px">
      <button type="button" class="button secondary" id="grEgClear" ${e.id?'':'hidden'}>Cancel edit</button>
      <button type="button" class="button primary" id="grEgLog">${e.id?'Save changes':'+ Add to total'}</button>
    </div>
  </div>`;
}
function persistHq(p,meta){
  writeHqMeta(p,meta);
  if(typeof writePlatoonLocal==='function')writePlatoonLocal(p);
  if(typeof savePlatoonLocal==='function')savePlatoonLocal(p,!window.grTestEnvActive);
}

function openEaglesEditor(opts={}){
  const p=getP();if(!p)return;
  if(!canEditHq(p)){alert('Only the Platoon Chief or Co-Chief can edit Club Eagle.');return}
  let meta=hqMetaOf(p);
  const dlgFn=typeof platoonDialog==='function'?platoonDialog:null;
  if(!dlgFn){alert('Editor unavailable.');return}
  const d=dlgFn(`<div class="dialog-head"><div><div class="eyebrow">CLUB EAGLE</div><h2 style="margin:5px 0 0">Player eagle totals</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div>
    <p class="muted" style="font-size:var(--fs-data);margin:8px 0 0">Each cadet keeps their own running total. Log a new eagle below — previous ones stay in History, not in the form.</p>
    <div class="eyebrow" style="margin-top:14px">RUNNING TOTALS</div>
    <div id="grEgTotals">${eagleTotalsStripHtml(p)}</div>
    <div id="grEgFormWrap" style="margin-top:14px">${blankEagleFormHtml(p)}</div>
    <div class="eyebrow" style="margin-top:16px">HISTORY</div>
    <div id="grEgHistory" class="gr-eagle-history">${eagleHistoryHtml(p,meta)}</div>
    <details class="gr-eagle-advanced" style="margin-top:16px">
      <summary>Starting balances (optional)</summary>
      <p class="muted" style="font-size:var(--fs-data)">Use this for historical eagles before Golf Recon — not for logging a new one.</p>
      <div id="grHqBalList" class="gr-hq-editor-list">${(meta.eagleBalances||[]).map(b=>balanceRowHtml(p,b)).join('')||'<div class="gr155-empty">None yet.</div>'}</div>
      <button class="button secondary" type="button" id="grHqBalAdd">+ Starting balance</button>
      <button class="button secondary" type="button" id="grHqBalSave" style="margin-left:6px">Save balances</button>
    </details>
    <div class="dialog-actions sticky-actions">
      <button class="button secondary" type="button" onclick="closePlatoonDialog()">Done</button>
    </div>
    <div id="grHqEgMsg" class="gr-hq-msg" hidden></div>`);

  const formWrap=d.querySelector('#grEgFormWrap');
  const historyEl=d.querySelector('#grEgHistory');
  const totalsEl=d.querySelector('#grEgTotals');
  const balList=d.querySelector('#grHqBalList');
  const msg=d.querySelector('#grHqEgMsg');
  const showMsg=(text,ok=false)=>{msg.hidden=false;msg.textContent=text;msg.className='gr-hq-msg'+(ok?'':' err')};
  const refreshUi=()=>{
    meta=hqMetaOf(loadPlatoonLocal());
    Object.assign(p,loadPlatoonLocal());
    p.hqMeta=meta;
    totalsEl.innerHTML=eagleTotalsStripHtml(p);
    historyEl.innerHTML=eagleHistoryHtml(p,meta);
  };
  const resetForm=()=>{formWrap.innerHTML=blankEagleFormHtml(p);bindDateChips(formWrap);bindCourseCustom(formWrap);wireForm()};
  const readForm=()=>{
    const root=formWrap.querySelector('.gr-eagle-log-form');
    const memberId=root.querySelector('[data-f="memberId"]').value;
    let playerName=root.querySelector('[data-f="playerName"]').value.trim();
    const resolved=resolvePlayer(p,memberId,playerName);
    let course=root.querySelector('[data-f="course"]').value.trim();
    if(course==='__custom__')course='';
    const holeRaw=root.querySelector('[data-f="hole"]').value;
    const hole=holeRaw===''?null:Number(holeRaw);
    const date=root.querySelector('[data-f="date"]').value;
    const missionId=root.querySelector('[data-f="missionId"]').value;
    const mission=missionId?(p.missions||[]).find(m=>m.id===missionId):null;
    const notes=root.querySelector('[data-f="notes"]').value.trim();
    const editId=root.dataset.editId||'';
    if(!resolved.playerName&&!playerName)throw new Error('Choose a player.');
    return normalizeEagleDetail({
      id:editId||uid('eg'),
      memberId:resolved.memberId,
      playerName:resolved.playerName||playerName,
      course,hole,date,missionId,
      missionTitle:mission?.title||mission?.locationName||'',
      notes,
      updatedAt:new Date().toISOString()
    });
  };
  const wireForm=()=>{
    formWrap.querySelector('#grEgLog').onclick=()=>{
      try{
        const row=readForm();
        meta=hqMetaOf(loadPlatoonLocal());
        const idx=meta.eagleDetails.findIndex(x=>String(x.id)===String(row.id));
        if(idx>=0)meta.eagleDetails[idx]=row;
        else meta.eagleDetails.push(row);
        persistHq(p,meta);
        refreshUi();
        resetForm();
        showMsg(`${row.playerName}: eagle logged. Running total updated.`,true);
        setTimeout(()=>{if(typeof render==='function')render()},0);
      }catch(err){showMsg(err.message||String(err))}
    };
    formWrap.querySelector('#grEgClear')?.addEventListener('click',()=>resetForm());
  };

  bindDateChips(d);bindCourseCustom(d);wireForm();

  // Always land on a blank "add" form — never dump the last eagle into the editor.
  if(opts.editId){
    const existing=(meta.eagleDetails||[]).find(x=>String(x.id)===String(opts.editId));
    if(existing){formWrap.innerHTML=blankEagleFormHtml(p,existing);bindDateChips(formWrap);bindCourseCustom(formWrap);wireForm()}
  }else if(opts.add){
    formWrap.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  historyEl.onclick=e=>{
    const del=e.target.closest('[data-del-eg]');
    if(del){
      if(!confirm('Delete this logged eagle? The player’s running total will drop by 1.'))return;
      meta=hqMetaOf(loadPlatoonLocal());
      meta.eagleDetails=meta.eagleDetails.filter(x=>String(x.id)!==String(del.getAttribute('data-del-eg')));
      persistHq(p,meta);refreshUi();resetForm();
      showMsg('Eagle removed from history.',true);
      setTimeout(()=>{if(typeof render==='function')render()},0);
      return;
    }
    const ed=e.target.closest('[data-edit-eg]');
    if(ed){
      meta=hqMetaOf(loadPlatoonLocal());
      const existing=(meta.eagleDetails||[]).find(x=>String(x.id)===String(ed.getAttribute('data-edit-eg')));
      if(!existing)return;
      formWrap.innerHTML=blankEagleFormHtml(p,existing);
      bindDateChips(formWrap);bindCourseCustom(formWrap);wireForm();
      formWrap.scrollIntoView({behavior:'smooth',block:'nearest'});
    }
  };

  d.querySelector('#grHqBalAdd').onclick=()=>{
    const b=normalizeBalance({playerName:'',count:1,asOfDate:new Date().toISOString().slice(0,10)});
    if(balList.querySelector('.gr155-empty'))balList.innerHTML='';
    balList.insertAdjacentHTML('beforeend',balanceRowHtml(p,b));
    bindDateChips(balList);bindCourseCustom(balList);
  };
  d.querySelector('#grHqBalSave').onclick=()=>{
    try{
      meta=hqMetaOf(loadPlatoonLocal());
      const bals=[];
      balList.querySelectorAll('.gr-hq-edit-row').forEach(row=>{
        const memberId=row.querySelector('[data-f="memberId"]').value;
        let playerName=row.querySelector('[data-f="playerName"]').value.trim();
        const resolved=resolvePlayer(p,memberId,playerName);
        const count=Number(row.querySelector('[data-f="count"]').value);
        const asOfDate=row.querySelector('[data-f="asOfDate"]').value;
        const notes=row.querySelector('[data-f="notes"]').value.trim();
        const blank=!memberId&&!playerName&&(!Number.isFinite(count)||count===0)&&!asOfDate&&!notes;
        if(blank)return;
        if(!resolved.playerName&&!playerName)throw new Error('Choose a player for each starting balance.');
        if(!Number.isFinite(count)||count<0)throw new Error('Balance counts must be zero or greater.');
        bals.push(normalizeBalance({id:row.dataset.id,memberId:resolved.memberId,playerName:resolved.playerName||playerName,count,asOfDate,notes,updatedAt:new Date().toISOString()}));
      });
      meta.eagleBalances=bals;
      persistHq(p,meta);refreshUi();
      showMsg('Starting balances saved.',true);
      setTimeout(()=>{if(typeof render==='function')render()},0);
    }catch(err){showMsg(err.message||String(err))}
  };
}

function balanceRowHtml(p,b){
  return `<div class="gr-hq-edit-row" data-id="${esc(b.id)}">
    <div class="grid two">
      <label>Player<select data-f="memberId" class="gr-mission-select">${playerOptions(p,b.memberId,{placeholder:'Choose player…'})}</select></label>
      <label>Custom name<input data-f="playerName" value="${esc(b.playerName||'')}"></label>
    </div>
    <div class="grid two">
      <label>Starting eagles<input data-f="count" type="number" min="0" step="1" value="${esc(b.count??0)}"></label>
      ${dateFieldHtml('asOfDate',b.asOfDate,'As-of date')}
    </div>
    <label>Notes<input data-f="notes" value="${esc(b.notes||'')}"></label>
    <div class="gr-hq-row-actions"><button type="button" class="button secondary" data-del-bal="${esc(b.id)}">Remove</button><span class="muted" style="font-size:var(--fs-data)">Starting balance</span></div>
  </div>`;
}

function installStyles(){
  let s=document.getElementById('grHqRecStyles');
  if(!s){s=document.createElement('style');s.id='grHqRecStyles';document.head.appendChild(s)}
  s.textContent=`
  .gr-hq-title-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .gr-hq-edit{border:1px solid rgba(212,175,106,.4);background:rgba(212,175,106,.1);color:var(--accent,#d4af6a);border-radius:8px;width:28px;height:28px;padding:0;cursor:pointer;font-size:var(--fs-data);line-height:1}
  .gr-hq-edit:hover{background:rgba(212,175,106,.2)}
  .gr-hq-add-eg{padding:6px 9px!important;font-size:var(--fs-data)!important;font-weight:700!important}
  .gr-hq-mode-tag{margin-top:8px;font-size:var(--fs-subtitle);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600;font-family:var(--font-stencil,Oswald,sans-serif)}
  .gr-hq-src{font-style:normal;font-weight:700;opacity:.75;margin-left:4px;text-transform:none;letter-spacing:0}
  .gr-hq-flag{color:#ffcf68;font-style:normal}
  .gr-hq-flag-line,.gr-hq-review small{color:#ffcf68}
  .gr-hq-editor-list{display:grid;gap:10px;margin-top:10px;overflow:visible;max-height:none}
  .gr-hq-edit-row{border:1px solid var(--line,#24352d);border-radius:12px;padding:10px;background:rgba(16,25,20,.55)}
  #platoonDynamicDialog .dialog-card{overflow-y:auto;-webkit-overflow-scrolling:touch}
  #platoonDynamicDialog .sticky-actions{position:sticky;bottom:0;z-index:6}
  .gr-hq-edit-row label{margin-top:6px}
  .gr-hq-check{display:flex!important;align-items:center;gap:8px;flex-direction:row!important;font-size:var(--fs-data)}
  .gr-hq-check input{width:auto}
  .gr-hq-row-actions{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
  .gr-hq-msg{margin-top:10px;padding:8px 10px;border-radius:10px;font-size:var(--fs-data)}
  .gr-hq-msg.err{background:rgba(255,59,48,.1);border:1px solid rgba(255,59,48,.25);color:#ff9b96}
  .gr-hq-modes label{font-size:var(--fs-data)}
  .gr-honor-card{position:relative;overflow:hidden;border-color:rgba(212,175,106,.28)!important;background:linear-gradient(160deg,rgba(48,40,24,.5),rgba(14,12,10,.55))!important;box-shadow:0 16px 36px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,248,235,.1)!important}
  .gr-clubhouse-board{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important;margin-top:12px;align-items:start}
  .gr-eagle-stack{display:flex;flex-direction:column;gap:10px;min-width:0}
  .gr-honor-standings-card{grid-column:auto;background:radial-gradient(circle at 8% -20%,rgba(212,175,106,.28),transparent 40%),linear-gradient(160deg,rgba(56,44,22,.62),rgba(12,12,10,.6))!important}
  .gr-honor-eagle-card{background:radial-gradient(circle at 92% -10%,rgba(212,175,106,.22),transparent 42%),linear-gradient(160deg,rgba(52,40,20,.55),rgba(12,12,10,.58))!important}
  .gr-honor-birdies-card{background:radial-gradient(circle at 92% -10%,rgba(111,143,90,.22),transparent 42%),linear-gradient(160deg,rgba(28,40,24,.55),rgba(12,12,10,.58))!important}
  .gr-honor-ace-card{background:radial-gradient(circle at 90% -10%,rgba(212,175,106,.14),transparent 40%),linear-gradient(160deg,rgba(36,32,20,.5),rgba(12,12,10,.55))!important}
  .gr-honor-ace-compact{padding:10px 12px!important}
  .gr-honor-ace-compact .gr-honor-mark{width:36px;height:36px;font-size:var(--fs-subtitle)}
  .gr-honor-ace-compact .gr-honor-sub{font-size:var(--fs-data)}
  .gr-honor-records-card{background:radial-gradient(circle at 92% -10%,rgba(111,143,90,.18),transparent 42%),linear-gradient(160deg,rgba(36,40,24,.52),rgba(12,12,10,.58))!important}
  .gr-honor-lockup{display:flex;align-items:center;gap:10px;margin-bottom:10px}
  .gr-honor-mark{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;font-size:var(--fs-title);border:1px solid rgba(212,175,106,.4);background:radial-gradient(circle at 35% 30%,rgba(255,248,235,.16),rgba(212,175,106,.08) 45%,rgba(14,12,10,.55));box-shadow:0 0 18px rgba(212,175,106,.18),inset 0 1px 0 rgba(255,248,235,.2);flex:0 0 auto}
  .gr-honor-mark.gr-honor-eagle,.gr-honor-mark.gr-honor-standings{animation:grHonorPulse 2.8s ease-in-out infinite}
  .gr-honor-copy{flex:1 1 auto;min-width:0}
  .gr-honor-sub{font-size:var(--fs-data);font-weight:600;color:#e8dcc4;margin-top:2px}
  .gr-honor-actions{display:flex;gap:6px;align-items:center;flex:0 0 auto}
  .gr-eagle-spotlight{display:grid;gap:1px;padding:10px 10px 9px;margin:2px 0 8px;border-radius:12px;border:1px solid rgba(212,175,106,.35);background:linear-gradient(135deg,rgba(212,175,106,.18),rgba(20,16,10,.35));box-shadow:inset 0 1px 0 rgba(255,248,235,.12),0 10px 24px rgba(0,0,0,.2)}
  .gr-birdies-spotlight{border-color:rgba(111,143,90,.4);background:linear-gradient(135deg,rgba(111,143,90,.2),rgba(16,20,14,.35))}
  .gr-standings-spotlight{border-color:rgba(212,175,106,.45)}
  .gr-standings-hero-meta{font-size:var(--fs-data);font-weight:700;color:#c5d4cd;margin-top:4px}
  .gr-standings-meta{display:block;font-size:var(--fs-data);font-weight:600;color:#a8b8b0;margin-top:2px;letter-spacing:0;text-transform:none}
  .gr-eagle-spotlight-label{font-size:var(--fs-subtitle);letter-spacing:.14em;text-transform:uppercase;font-weight:600;font-family:var(--font-stencil,Oswald,sans-serif);color:var(--accent,#d4af6a)}
  .gr-eagle-spotlight-name{font-size:var(--fs-title);font-weight:600;font-family:var(--font-display,Cormorant Garamond,serif);line-height:1.15;color:#fff6e8;text-shadow:0 1px 10px rgba(0,0,0,.35)}
  .gr-eagle-spotlight-count{font-size:var(--fs-title);font-weight:600;font-family:var(--font-display,Cormorant Garamond,serif);color:var(--accent,#d4af6a);line-height:1;margin-top:3px;text-shadow:0 0 18px rgba(212,175,106,.25)}
  .gr-eagle-spotlight-count span{font-size:var(--fs-subtitle);font-weight:700;margin-left:5px;color:#dce6e1;letter-spacing:0;font-family:var(--font-body,Source Sans 3,sans-serif)}
  .gr-eagle-board-label{font-size:var(--fs-subtitle);letter-spacing:.14em;text-transform:uppercase;font-weight:600;font-family:var(--font-stencil,Oswald,sans-serif);color:var(--muted);margin:8px 0 4px}
  .gr-eagle-total,.gr-birdie-total,.gr-standings-pts{font-size:var(--fs-title)!important;font-weight:600!important;font-family:var(--font-display,Cormorant Garamond,serif)!important;color:var(--accent,#d4af6a)!important;text-shadow:0 0 12px rgba(212,175,106,.25)}
  .gr-birdie-total{color:#c5e6a8!important;text-shadow:0 0 12px rgba(111,143,90,.3)}
  .gr-eagle-meta{display:block;font-size:var(--fs-data);font-weight:600;color:#c5d4cd;margin-top:2px;letter-spacing:0;text-transform:none}
  .gr-eagle-pip{font-size:var(--fs-data);opacity:.9}
  .gr155-eagle-row.is-lead,.gr-birdie-row.is-lead,.gr-standings-row.is-lead{background:rgba(212,175,106,.08);border-radius:8px;padding-left:6px;padding-right:6px;margin:0 -6px}
  .gr-eagle-live{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  .gr-eagle-chip{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid rgba(212,175,106,.3);background:rgba(212,175,106,.1)}
  .gr-eagle-chip strong{color:var(--accent);font-size:var(--fs-subtitle)}
  .gr-eagle-history{display:grid;gap:8px;margin-top:8px}
  .gr-eagle-hist{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(16,20,16,.45)}
  .gr-eagle-hist-actions{display:flex;gap:6px}
  .gr-eagle-advanced{border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 12px;background:rgba(10,12,10,.35)}
  .gr-eagle-advanced summary{cursor:pointer;font-weight:700;font-size:var(--fs-data);color:var(--accent)}
  .gr-record-flash strong{font-size:var(--fs-subtitle)!important;color:#fff6e8}
  .gr-ace-row{padding:6px 0!important}
  .gr-honor-intel,.gr-honor-constitution{grid-column:1/-1}
  .gr-honor-constitution{background:radial-gradient(circle at 12% -20%,rgba(212,175,106,.16),transparent 42%),linear-gradient(160deg,rgba(40,34,22,.55),rgba(12,12,10,.58))!important;padding:10px 12px!important}
  .gr-honor-constitution.is-compact{padding:8px 10px!important}
  .gr-constitution-bubble{margin:0}
  .gr-constitution-sum{appearance:none;-webkit-appearance:none;border:0;background:transparent;color:inherit;width:100%;text-align:left;padding:0;margin:0;cursor:pointer;display:grid;gap:4px;font:inherit}
  .gr-constitution-peek{font-size:var(--fs-data);line-height:1.35;color:#c9d5cf;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;max-height:1.35em}
  .gr-constitution-toggle{font-size:var(--fs-data);font-weight:800;color:var(--accent,#d4af6a);letter-spacing:.04em}
  .gr-constitution-body{font-size:var(--fs-data);line-height:1.55;color:#e8f0ea;white-space:pre-wrap;margin-top:8px}
  .gr-constitution-bubble.is-collapsed .gr-constitution-body{display:none!important;visibility:hidden!important;height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}
  .gr-constitution-bubble:not(.is-collapsed) .gr-constitution-peek{display:none!important}
  .gr-constitution-bubble:not(.is-collapsed) .gr-constitution-sum{margin-bottom:2px}
  @media(max-width:700px){.gr-constitution-body,.gr-constitution-peek{font-size:var(--fs-data)}}
  .gr-clubhouse-board .gr-honor-lockup{margin-bottom:8px;gap:8px}
  .gr-clubhouse-board .gr-honor-mark{width:40px;height:40px;font-size:var(--fs-title)}
  .gr-clubhouse-board .gr-honor-sub{font-size:var(--fs-data)}
  @keyframes grHonorPulse{0%,100%{box-shadow:0 0 14px rgba(212,175,106,.14),inset 0 1px 0 rgba(255,248,235,.18)}50%{box-shadow:0 0 22px rgba(212,175,106,.28),inset 0 1px 0 rgba(255,248,235,.28)}}
  @media(max-width:900px){.gr-clubhouse-board{grid-template-columns:1fr 1fr!important}}
  @media(max-width:700px){.gr-clubhouse-board{grid-template-columns:1fr!important}}
  @media(prefers-reduced-motion:reduce){.gr-honor-mark.gr-honor-eagle,.gr-honor-mark.gr-honor-standings{animation:none}}
  `;
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
    else if(kind==='eagles')openEaglesEditor({add:!!b.getAttribute('data-gr-hq-add')});
  },true);
  document.addEventListener('click',e=>{
    if(!e.target.closest('[data-gr-edit-constitution]'))return;
    e.preventDefault();e.stopPropagation();
    openConstitutionEditor();
  },true);
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-gr-constitution-toggle]');
    if(!btn)return;
    e.preventDefault();e.stopPropagation();
    const bubble=btn.closest('.gr-constitution-bubble');
    const section=btn.closest('.gr-honor-constitution');
    if(!bubble)return;
    const open=!bubble.classList.contains('is-collapsed');
    const nextOpen=!open;
    bubble.classList.toggle('is-collapsed',!nextOpen);
    btn.setAttribute('aria-expanded',nextOpen?'true':'false');
    const body=bubble.querySelector('.gr-constitution-body');
    if(body)body.hidden=!nextOpen;
    const label=btn.querySelector('.gr-constitution-toggle');
    if(label)label.textContent=nextOpen?'Show less':'Read more';
    if(section)section.classList.toggle('is-compact',!nextOpen);
  },true);
}


function detailStatsLocal(r){
  const holes=cleanHoles(r?.holes).filter(h=>finite(h.score));
  const birds=holes.filter(h=>finite(h.par)&&h.score===h.par-1);
  const eagles=holes.filter(h=>finite(h.par)&&h.score<=h.par-2);
  return {holes,birds,eagles};
}
function platoonRecapMarkup(p){
  const complete=(p.missions||[]).filter(m=>m&&m.type!=='war'&&m.status==='completed');
  const cup=typeof window.grMyTimePointsStandings==='function'?window.grMyTimePointsStandings(p):{rows:[]};
  const map=new Map((p.members||[]).filter(m=>m&&m.id!=null).map(m=>[m.id,{member:m,points:0,played:0,totalPoints:0,birds:0,eagles:0,wins:0}]));
  for(const c of (cup.rows||[])){
    if(!map.has(c.id))continue;
    const x=map.get(c.id);
    x.points=c.points;
    x.played=c.played;
    x.totalPoints=c.totalPoints;
  }
  for(const m of complete)for(const r of (m.results||[])){
    const mm=canon(p,r.player_name)||memberById(p,r.hole_detail_canonical_id);
    if(!mm||!map.has(mm.id))continue;
    const x=map.get(mm.id),st=detailStatsLocal(r);
    if(Number(r.finish_position)===1)x.wins++;
    if(st.holes.length){x.birds+=st.birds.length;x.eagles+=st.eagles.length}
    else if(finite(r.eagle_count)&&Number(r.eagle_count)>0)x.eagles+=Number(r.eagle_count);
  }
  const rows=[...map.values()].sort((a,b)=>b.points-a.points||b.played-a.played||b.totalPoints-a.totalPoints||b.wins-a.wins||b.birds-a.birds||String(a.member.name).localeCompare(String(b.member.name)));
  const standings=renderStandingsBubble(p,rows);
  const birdies=renderBirdiesBubble(p);
  const eagle=renderClubEagleBubble(p);
  const ace=renderAceBubble(p);
  const intel=[];
  const latest=[...complete].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0];
  if(latest){
    const ranked=(typeof window.grMissionStandingsRows==='function'?window.grMissionStandingsRows(latest):(latest.results||[])).slice();
    const r=ranked[0];
    if(r)intel.push(`${displayName(p,r.player_name)} finished the latest Mission on top${finite(r.net)?` at net ${Number(r.net)}`:''}.`);
  }
  const rankedCup=rows.filter(x=>Number(x.played||0)>0);
  if(rankedCup.length){
    const best=rankedCup[0].points,leaders=rankedCup.filter(x=>x.points===best);
    intel.push(leaders.length>1
      ? `${leaders.map(x=>x.member.name).join(' & ')} are tied atop My Time ⛳ Points at ${best} per round.`
      : `${leaders[0].member.name} leads My Time ⛳ Points at ${best} per round (${leaders[0].totalPoints} 18Birdies across ${leaders[0].played} round${leaders[0].played===1?'':'s'}).`);
  }
  const birdVals=rows.map(x=>x.birds).filter(n=>n>0);
  if(birdVals.length){const b=Math.max(...birdVals);const bl=rows.filter(x=>x.birds===b);intel.push(`${bl.map(x=>x.member.name).join(' & ')} ${bl.length>1?'share':'holds'} the birdie lead with ${b}.`)}
  if(!intel.length)intel.push('No completed Missions yet. The season story is still waiting to be written.');
  // Clubhouse board: standings + birdies up top, eagle stack (eagle + compact HIO), intel below.
  return `<div class="gr155-recap-grid gr155-platoon-recap gr-clubhouse-board">
    ${standings}
    ${birdies}
    <div class="gr-eagle-stack">${eagle}${ace}</div>
    <section class="gr155-recap-block gr155-recap-copy gr155-intel-wide gr-honor-intel"><div class="gr155-recap-title">PLATOON INTEL</div>${intel.map(x=>`<p>${esc(x)}</p>`).join('')}</section>
    <section class="gr155-recap-block gr155-recap-copy gr155-intel-wide gr-honor-constitution is-compact">
      <div class="gr-hq-title-row"><div class="gr155-recap-title">MY TIME CONSTITUTION</div>${canEditHq(p)?`<button type="button" class="gr-hq-edit" data-gr-edit-constitution title="Edit Constitution">✎</button>`:''}</div>
      ${(()=>{
        const text=constitutionOf(p);
        if(!text)return `<p class="muted" style="margin:0">No constitution yet.${canEditHq(p)?' Tap edit to write the house rules.':''}</p>`;
        const peek=text.replace(/\s+/g,' ').trim();
        const short=peek.length>64?`${peek.slice(0,64).trim()}…`:peek;
        return `<div class="gr-constitution-bubble is-collapsed">
          <button type="button" class="gr-constitution-sum" data-gr-constitution-toggle aria-expanded="false">
            <span class="gr-constitution-peek">${esc(short)}</span>
            <span class="gr-constitution-toggle">Read more</span>
          </button>
          <div class="gr-constitution-body" hidden>${esc(text).replace(/\n/g,'<br>')}</div>
        </div>`;
      })()}
    </section>
  </div>`;
}

// Public API used by results renderer / sync merge
window.grHqMetaNormalize=normalizeHqMeta;
window.grHqMetaDefault=defaultHqMeta;
window.grMergeHqMetaPreserve=mergeHqMetaPreserve;
window.grRenderClubEagleBubble=renderClubEagleBubble;
window.grRenderRecordsBubble=renderRecordsBubble;
window.grRenderBirdiesBubble=renderBirdiesBubble;
window.grRenderAceBubble=renderAceBubble;
window.grBirdieBoardModel=birdieBoardModel;
window.grClubEagleModel=clubEagleModel;
window.grRecordsModel=recordsModel;
window.grCanEditHq=canEditHq;
window.grOpenRecordsEditor=openRecordsEditor;
window.grOpenEaglesEditor=openEaglesEditor;
window.grPlatoonRecapMarkup=platoonRecapMarkup;
window.grGuestPoolOf=guestPoolOf;
window.grUpsertGuestPool=upsertGuestPool;
window.grConstitutionOf=constitutionOf;
window.grSetConstitution=setConstitution;
window.grOpenConstitutionEditor=openConstitutionEditor;
window.grBlogPostsOf=blogPostsOf;
window.grNormalizeBlogPost=normalizeBlogPost;
window.grMergeBlogPosts=mergeBlogPosts;
window.grHqRecordsReady=true;

installStyles();
bindUi();
})();
