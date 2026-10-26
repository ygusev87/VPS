import hashlib,io,json,shutil,subprocess,tarfile,tempfile
from pathlib import Path
qa=Path(__file__).resolve().parent
repo=qa.parents[3]
revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
dest=Path(tempfile.mkdtemp(prefix='city-garden-')).resolve()
archive=subprocess.check_output(['git','archive',revision,'--','src','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts'],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(archive))as bundle:bundle.extractall(dest,filter='data')
(dest/'public').symlink_to(repo/'public',target_is_directory=True)
(dest/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
for a,b in [('candidate.ts','src/city-decor.ts'),('review.html','qa.html'),('qa-runtime.js','qa-runtime.js'),('baseline.json','baseline.json')]:shutil.copyfile(qa/a,dest/b)
shutil.copyfile(repo/'assets-src/city-v2/layout-proposal.json',dest/'layout.json')
html=(dest/'index.html').read_text().replace('</body>','<script type="module" src="/qa-runtime.js"></script></body>');(dest/'qa-game.html').write_text(html)
source={'baseRevision':revision,'candidateSha256':hashlib.sha256((dest/'src/city-decor.ts').read_bytes()).hexdigest(),'snapshot':str(dest),'gameHashes':{p:hashlib.sha256((dest/p).read_bytes()).hexdigest()for p in ['src/city.ts','src/decor.ts','src/ground.ts','src/parts/assets.ts']}}
(dest/'source.json').write_text(json.dumps(source,indent=2)+'\n');(qa/'snapshot.json').write_text(json.dumps(source,indent=2)+'\n')
config={'base':'./','define':{'__BUILD__':json.dumps(revision[:7]+' city garden QA')},'server':{'host':'127.0.0.1','port':5195,'strictPort':True,'fs':{'allow':[str(dest),str(repo/'node_modules'),str(repo/'public')]}},'build':{'target':'es2022'}}
(dest/'qa-vite.config.mjs').write_text('export default '+json.dumps(config)+';\n')
print(dest)
