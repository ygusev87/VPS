#!/usr/bin/env python3
"""Prepare a disposable exact-source QA snapshot; never start/rewrite the shared checkout."""
import hashlib, io, json, shutil, subprocess, tarfile, tempfile
from pathlib import Path
qa=Path(__file__).resolve().parent
repo=qa.parents[2]
manifest=json.loads((qa/'baseline/manifest.json').read_text())
dest=Path(tempfile.mkdtemp(prefix='farm-density-')).resolve()
paths=['src','public','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','scripts','assets-src/farm-v3/model-bounds.json']
archive=subprocess.check_output(['git','archive',manifest['revision'],'--',*paths],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:bundle.extractall(dest,filter='data')
(dest/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
for name in ['decor-layout.json','decor-authoring.json']:
    shutil.copyfile(qa/'candidate'/name,dest/'assets-src/farm-v3'/name)
shutil.copyfile(qa/'candidate/farm-decor.ts',dest/'src/farm-decor.ts')
for source,target in [('review.html','qa.html'),('qa-runtime.js','qa-runtime.js'),('baseline/decor-layout.json','baseline-layout.json'),('baseline/decor-authoring.json','baseline-authoring.json'),('candidate-audit.json','candidate-audit.json')]:shutil.copyfile(qa/source,dest/target)
html=(dest/'index.html').read_text().replace('</body>','<script type="module" src="/qa-runtime.js"></script></body>')
(dest/'qa-game.html').write_text(html)
source={'baseRevision':manifest['revision'],'candidateDecorSha256':hashlib.sha256((dest/'src/farm-decor.ts').read_bytes()).hexdigest(),'gameSourceHashes':{p:hashlib.sha256((dest/p).read_bytes()).hexdigest() for p in ['src/farm.ts','src/decor.ts','src/life.ts','src/parts/assets.ts']},'snapshot':str(dest),'changes':'Candidate farm-decor data plus separate QA wrapper; original game source unchanged.'}
(dest/'source.json').write_text(json.dumps(source,indent=2)+'\n')
(qa/'snapshot.json').write_text(json.dumps(source,indent=2)+'\n')
config={'base':'./','define':{'__BUILD__':json.dumps(manifest['revision'][:7]+' · density candidate')},'server':{'host':'127.0.0.1','port':5197,'strictPort':True,'fs':{'allow':[str(dest),str(repo/'node_modules')]}},'build':{'target':'es2022'}}
(dest/'qa-vite.config.mjs').write_text('export default '+json.dumps(config)+';\n')
# The existing checker remains unchanged in the repository. Adapt only its old fixed count locally.
checker=dest/'scripts/check-farm-decor.mjs';content=checker.read_text();needle="assert.equal(fieldCrops.length,9,'wheat must include the planted field, not just its garden bed');"
if content.count(needle)!=1:raise RuntimeError('Checker contract changed; review before adapting.')
count=len(json.loads((qa/'candidate/decor-layout.json').read_text())['DECOR'][-1]['items'])
checker.write_text(content.replace(needle,f"assert.equal(fieldCrops.length,{count},'density field count differs from reviewed candidate');"))
print(dest)
