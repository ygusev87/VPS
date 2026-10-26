#!/usr/bin/env python3
"""Prepare a disposable exact-source QA snapshot; never start/rewrite the shared checkout."""
import hashlib, io, json, shutil, subprocess, tarfile, tempfile
from pathlib import Path
qa=Path(__file__).resolve().parent
repo=qa.parents[2]
manifest=json.loads((qa/'baseline/manifest.json').read_text())
dest=Path(tempfile.mkdtemp(prefix='farm-forest-')).resolve()
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
config={'base':'./','define':{'__BUILD__':json.dumps(manifest['revision'][:7]+' · forest candidate')},'server':{'host':'127.0.0.1','port':5198,'strictPort':True,'fs':{'allow':[str(dest),str(repo/'node_modules')]}},'build':{'target':'es2022'}}
(dest/'qa-vite.config.mjs').write_text('export default '+json.dumps(config)+';\n')
# Captured maintainer validator already expects18; use the exact saved bytes.
shutil.copyfile(qa/'baseline/check-farm-decor.mjs',dest/'scripts/check-farm-decor.mjs')
print(dest)
