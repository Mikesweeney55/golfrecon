from pathlib import Path

p=Path('dev-v15.5-results.js')
s=p.read_text()
old="function finite(v){return Number.isFinite(Number(v))}"
new="function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}"
if old in s:
    s=s.replace(old,new)
elif new not in s:
    raise SystemExit('finite helper anchor not found')
p.write_text(s)
