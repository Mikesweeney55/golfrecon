from pathlib import Path
import subprocess,re

# Restore the last known-good v14.1 app structure from commit 7d582e05...
base='7d582e05fac85b44e1825e4b3e28f42c00850140'
r=subprocess.run(['git','show',f'{base}:index.html'],capture_output=True,text=True)
if r.returncode:
    raise SystemExit(r.stderr)
s=r.stdout

# Version only; preserve the v14.1 visual system and v13.7 functional layout.
s=s.replace('<title>Golf Recon v14.1 Beta</title>','<title>Golf Recon v14.4 Beta</title>',1)
s=s.replace('<span>v14.1 Beta</span>','<span>v14.4 Beta</span>',1)

# Small visible-brand cleanup only. Do not rename internal backend identifiers.
s=s.replace('Ask GolfRecon','Ask Golf Recon')
s=s.replace('GOLFRECON READ','RECON READ')

# Guardrails: do not regress Pregame structure again.
required=[
    'class="hero pregame-hero"',
    'class="pregame-course-select"',
    'pregameHoleInsightsHtml(c,priority)',
    'class="game-keys-grid"',
    '<h2>What matters tomorrow</h2>',
    '<h2>Priority holes</h2>',
    '<small>Platoons</small>'
]
for token in required:
    if token not in s:
        raise SystemExit(f'Missing required v14.4 structure: {token}')

# Explicit ordering check: What matters tomorrow must come before Game Keys.
pregame_start=s.index('function pregame()')
pregame_end=s.index('function renderHoleCard',pregame_start)
p=s[pregame_start:pregame_end]
if p.index('What matters tomorrow') > p.index('gameKeysPregameHtml()'):
    raise SystemExit('Pregame order regression: Game Keys moved above What matters tomorrow')

# Compact game keys, not a large table/list.
if 'grid-template-columns:1fr 1fr' not in s or 'game-keys-grid' not in s:
    raise SystemExit('Compact two-column Game Keys styling missing')

Path('index.html').write_text(s)

# Frontend syntax check.
scripts=re.findall(r'<script>(.*?)</script>',s,re.S)
Path('/tmp/golfrecon-v144.js').write_text('\n'.join(scripts))
r=subprocess.run(['node','--check','/tmp/golfrecon-v144.js'],capture_output=True,text=True)
if r.returncode:
    print(r.stderr)
    raise SystemExit('Frontend JavaScript syntax check failed')
print('Golf Recon v14.4 restored from v14.1 baseline; Pregame structure guards passed; JS syntax passed.')
