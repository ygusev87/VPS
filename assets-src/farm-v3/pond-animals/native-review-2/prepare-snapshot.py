"""Recreate the pinned runtime; all changes remain in this QA directory."""
import hashlib,io,json,shutil,subprocess,tarfile
from pathlib import Path
qa=Path(__file__).resolve().parent;repo=qa.parents[3];dest=qa/'.snapshot';spec=json.loads((qa/'snapshot.json').read_text())
if dest.exists():shutil.rmtree(dest)
dest.mkdir()
archive=subprocess.check_output(['git','archive',spec['revision'],'--',*spec['archivePaths']],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(archive)) as t:t.extractall(dest,filter='data')
for name,expected in spec['sha256'].items():
 if hashlib.sha256((dest/name).read_bytes()).hexdigest()!=expected:raise RuntimeError('Pinned snapshot mismatch '+name)
(dest/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
for name in ['review.html','snapshot.json']:shutil.copyfile(qa/name,dest/('qa.html' if name=='review.html' else name))
config={'base':'./','cacheDir':str(dest/'.vite'),'define':{'__BUILD__':json.dumps(spec['revision'][:7]+' pond native review')},'server':{'host':'127.0.0.1','port':5211,'strictPort':True,'fs':{'allow':[str(qa),str(repo/'node_modules')]}},'build':{'target':'es2022'}}
(dest/'qa-vite.config.mjs').write_text('export default '+json.dumps(config)+';\n')
print(dest)
