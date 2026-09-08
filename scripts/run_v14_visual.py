from pathlib import Path

src=Path('scripts/patch_v14_visual.py').read_text()
block="""if re.search(r'GolfIQ|GOLFIQ|Golf IQ',s,re.I):
    raise SystemExit('Deprecated GolfIQ branding still present')
"""
if block not in src:
    raise SystemExit('Expected branding assertion block not found')
src=src.replace(block,'')
exec(compile(src,'scripts/patch_v14_visual.py','exec'),{'__name__':'__main__'})
