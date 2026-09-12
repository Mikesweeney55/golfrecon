from pathlib import Path
import re,subprocess
p=Path('index.html')
s=p.read_text()
old="if(password.length<8)throw new Error('Password must be at least 8 characters.');"
new="if((authMode==='signup'||authMode==='recovery')&&password.length<8)throw new Error('Password must be at least 8 characters.');"
if old not in s: raise SystemExit('signin password guard anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
scripts=re.findall(r'<script>(.*?)</script>',s,re.S)
Path('/tmp/golfrecon-v148.js').write_text('\n'.join(scripts))
r=subprocess.run(['node','--check','/tmp/golfrecon-v148.js'],capture_output=True,text=True)
if r.returncode: print(r.stderr); raise SystemExit('JS syntax check failed')
print('Existing accounts can sign in with their current password; 8-character rule applies only to new/reset passwords.')
