from pathlib import Path
p=Path('index.html')
s=p.read_text()
s=s.replace('past-mission-import.js?v=1','past-mission-import.js?v=2')
p.write_text(s)
