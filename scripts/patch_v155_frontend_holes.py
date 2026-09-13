from pathlib import Path

p=Path('dev-v15.5-results.js')
s=p.read_text()

old="function hasDetail(m){return !!(m&&(m.scorecardDetail?.savedAt||m.supplementalScorecards?.savedAt))}"
new="function hasDetail(m){return !!(m&&(m.scorecardDetail?.savedAt||m.supplementalScorecards?.savedAt||(Array.isArray(m.results)&&m.results.some(r=>Array.isArray(r.holes)&&r.holes.length))))}"
if old in s:
    s=s.replace(old,new)
elif new not in s:
    raise SystemExit('hasDetail anchor not found')

old="function birdies(r){for(const k of ['birdie_count','birdies','birdieCount']){if(finite(r?.[k]))return Number(r[k])}return null}"
new="function birdies(r){for(const k of ['birdie_count','birdies','birdieCount']){if(finite(r?.[k]))return Number(r[k])}if(Array.isArray(r?.holes)){const n=r.holes.filter(h=>finite(h?.par)&&finite(h?.score)&&Number(h.score)<Number(h.par)).length;return n}return null}"
if old in s:
    s=s.replace(old,new)
elif new not in s:
    raise SystemExit('birdies anchor not found')

anchor="function closeChooser(){document.getElementById('gr155ResultsChooser')?.close()}\n"
insert=r'''function normalizeName(v){return String(v||'').trim().toLowerCase()}
function cleanHoles(holes){
  const byHole=new Map();
  for(const h of Array.isArray(holes)?holes:[]){
    const hole=Number(h?.hole);if(!Number.isInteger(hole)||hole<1||hole>18)continue;
    const par=finite(h?.par)?Number(h.par):null,score=finite(h?.score)?Number(h.score):null;
    byHole.set(hole,{hole,par,score});
  }
  return [...byHole.values()].sort((a,b)=>a.hole-b.hole);
}
function holeStats(holes){
  const valid=cleanHoles(holes).filter(h=>finite(h.score));
  const scored=valid.length;
  const front=valid.filter(h=>h.hole<=9).reduce((n,h)=>n+Number(h.score),0);
  const back=valid.filter(h=>h.hole>=10).reduce((n,h)=>n+Number(h.score),0);
  const frontCount=valid.filter(h=>h.hole<=9).length,backCount=valid.filter(h=>h.hole>=10).length;
  const birds=valid.filter(h=>finite(h.par)&&Number(h.score)<Number(h.par)).length;
  const pars=valid.filter(h=>finite(h.par)&&Number(h.score)===Number(h.par)).length;
  const bogeys=valid.filter(h=>finite(h.par)&&Number(h.score)===Number(h.par)+1).length;
  const doubles=valid.filter(h=>finite(h.par)&&Number(h.score)>=Number(h.par)+2).length;
  return {scored,front:frontCount?front:null,back:backCount?back:null,birds,pars,bogeys,doubles};
}
function holePreviewMarkup(parsed,m){
  const official=new Map((m.results||[]).map(r=>[normalizeName(r.player_name),r]));
  const players=Array.isArray(parsed?.players)?parsed.players:[];
  const rows=players.map(player=>{
    const holes=cleanHoles(player.holes),st=holeStats(holes),match=official.has(normalizeName(player.player_name));
    const split=[st.front!==null?`F9 ${st.front}`:'',st.back!==null?`B9 ${st.back}`:''].filter(Boolean).join(' · ');
    return `<div class="gr155-hole-player ${match?'':'warn'}"><div><strong>${esc(player.player_name||'Unknown player')}</strong><span>${holes.length} holes${split?' · '+esc(split):''}</span></div><div class="gr155-hole-mini">${st.birds} birdie${st.birds===1?'':'s'} · ${st.pars} par${st.pars===1?'':'s'}${match?'':' · NO OFFICIAL MATCH'}</div></div>`;
  }).join('')||'<div class="platoon-notice">No player hole details were found.</div>';
  const warnings=(parsed?.warnings||[]).map(w=>`<li>${esc(w)}</li>`).join('');
  return `${rows}${warnings?`<div class="platoon-notice"><strong>Parser notes</strong><ul class="gr155-warnings">${warnings}</ul></div>`:''}`;
}
function openHoleDetailImport(id){
  const p=getPlatoon(),m=(p?.missions||[]).find(x=>x.id===id);if(!m)return;
  if(!hasOfficial(m)){alert('Upload Official Results first. Hole-by-hole detail is matched to the locked official leaderboard.');return}
  if(typeof platoonDialog!=='function'||typeof callPlatoonFunction!=='function'||typeof platoonFilePayload!=='function'){if(typeof safeDetailImport==='function')safeDetailImport(id);else alert('Hole-by-hole import is unavailable.');return}
  const locked=JSON.parse(JSON.stringify(Array.isArray(m.results)?m.results:[]));
  const d=platoonDialog(`<div class="dialog-head"><div><div class="eyebrow">HOLE-BY-HOLE DETAIL</div><h2 style="margin:5px 0 0">${esc(m.title||m.locationName||'Mission')}</h2></div><button class="icon-button" type="button" onclick="closePlatoonDialog()">✕</button></div><div class="platoon-notice"><strong>Official scoring is locked.</strong><br>These screenshots add hole scores to matching players only. Gross, net, finish and points cannot be changed here.</div><label class="upload-zone" style="cursor:pointer"><strong>Add player scorecard screenshots</strong><span>Front 9, back 9, or full 18 · multiple images allowed</span><input id="gr155HoleFiles" type="file" accept="image/*" multiple></label><div id="gr155HoleFileList" class="platoon-file-list"></div><div id="gr155HoleOut"></div><div class="dialog-actions"><button class="button secondary" type="button" onclick="closePlatoonDialog()">Cancel</button><button class="button primary" id="gr155HoleParse" type="button">Read Hole Details</button></div>`);
  const input=d.querySelector('#gr155HoleFiles'),list=d.querySelector('#gr155HoleFileList'),out=d.querySelector('#gr155HoleOut'),btn=d.querySelector('#gr155HoleParse');
  input.onchange=()=>{list.textContent=[...input.files].map(f=>f.name).join(' · ')};
  btn.onclick=async()=>{
    const files=[...input.files];if(!files.length){out.innerHTML='<div class="platoon-notice">Add at least one scorecard screenshot.</div>';return}
    btn.disabled=true;btn.textContent='Reading…';out.innerHTML='<div class="platoon-notice">Reading player names and hole scores…</div>';
    try{
      const images=[];for(const f of files)images.push(await platoonFilePayload(f));
      const parsed=await callPlatoonFunction({action:'parse_hole_details',mission:{date:m.date,locationName:m.locationName,title:m.title},images});
      const players=Array.isArray(parsed?.players)?parsed.players:[];
      const officialNames=new Set(locked.map(r=>normalizeName(r.player_name)));
      const matched=players.filter(x=>officialNames.has(normalizeName(x.player_name))&&cleanHoles(x.holes).length);
      out.innerHTML=`<div class="gr155-hole-preview">${holePreviewMarkup(parsed,m)}</div><div class="dialog-actions"><button class="button primary" id="gr155HoleSave" type="button" ${matched.length?'':'disabled'}>Save Hole-by-Hole Detail</button></div>`;
      const save=out.querySelector('#gr155HoleSave');
      if(save&&!save.disabled)save.onclick=()=>{
        const byName=new Map(locked.map((r,i)=>[normalizeName(r.player_name),i]));
        let saved=0;
        for(const detail of players){
          const key=normalizeName(detail.player_name),idx=byName.get(key);if(idx===undefined)continue;
          const holes=cleanHoles(detail.holes);if(!holes.length)continue;
          locked[idx].holes=holes;
          locked[idx].hole_detail_saved_at=new Date().toISOString();
          locked[idx].hole_detail_source_count=files.length;
          saved++;
        }
        m.results=locked;
        savePlatoonLocal(p);
        d.close();
        setTimeout(enhanceAll,0);
        alert(`Hole-by-hole detail saved for ${saved} player${saved===1?'':'s'}. Official Mission scoring was not changed.`);
      };
    }catch(e){m.results=locked;out.innerHTML=`<div class="platoon-notice" style="border-color:rgba(255,77,79,.35);color:#ffadad">${esc(e.message||String(e))}</div>`}
    finally{btn.disabled=false;btn.textContent='Read Hole Details'}
  };
}

'''
if 'function openHoleDetailImport(id)' not in s:
    if anchor not in s:
        raise SystemExit('closeChooser anchor not found')
    s=s.replace(anchor,insert+anchor)

old="d.querySelector('[data-detail]').onclick=()=>{d.close();if(typeof safeDetailImport==='function')safeDetailImport(id);else alert('Scorecard detail import is unavailable.')};"
new="d.querySelector('[data-detail]').onclick=()=>{d.close();openHoleDetailImport(id)};"
if old in s:
    s=s.replace(old,new)
elif new not in s:
    raise SystemExit('detail button anchor not found')

style_anchor=".gr155-choice strong{display:block;margin-bottom:5px}.gr155-choice span{display:block;color:var(--muted);font-size:11px;line-height:1.3}\n"
style_add=".gr155-hole-preview{display:grid;gap:8px;margin-top:12px}.gr155-hole-player{border:1px solid var(--line);border-radius:10px;padding:9px 10px;background:rgba(255,255,255,.025)}.gr155-hole-player.warn{border-color:rgba(255,176,32,.45)}.gr155-hole-player>div:first-child{display:flex;justify-content:space-between;gap:8px;align-items:center}.gr155-hole-player span,.gr155-hole-mini{font-size:10px;color:var(--muted)}.gr155-hole-mini{margin-top:5px}.gr155-warnings{margin:6px 0 0;padding-left:18px}\n"
if style_add not in s:
    if style_anchor not in s:
        raise SystemExit('style anchor not found')
    s=s.replace(style_anchor,style_anchor+style_add)

p.write_text(s)
