"""Keep accepted JSON numeric spelling (including legacy 0.0) while appending proposals."""
import json
from pathlib import Path
here=Path(__file__).resolve().parent
for name,key in [('decor-layout.json','DECOR'),('decor-authoring.json','groups')]:
    base=json.loads((here/'baseline'/name).read_text())
    proposal=json.loads((here/'candidate'/name).read_text())
    assert len(base[key])==len(proposal[key])
    for old,new in zip(base[key],proposal[key]):
        assert old['model']==new['model'] and old['fit']==new['fit']
        assert new['items'][:len(old['items'])]==old['items']
        old['items'].extend(new['items'][len(old['items']):])
    if 'densityPass' in proposal:base['densityPass']=proposal['densityPass']
    (here/'candidate'/name).write_text(json.dumps(base,ensure_ascii=False,indent=2)+'\n')
