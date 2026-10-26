import hashlib,io,json,shutil,subprocess,tarfile,tempfile
from pathlib import Path
q=Path(__file__).resolve().parent;repo=q.parents[3]
rev=json.loads((q/'snapshot.json').read_text())['revision']
dest=Path(tempfile.mkdtemp(prefix='farm-storage-')).resolve()
arc=subprocess.check_output(['git','archive',rev,'--','src','public','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','scripts/check-farm-decor.mjs'],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(arc))as bundle:bundle.extractall(dest,filter='data')
(dest/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
for name in ['farm-crate','farm-barrel']:shutil.copyfile(q/(name+'.glb'),dest/'public/models'/(name+'.glb'))
subprocess.run(['python3',str(q/'build-candidate.py'),str(dest)],cwd=repo,check=True)
shutil.copyfile(q/'candidate/model-bounds.json',dest/'assets-src/farm-v3/model-bounds.json')
for a,b in [('review.html','qa.html'),('qa-runtime.js','qa-runtime.js'),('qa-placement.json','placement.json'),('forest-additions.json','forest-additions.json'),('baseline-authoring.json','author.json'),('occupied-layout.json','occupied-layout.json')]:shutil.copyfile(q/a,dest/b)
(dest/'qa-game.html').write_text((dest/'index.html').read_text().replace('</body>','<script type="module" src="/qa-runtime.js"></script></body>'))
s={'revision':rev,'snapshot':str(dest),'runtimeHashes':{p:hashlib.sha256((dest/p).read_bytes()).hexdigest()for p in ['src/farm.ts','src/farm-decor.ts','src/stage.ts','src/decor.ts']},'candidateHashes':{p:hashlib.sha256((dest/p).read_bytes()).hexdigest()for p in ['public/models/farm-crate.glb','public/models/farm-barrel.glb','placement.json','forest-additions.json','occupied-layout.json']},'occupancyNote':'Native candidate includes 33 forest additions, 4 storage props and seven enlarged reed bundles. Static clearance considers forest candidate; only reed/reed overlap is intentional.'}
(dest/'source.json').write_text(json.dumps(s,indent=2)+'\n');(q/'snapshot.json').write_text(json.dumps(s,indent=2)+'\n')
c={'base':'./','define':{'__BUILD__':json.dumps(rev[:7]+' storage+forest')},'server':{'host':'127.0.0.1','port':5196,'strictPort':True,'fs':{'allow':[str(dest),str(repo/'node_modules')]}},'build':{'target':'es2022'}};(dest/'qa-vite.config.mjs').write_text('export default '+json.dumps(c)+';\n');print(dest)
