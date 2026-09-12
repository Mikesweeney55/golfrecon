from pathlib import Path
import re, subprocess

p=Path('index.html')
s=p.read_text()

s=s.replace('Golf Recon v14.5 Beta','Golf Recon v14.6 Beta')
s=s.replace('<span>v14.5 Beta</span>','<span>v14.6 Beta</span>',1)

old_scr="function scramblingPct(r){const c=course(r.courseId);let a=0,s=0;r.scores.forEach((score,i)=>{if(r.gir?.[i]===0){a++;if(score<=c.pars[i])s++;}});return a?100*s/a:null;}"
new_scr="""function scramblingCounts(r){
 const c=course(r.courseId);let opportunities=0,made=0;
 if(!c)return {made,opportunities};
 (r.scores||[]).forEach((score,i)=>{if(r.gir?.[i]===0){opportunities++;if(score<=c.pars?.[i])made++;}});
 return {made,opportunities};
}
function scramblingPct(r){const x=scramblingCounts(r);return x.opportunities?100*x.made/x.opportunities:null;}
function scramblingDisplay(r){const x=scramblingCounts(r);return `${x.made}/${x.opportunities}`;}"""
if old_scr not in s: raise SystemExit('scramblingPct pattern not found')
s=s.replace(old_scr,new_scr,1)

old_recent="const scrVals=recent.map(scramblingPct).filter(v=>v!=null);\n  const scr=scrVals.length?avg(scrVals):null;"
new_recent="const scr=recent.map(scramblingCounts).reduce((a,x)=>({made:a.made+x.made,opportunities:a.opportunities+x.opportunities}),{made:0,opportunities:0});"
if old_recent not in s: raise SystemExit('recent scrambling pattern not found')
s=s.replace(old_recent,new_recent,1)
s=s.replace("if(scr!=null) supporting.push(`scrambling ${Math.round(scr)}%`);","if(scr.opportunities) supporting.push(`scrambling ${scr.made}/${scr.opportunities}`);",1)

old_diff="""function scoreDifferential(r){
 const c=course(r.courseId);
 if(r.holes!==18 || !c)return null;
 let rating=c.rating,slope=c.slope;
 if((!Number.isFinite(rating)||!Number.isFinite(slope)) && isCalusaName(c.name||c.baseName)){
   const tee=romanTee(c.tees);
   const rs=tee?CALUSA_BLUE_TEE_RATINGS[tee]:null;
   if(rs){rating=rs.rating;slope=rs.slope}
 }
 if(!Number.isFinite(rating) || !Number.isFinite(slope) || !slope)return null;
 // WHS-like 18-hole estimate, using recorded gross as adjusted gross and PCC=0.
 return (r.gross-rating)*113/slope;
}
"""
new_diff="""function scoreDifferential(r){
 const c=course(r.courseId);
 if(r.holes!==18 || !c)return null;
 let rating=c.rating,slope=c.slope;
 if((!Number.isFinite(rating)||!Number.isFinite(slope)) && isCalusaName(c.name||c.baseName)){
   const tee=romanTee(c.tees);
   const rs=tee?CALUSA_BLUE_TEE_RATINGS[tee]:null;
   if(rs){rating=rs.rating;slope=rs.slope}
 }
 if(!Number.isFinite(rating) || !Number.isFinite(slope) || !slope)return null;
 // WHS Score Differential estimate: 113 / Slope × (recorded gross - Course Rating - PCC[0]).
 return Math.round((((r.gross-rating)*113/slope)+Number.EPSILON)*10)/10;
}
function handicapIndexFromDifferentials(differentials){
  const recent=(differentials||[]).filter(Number.isFinite).slice(-20);
  const n=recent.length;
  if(n<3)return null;
  let use=1,adjust=0;
  if(n===3){use=1;adjust=-2.0}
  else if(n===4){use=1;adjust=-1.0}
  else if(n===5){use=1}
  else if(n===6){use=2;adjust=-1.0}
  else if(n<=8){use=2}
  else if(n<=11){use=3}
  else if(n<=14){use=4}
  else if(n<=16){use=5}
  else if(n<=18){use=6}
  else if(n===19){use=7}
  else {use=8}
  const selected=recent.slice().sort((a,b)=>a-b).slice(0,use);
  const raw=avg(selected)+adjust;
  return Math.min(54,Math.round((raw+Number.EPSILON)*10)/10);
}
function handicapIndexAtRound(target){
  const eligible=db.rounds
    .filter(r=>r.holes===18 && Number.isFinite(scoreDifferential(r)))
    .slice()
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)) || (Number(a.id)||0)-(Number(b.id)||0));
  const idx=eligible.findIndex(r=>String(r.id)===String(target?.id));
  if(idx<0)return null;
  return handicapIndexFromDifferentials(eligible.slice(0,idx+1).map(scoreDifferential));
}
function currentHandicapIndex(){
  const diffs=db.rounds
    .filter(r=>r.holes===18 && Number.isFinite(scoreDifferential(r)))
    .slice()
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)) || (Number(a.id)||0)-(Number(b.id)||0))
    .map(scoreDifferential);
  return handicapIndexFromDifferentials(diffs);
}
"""
if old_diff not in s: raise SystemExit('scoreDifferential pattern not found')
s=s.replace(old_diff,new_diff,1)

old_defs=""" differential:{label:'Score differential',short:'Score Differential',domain:[0,25],value:r=>scoreDifferential(r),better:'low',fmt:v=>v.toFixed(1)},
 gir:{label:'Greens in regulation',short:'GIR',domain:[0,100],value:r=>{const a=(r.gir||[]).map(binaryStatValue).filter(v=>v!=null);return a.length?100*sum(a)/a.length:null},better:'high',fmt:v=>Math.round(v)+'%'},"""
new_defs=""" differential:{label:'Score differential',short:'Score Differential',domain:[0,25],value:r=>scoreDifferential(r),better:'low',fmt:v=>v.toFixed(1)},
 handicap:{label:'Handicap Index',short:'Handicap',domain:[0,30],value:r=>handicapIndexAtRound(r),better:'low',fmt:v=>v.toFixed(1)},
 gir:{label:'Greens in regulation',short:'GIR',domain:[0,100],value:r=>{const a=(r.gir||[]).map(binaryStatValue).filter(v=>v!=null);return a.length?100*sum(a)/a.length:null},better:'high',fmt:v=>Math.round(v)+'%'},"""
if old_defs not in s: raise SystemExit('roundStatDefs differential pattern not found')
s=s.replace(old_defs,new_defs,1)
s=s.replace("scrambling:{label:'Scrambling',short:'Scrambling',domain:[0,100],value:r=>scramblingPct(r),better:'high',fmt:v=>Math.round(v)+'%'}","scrambling:{label:'Scrambling',short:'Scrambling',domain:[0,100],value:r=>scramblingPct(r),better:'high',fmt:v=>Math.round(v)}",1)

start=s.find('function roundsChart(rounds,key){')
end=s.find('\nfunction roundsView(){',start)
if start<0 or end<0: raise SystemExit('roundsChart block not found')
new_chart=r'''function roundsChart(rounds,key){
 const d=roundStatDefs[key],chrono=rounds.slice().sort((a,b)=>a.date.localeCompare(b.date)),vals=chrono.map(r=>statValue(r,key)).filter(v=>v!=null);
 if(!vals.length)return `<div class="card empty">No comparable data for this metric in the selected rounds.</div>`;
 let [min,max]=d.domain;if(Math.min(...vals)<min)min=Math.floor(Math.min(...vals)/5)*5;if(Math.max(...vals)>max)max=Math.ceil(Math.max(...vals)/5)*5;
 const range=Math.max(max-min,1),av=avg(vals),best=d.better==='high'?Math.max(...vals):Math.min(...vals),ticks=[max,min+range*.75,min+range*.5,min+range*.25,min];
 const displayValue=(r,v)=>key==='scrambling'?scramblingDisplay(r):(v==null?'—':d.fmt(v));
 const bars=chrono.map(r=>{const v=statValue(r,key),h=v==null?0:Math.max(1,Math.min(100,100*(v-min)/range)),sel=String(state.selectedRoundId)===String(r.id),shown=displayValue(r,v);return `<div class="bar-col ${sel?'selected':''}" data-round-bar="${r.id}" role="button" tabindex="0" aria-label="${fmtDate(r.date)}, ${v==null?'no value':shown}"><div class="bar-track"><div class="bar-value" style="bottom:calc(${h}% + 6px)">${v==null?'—':shown}</div><div class="bar" style="height:${h}%"></div></div><div class="bar-label"><strong>${shortDate(r.date)}${r.holes===9?'<span class="nine-marker"></span>':''}</strong></div></div>`}).join('');
 const latest=chrono.at(-1),lv=latest?statValue(latest,key):null;
 let yTicks=ticks.map(v=>`<span>${d.fmt(v)}</span>`).join('');
 let summary=`<span class="badge">Average ${d.fmt(av)}</span><span class="badge">Best ${d.fmt(best)}</span><span class="badge">Latest ${lv==null?'—':d.fmt(lv)}</span>`;
 let note='';
 if(key==='scrambling'){
   yTicks=ticks.map(()=>'<span></span>').join('');
   const eligible=chrono.map(r=>({r,c:scramblingCounts(r)})).filter(x=>x.c.opportunities>0);
   const total=eligible.reduce((a,x)=>({made:a.made+x.c.made,opportunities:a.opportunities+x.c.opportunities}),{made:0,opportunities:0});
   const bestRound=eligible.slice().sort((a,b)=>(b.c.made/b.c.opportunities)-(a.c.made/a.c.opportunities)||b.c.opportunities-a.c.opportunities)[0];
   const latestRound=eligible.at(-1);
   summary=`<span class="badge">Total ${total.made}/${total.opportunities}</span><span class="badge">Best ${bestRound?scramblingDisplay(bestRound.r):'—'}</span><span class="badge">Latest ${latestRound?scramblingDisplay(latestRound.r):'—'}</span>`;
   note='<div class="target-note">Bar height reflects scrambling success rate; labels are saves/opportunities.</div>';
 }
 if(key==='handicap'){
   const current=currentHandicapIndex();
   summary=`<span class="badge">Current ${current==null?'—':current.toFixed(1)}</span><span class="badge">Low shown ${Math.min(...vals).toFixed(1)}</span><span class="badge">Rounds ${vals.length}</span>`;
   note='<div class="target-note">Golf Recon handicap estimate uses the USGA/WHS lowest differentials table: lowest 8 of the most recent 20 once 20 are available. Stored gross score is used with PCC assumed 0; official GHIN can differ when adjusted-gross, PCC, cap, exceptional-score or committee adjustments apply.</div>';
 }
 return `<div class="card chart-card"><div class="chart-head"><div><div class="eyebrow">ROUND-BY-ROUND TREND</div><strong>${d.label}</strong></div></div><div class="chart-scale"><div class="y-axis">${yTicks}</div><div class="round-chart-wrap"><div class="round-chart true-scale" style="--bars:${chrono.length}">${bars}</div></div></div><div class="chart-summary">${summary}</div>${note}</div>`;
}'''
s=s[:start]+new_chart+s[end:]

# Guardrails
for token in ["short:'Handicap'","scramblingDisplay(r)","lowest 8 of the most recent 20","Golf Recon v14.6 Beta"]:
  if token not in s: raise SystemExit(f'missing expected token: {token}')
if "scrambling ${Math.round(scr)}%" in s: raise SystemExit('old scrambling percentage still present')

p.write_text(s)

scripts=re.findall(r'<script>(.*?)</script>',s,re.S)
Path('/tmp/golfrecon-v146.js').write_text('\n'.join(scripts))
r=subprocess.run(['node','--check','/tmp/golfrecon-v146.js'],capture_output=True,text=True)
if r.returncode:
  print(r.stderr)
  raise SystemExit('Frontend JS syntax check failed')
print('v14.6 handicap + scrambling patch complete; JS syntax passed')
