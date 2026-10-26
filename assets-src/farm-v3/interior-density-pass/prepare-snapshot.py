"""Recreate frozen game + candidate within this folder's ignored .snapshot/."""
import hashlib,io,json,shutil,subprocess,tarfile
from pathlib import Path
qa=Path(__file__).resolve().parent;repo=qa.parents[2];dest=qa/'.snapshot'
manifest=json.loads((qa/'baseline/manifest.json').read_text())
if dest.exists():shutil.rmtree(dest)
dest.mkdir()
paths=['src','public','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','scripts','assets-src/farm-v3/model-bounds.json']
archive=subprocess.check_output(['git','archive',manifest['revision'],'--',*paths],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:bundle.extractall(dest,filter='data')
for n in manifest['overrides']:
 t=dest/n;t.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(qa/'baseline/overrides'/n,t)
for n,expected in manifest['runtimeHashes'].items():
 if hashlib.sha256((dest/n).read_bytes()).hexdigest()!=expected:raise RuntimeError('Snapshot mismatch '+n)
# The shared checker has an obsolete exact count of 18. Change only that assertion in this isolated snapshot.
checker=dest/'scripts/check-farm-decor.mjs'
old=checker.read_text(); count=len(json.loads((qa/'field-wheat-replacement.json').read_text())['after'])
needle="assert.equal(fieldCrops.length,18,"
assert old.count(needle)==1
checker.write_text(old.replace(needle,f'assert.equal(fieldCrops.length,{count},'))
(qa/'checker-adaptation.json').write_text(json.dumps({'path':'scripts/check-farm-decor.mjs','scope':'isolated snapshot only','before':'fieldCrops.length == 18','after':f'fieldCrops.length == {count}','originalSha256':hashlib.sha256(old.encode()).hexdigest(),'adaptedSha256':hashlib.sha256(checker.read_bytes()).hexdigest(),'allOtherAssertionsUnchanged':True},indent=2)+'\n')
(dest/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
for name in ['decor-layout.json','decor-authoring.json']:shutil.copyfile(qa/'candidate'/name,dest/'assets-src/farm-v3'/name)
shutil.copyfile(qa/'candidate/farm-decor.ts',dest/'src/farm-decor.ts')
for a,b in [('review.html','qa.html'),('qa-runtime.js','qa-runtime.js'),('baseline/decor-layout.json','baseline-layout.json'),('baseline/decor-authoring.json','baseline-authoring.json'),('candidate-audit.json','candidate-audit.json')]:shutil.copyfile(qa/a,dest/b)
html=(dest/'index.html').read_text().replace('</body>','<script type="module" src="/qa-runtime.js"></script></body>');(dest/'qa-game.html').write_text(html)
source={'baseRevision':manifest['revision'],'candidateDecorSha256':hashlib.sha256((dest/'src/farm-decor.ts').read_bytes()).hexdigest(),'gameSourceHashes':{p:hashlib.sha256((dest/p).read_bytes()).hexdigest() for p in manifest['runtimeHashes'] if p.startswith('src/') and p!='src/farm-decor.ts'},'snapshot':str(dest),'changes':'Frozen original runtime; candidate farm-decor payload and separate QA wrapper only.'}
(dest/'source.json').write_text(json.dumps(source,indent=2)+'\n');(qa/'snapshot.json').write_text(json.dumps(source,indent=2)+'\n')
config={'cacheDir':str(dest/'.vite'),'base':'./','define':{'__BUILD__':json.dumps(manifest['revision'][:7]+' interior-density')},'server':{'host':'127.0.0.1','port':5210,'strictPort':True,'fs':{'allow':[str(qa),str(repo/'node_modules')]}},'build':{'target':'es2022'}}
(dest/'qa-vite.config.mjs').write_text('export default '+json.dumps(config)+';\n')
print(dest)
