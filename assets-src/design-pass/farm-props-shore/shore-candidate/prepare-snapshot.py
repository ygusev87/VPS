"""Recreate the reviewed runtime revision, with candidate additions only in a QA module."""
import hashlib,io,json,shutil,subprocess,tarfile,tempfile
from pathlib import Path
qa=Path(__file__).resolve().parent
repo=qa.parents[3]
source=json.loads((qa/'snapshot.json').read_text())
revision=source['revision']
dest=Path(tempfile.mkdtemp(prefix='farm-shore-')).resolve()
arc=subprocess.check_output(['git','archive',revision,'--','src','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts'],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(arc))as bundle:bundle.extractall(dest,filter='data')
(dest/'public').symlink_to(repo/'public',target_is_directory=True)
(dest/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
for a,b in [('review.html','qa.html'),('qa-runtime.js','qa-runtime.js'),('placement.json','placement.json'),('pond-dock.glb','pond-dock.glb'),('pond-reeds.glb','pond-reeds.glb'),('baseline-authoring.json','author.json')]:shutil.copyfile(qa/a,dest/b)
for p,h in source['runtimeHashes'].items():assert hashlib.sha256((dest/p).read_bytes()).hexdigest()==h,p
for name,h in source['publicModelHashes'].items():assert hashlib.sha256((repo/'public/models'/name).read_bytes()).hexdigest()==h,name
(dest/'qa-game.html').write_text((dest/'index.html').read_text().replace('</body>','<script type="module" src="/qa-runtime.js"></script></body>'))
source['snapshot']=str(dest);(dest/'source.json').write_text(json.dumps(source,indent=2)+'\n')
c={'base':'./','define':{'__BUILD__':json.dumps(revision[:7]+' shore candidate')},'server':{'host':'127.0.0.1','port':5197,'strictPort':True,'fs':{'allow':[str(dest),str(repo/'node_modules'),str(repo/'public')]}},'build':{'target':'es2022'}}
(dest/'qa-vite.config.mjs').write_text('export default '+json.dumps(c)+';\n')
print(dest)
