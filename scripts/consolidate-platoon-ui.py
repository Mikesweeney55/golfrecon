from pathlib import Path
import re

# 1) Put course cleanup in the real Platoon renderer.
real = Path('platoons-v15-real.js')
text = real.read_text()
helper = "function cleanCourseName(v){let s=String(v||'').replace(/\\s+/g,' ').trim();const cut=s.search(/\\.{3}|…/);if(cut>=0)s=s.slice(0,cut).trim();s=s.replace(/\\s*\\([^)]*$/,'').replace(/\\s*\\?{2,}.*$/,'').trim();return s}"
anchor = "const fmtDate=v=>v?new Date(v+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}):'Date TBD';"
if helper not in text:
    if anchor not in text:
        raise SystemExit('platoons-v15-real.js: fmtDate anchor not found')
    text = text.replace(anchor, anchor + "\n" + helper, 1)

# Display cleaned course names everywhere the Mission UI renders them.
repls = {
    "E(m.locationName||'Course TBD')": "E(cleanCourseName(m.locationName)||'Course TBD')",
    "E(m.locationName||'')": "E(cleanCourseName(m.locationName)||'')",
    "${m.locationName||'this course'}": "${cleanCourseName(m.locationName)||'this course'}",
    "obj.locationName=d.querySelector('#grMCourse').value.trim()||'Course TBD';": "obj.locationName=cleanCourseName(d.querySelector('#grMCourse').value)||'Course TBD';",
}
for old,new in repls.items():
    text = text.replace(old,new)
real.write_text(text)

# 2) Make the historical importer aggressively trim screenshot/OCR junk.
past = Path('past-mission-import.js')
ptext = past.read_text()
ptext = re.sub(
    r"function cleanCourseName\(v\)\{[^\n]*\}",
    "function cleanCourseName(v){let s=String(v||'').replace(/\\s+/g,' ').trim();const cut=s.search(/\\.{3}|…/);if(cut>=0)s=s.slice(0,cut).trim();s=s.replace(/\\s*\\([^)]*$/,'').replace(/\\s*\\?{2,}.*$/,'').trim();return s}",
    ptext,
    count=1,
)
past.write_text(ptext)

# 3) Put Points directly into the canonical three-block Mission standings renderer.
results = Path('dev-v15.5-results.js')
rtext = results.read_text()
old = "<span>${finite(r.net)?`N ${Number(r.net)}`:'N —'} · ${finite(r.gross)?`G ${Number(r.gross)}`:'G —'}</span>"
new = "<span>${finite(r.net)?`N ${Number(r.net)}`:'N —'} · ${finite(r.gross)?`G ${Number(r.gross)}`:'G —'} · ${finite(r.raw_points)?`${Number(r.raw_points)} pts`:'0 pts'}</span>"
if old not in rtext and new not in rtext:
    raise SystemExit('dev-v15.5-results.js: standings score snippet not found')
rtext = rtext.replace(old,new)
results.write_text(rtext)

# 4) Fix scrolling at the source CSS layer instead of using a DOM observer patch.
patch = Path('platoons-v15-patch-v5.js')
v5 = patch.read_text()
needle = "#grPlatoonDialog[open] .dialog-card{box-sizing:border-box!important;max-height:calc(100dvh - 16px)!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important;padding-bottom:calc(32px + env(safe-area-inset-bottom))!important}"
addition = needle + "#grPlatoonDialog[open] .gr-event-banner{position:static!important;top:auto!important;z-index:auto!important}#grPlatoonDialog[open] .gr-event-course{position:static!important;top:auto!important}"
if addition not in v5:
    if needle not in v5:
        raise SystemExit('platoons-v15-patch-v5.js: dialog CSS anchor not found')
    v5 = v5.replace(needle, addition, 1)
patch.write_text(v5)

# 5) Stop loading superseded recap overlays and bump only the scripts changed above.
idx = Path('index.html')
html = idx.read_text()
html = re.sub(r'\s*<script[^>]+src=["\'][^"\']*dev-platoon-recap-v1\.js[^"\']*["\'][^>]*></script>', '', html)
html = re.sub(r'\s*<script[^>]+src=["\'][^"\']*dev-post-mission-recap-v1\.js[^"\']*["\'][^>]*></script>', '', html)
html = re.sub(r'platoons-v15-real\.js(?:\?v=\d+)?', 'platoons-v15-real.js?v=163', html)
html = re.sub(r'platoons-v15-patch-v5\.js(?:\?v=\d+)?', 'platoons-v15-patch-v5.js?v=6', html)
html = re.sub(r'dev-v15\.5-results\.js(?:\?v=\d+)?', 'dev-v15.5-results.js?v=159', html)
html = re.sub(r'past-mission-import\.js(?:\?v=\d+)?', 'past-mission-import.js?v=5', html)
idx.write_text(html)
