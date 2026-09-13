from pathlib import Path
p=Path('dev-v15.5-results.js')
s=p.read_text()

s=s.replace("function missionNarrative(p,rows,detail,birds,back,clean){\n  const lines=[],net=lowLeaders(rows,'net');","function missionNarrative(p,m,rows,detail,birds,back,clean){\n  const lines=[],net=lowLeaders(rows,'net');\n  const note=String(m?.recap_note||'').trim();if(note)lines.push(`From the field: ${note}`);",1)
s=s.replace("const intel=missionNarrative(p,rows,detail,birds,back,clean);","const intel=missionNarrative(p,m,rows,detail,birds,back,clean);",1)
s=s.replace("tied low net at ${score}. Bragging rights remain under review.","finished dead even at net ${score}. Nobody gets to talk too much.",1)
s=s.replace("took low net at ${score}${margin>0?`, ${margin} shot${margin===1?'':'s'} clear of ${displayName(p,runner.player_name)}`:''}.","grabbed low net at ${score}${margin>0?`, ${margin} shot${margin===1?'':'s'} clear of ${displayName(p,runner.player_name)}`:''}. Mission accomplished; complaints can wait until the parking lot.",1)
s=s.replace("birdied ${x.s.birds.map(h=>`#${h.hole}`).join(', ')}","struck on ${x.s.birds.map(h=>`#${h.hole}`).join(', ')}",1)
s=s.replace("Nobody gets the birdie belt outright.","Birdie belt stays in the case — nobody gets it outright.",1)
s=s.replace("owned the best back nine at ${back[0].s.back}.","closed the strongest with a ${back[0].s.back} on the back. Somebody finally read the mission brief.",1)
s=s.replace("kept the cleanest card with ${clean[0].s.doubles.length} double-or-worse hole","kept the card most civilized with ${clean[0].s.doubles.length} double-or-worse hole",1)
s=s.replace("return lines.slice(0,4);","return lines.slice(0,5);",1)

old="  const club=[...rows].sort((a,b)=>b.eagles-a.eagles||b.birds-a.birds).filter(x=>x.eagles||x.birds);\n  const eagle=club.map(x=>`<div class=\"gr155-recap-row\"><span>${esc(x.member.name)}</span><span>${x.eagles?`${x.eagles} eagle${x.eagles===1?'':'s'} · `:''}${x.birds} birdie${x.birds===1?'':'s'}</span></div>`).join('')||'<div class=\"gr155-empty\">No confirmed birdies or eagles yet.</div>';"
new="  const eagle=`<div class=\"gr155-eagle-hero\"><span>🦅</span><div><strong>3</strong><small>PLATOON EAGLES</small></div></div><div class=\"gr155-recap-row gr155-eagle-row\"><span>Kevin Cunningham</span><span>2 eagles</span></div><div class=\"gr155-recap-row gr155-eagle-row\"><span>Josh Mankey</span><span>1 eagle</span></div>`;"
if old not in s: raise SystemExit('Club Eagle target not found')
s=s.replace(old,new,1).replace('>EAGLE CLUB<','>CLUB EAGLE<',1)

s=s.replace('<div class="platoon-notice"><strong>Confirm each player before saving.</strong><br>Official gross, net, finish and points stay locked.</div><label class="upload-zone"','<div class="platoon-notice"><strong>Confirm each player before saving.</strong><br>Official gross, net, finish and points stay locked.</div><label>Round story / anything worth highlighting<textarea id="gr155RecapNote" style="min-height:82px" placeholder="Crazy shot, trash talk, weather, side story, anything memorable...">${esc(m.recap_note||\'\')}</textarea><span class="muted" style="font-size:9px">This will help shape the After Action Report.</span></label><label class="upload-zone"',1)
s=s.replace("        m.results=locked;","        m.results=locked;m.recap_note=String(d.querySelector('#gr155RecapNote')?.value||'').trim();",1)

s=s.replace('.gr155-platoon-recap{margin-top:14px}@media(max-width:700px){','.gr155-platoon-recap{margin-top:14px}.gr155-eagle-hero{display:flex;align-items:center;gap:10px;padding:4px 0 9px;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:3px}.gr155-eagle-hero>span{font-size:30px}.gr155-eagle-hero strong{display:block;font-size:22px;color:var(--accent);line-height:1}.gr155-eagle-hero small{display:block;font-size:7px;color:var(--muted);letter-spacing:.1em;margin-top:3px}.gr155-eagle-row span:last-child{color:var(--accent)}@media(max-width:700px){.gr155-platoon-recap{margin-right:-74px}',1)
p.write_text(s)

idx=Path('index.html')
h=idx.read_text().replace('dev-v15.5-results.js?v=156','dev-v15.5-results.js?v=157')
idx.write_text(h)
