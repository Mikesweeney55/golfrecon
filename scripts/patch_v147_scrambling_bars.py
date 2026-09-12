from pathlib import Path
import re, subprocess

p=Path('index.html')
s=p.read_text()
s=s.replace('Golf Recon v14.6 Beta','Golf Recon v14.7 Beta')
s=s.replace('<span>v14.6 Beta</span>','<span>v14.7 Beta</span>',1)

css=r'''

/* v14.7 scrambling nested bars: full height = attempts, fill = saves */
.bar.scramble-bar{
  position:relative;
  overflow:hidden;
  background:rgba(67,180,255,.10)!important;
  border:1px solid rgba(67,180,255,.46);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.035),0 0 12px rgba(67,180,255,.05)!important;
}
.scramble-fill{
  position:absolute;
  left:0;right:0;bottom:0;
  min-height:0;
  background:linear-gradient(180deg,var(--accent),#72dfaa)!important;
  box-shadow:0 0 12px rgba(199,255,102,.10);
}
.scramble-legend{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;font-size:10px;color:var(--muted)}
.scramble-legend span{display:inline-flex;align-items:center;gap:5px}
.scramble-swatch{width:10px;height:10px;border-radius:3px;border:1px solid rgba(255,255,255,.14)}
.scramble-swatch.attempts{background:rgba(67,180,255,.16);border-color:rgba(67,180,255,.55)}
.scramble-swatch.saves{background:var(--accent);border-color:rgba(199,255,102,.55)}
'''
if 'v14.7 scrambling nested bars' not in s:
    s=s.replace('\n</style>',css+'\n</style>',1)

new_func=r'''function roundsChart(rounds,key){
 const d=roundStatDefs[key],chrono=rounds.slice().sort((a,b)=>a.date.localeCompare(b.date));

 if(key==='scrambling'){
   const counts=chrono.map(r=>({r,c:scramblingCounts(r)}));
   const eligible=counts.filter(x=>x.c.opportunities>0);
   if(!eligible.length)return `<div class="card empty">No scrambling opportunities in the selected rounds.</div>`;

   const maxRoundHoles=Math.max(...counts.map(x=>Number(x.r.holes)||0),1);
   const maxAttempts=Math.max(...eligible.map(x=>x.c.opportunities),1);
   let max=Math.max(maxRoundHoles,maxAttempts);
   if(max<=9)max=9; else if(max<=12)max=12; else max=18;
   const ticks=[max,Math.round(max*.75),Math.round(max*.5),Math.round(max*.25),0];
   const bars=counts.map(({r,c})=>{
     const outerH=c.opportunities?Math.max(1,100*c.opportunities/max):0;
     const fillH=c.opportunities?Math.max(0,Math.min(100,100*c.made/c.opportunities)):0;
     const sel=String(state.selectedRoundId)===String(r.id);
     const shown=`${c.made}/${c.opportunities}`;
     return `<div class="bar-col ${sel?'selected':''}" data-round-bar="${r.id}" role="button" tabindex="0" aria-label="${fmtDate(r.date)}, ${c.made} scrambling saves in ${c.opportunities} opportunities"><div class="bar-track"><div class="bar-value" style="bottom:calc(${outerH}% + 6px)">${shown}</div>${c.opportunities?`<div class="bar scramble-bar" style="height:${outerH}%"><div class="scramble-fill" style="height:${fillH}%"></div></div>`:''}</div><div class="bar-label"><strong>${shortDate(r.date)}${r.holes===9?'<span class="nine-marker"></span>':''}</strong></div></div>`;
   }).join('');
   const total=eligible.reduce((a,x)=>({made:a.made+x.c.made,opportunities:a.opportunities+x.c.opportunities}),{made:0,opportunities:0});
   const bestRound=eligible.slice().sort((a,b)=>(b.c.made/b.c.opportunities)-(a.c.made/a.c.opportunities)||b.c.opportunities-a.c.opportunities)[0];
   const latestRound=eligible.at(-1);
   const summary=`<span class="badge">Total ${total.made}/${total.opportunities}</span><span class="badge">Best ${bestRound?scramblingDisplay(bestRound.r):'—'}</span><span class="badge">Latest ${latestRound?scramblingDisplay(latestRound.r):'—'}</span>`;
   const note=`<div class="scramble-legend"><span><i class="scramble-swatch attempts"></i>Full bar = opportunities</span><span><i class="scramble-swatch saves"></i>Filled portion = saves</span></div><div class="target-note">Both use the same count scale. Example: 5/18 reaches 18 attempts, with the fill rising to 5.</div>`;
   return `<div class="card chart-card"><div class="chart-head"><div><div class="eyebrow">ROUND-BY-ROUND TREND</div><strong>${d.label}</strong></div></div><div class="chart-scale"><div class="y-axis">${ticks.map(v=>`<span>${v}</span>`).join('')}</div><div class="round-chart-wrap"><div class="round-chart true-scale" style="--bars:${chrono.length}">${bars}</div></div></div><div class="chart-summary">${summary}</div>${note}</div>`;
 }

 const vals=chrono.map(r=>statValue(r,key)).filter(v=>v!=null);
 if(!vals.length)return `<div class="card empty">No comparable data for this metric in the selected rounds.</div>`;
 let [min,max]=d.domain;if(Math.min(...vals)<min)min=Math.floor(Math.min(...vals)/5)*5;if(Math.max(...vals)>max)max=Math.ceil(Math.max(...vals)/5)*5;
 const range=Math.max(max-min,1),av=avg(vals),best=d.better==='high'?Math.max(...vals):Math.min(...vals),ticks=[max,min+range*.75,min+range*.5,min+range*.25,min];
 const bars=chrono.map(r=>{const v=statValue(r,key),h=v==null?0:Math.max(1,Math.min(100,100*(v-min)/range)),sel=String(state.selectedRoundId)===String(r.id),shown=v==null?'—':d.fmt(v);return `<div class="bar-col ${sel?'selected':''}" data-round-bar="${r.id}" role="button" tabindex="0" aria-label="${fmtDate(r.date)}, ${v==null?'no value':shown}"><div class="bar-track"><div class="bar-value" style="bottom:calc(${h}% + 6px)">${shown}</div><div class="bar" style="height:${h}%"></div></div><div class="bar-label"><strong>${shortDate(r.date)}${r.holes===9?'<span class="nine-marker"></span>':''}</strong></div></div>`}).join('');
 const latest=chrono.at(-1),lv=latest?statValue(latest,key):null;
 let summary=`<span class="badge">Average ${d.fmt(av)}</span><span class="badge">Best ${d.fmt(best)}</span><span class="badge">Latest ${lv==null?'—':d.fmt(lv)}</span>`;
 let note='';
 if(key==='handicap'){
   const current=currentHandicapIndex();
   summary=`<span class="badge">Current ${current==null?'—':current.toFixed(1)}</span><span class="badge">Low shown ${Math.min(...vals).toFixed(1)}</span><span class="badge">Rounds ${vals.length}</span>`;
   note='<div class="target-note">Golf Recon handicap estimate uses the USGA/WHS lowest differentials table: lowest 8 of the most recent 20 once 20 are available. Stored gross score is used with PCC assumed 0; official GHIN can differ when adjusted-gross, PCC, cap, exceptional-score or committee adjustments apply.</div>';
 }
 return `<div class="card chart-card"><div class="chart-head"><div><div class="eyebrow">ROUND-BY-ROUND TREND</div><strong>${d.label}</strong></div></div><div class="chart-scale"><div class="y-axis">${ticks.map(v=>`<span>${d.fmt(v)}</span>`).join('')}</div><div class="round-chart-wrap"><div class="round-chart true-scale" style="--bars:${chrono.length}">${bars}</div></div></div><div class="chart-summary">${summary}</div>${note}</div>`;
}'''

s,n=re.subn(r'function roundsChart\(rounds,key\)\{.*?\n\}\nfunction roundsView\(\)\{',new_func+'\nfunction roundsView(){',s,count=1,flags=re.S)
if n!=1: raise SystemExit(f'Could not replace roundsChart; replacements={n}')

for token in ['Golf Recon v14.7 Beta','class="bar scramble-bar"','Full bar = opportunities','Filled portion = saves','function handicapIndexFromDifferentials','function scramblingCounts']:
    if token not in s: raise SystemExit(f'Missing expected token: {token}')

p.write_text(s)
scripts=re.findall(r'<script>(.*?)</script>',s,re.S)
Path('/tmp/golfrecon-v147.js').write_text('\n'.join(scripts))
r=subprocess.run(['node','--check','/tmp/golfrecon-v147.js'],capture_output=True,text=True)
if r.returncode:
    print(r.stderr)
    raise SystemExit('Frontend JS syntax check failed')
print('v14.7 nested scrambling bars patched; JS syntax passed.')
