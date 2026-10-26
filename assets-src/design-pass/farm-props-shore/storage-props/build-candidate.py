from pathlib import Path
import json,shutil,subprocess,sys
q=Path(__file__).resolve().parent;dest=Path(sys.argv[1]).resolve();out=dest/'assets-src/farm-v3';out.mkdir(parents=True,exist_ok=True)
a=json.loads((q/'baseline/decor-authoring.json').read_text())
for g in json.loads((q/'forest-additions.json').read_text())['groups']:
    target=next(t for t in a['groups'] if t['model']==g['model'] and t['fit']==g['fit']);target['items'].extend(g['items'])
for g in json.loads((q/'placement.json').read_text())['groups']:a['groups'].append(dict(g,category='prop'))
g=json.loads((q/'reed-refinement.json').read_text());old=next(t for t in a['groups'] if t['model']=='pond-reeds');old.update(g)
(out/'decor-authoring.json').write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n')
shutil.copyfile(q/'baseline/decor-layout.json',out/'decor-layout.json')
shutil.copyfile(q.parents[3]/'assets-src/farm-v3/build-decor.py',out/'build-decor.py')
subprocess.run([sys.executable,str(out/'build-decor.py'),'--from-authoring'],cwd=dest,check=True)
(q/'candidate').mkdir(exist_ok=True)
for name,path in [('decor-authoring.json',out/'decor-authoring.json'),('decor-layout.json',out/'decor-layout.json'),('farm-decor.ts',dest/'src/farm-decor.ts')]:shutil.copyfile(path,q/'candidate'/name)
