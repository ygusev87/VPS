from pathlib import Path
import json,hashlib,tarfile,io,subprocess,tempfile,shutil
q=Path(__file__).resolve().parent;repo=q.parents[2];meta=q/'snapshot.json';rev=json.loads(meta.read_text())['revision']if meta.exists()else subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
base=Path(tempfile.mkdtemp(prefix='farm-roads-')).resolve();roots={}
for mode,port in [('before',5194),('after',5195)]:
 d=base/mode;d.mkdir();arc=subprocess.check_output(['git','archive',rev,'--','src','public','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts'],cwd=repo)
 with tarfile.open(fileobj=io.BytesIO(arc))as t:t.extractall(d,filter='data')
 if mode=='after':shutil.copyfile(repo/'assets-src/farm-v3/road-pass/candidate/farm-decor.ts',d/'src/farm-decor.ts')
 (d/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
 for a,b in [('review.html','qa.html'),('qa-runtime.js','qa-runtime.js')]:shutil.copyfile(q/a,d/b)
 (d/'qa-game.html').write_text((d/'index.html').read_text().replace('</body>','<script type="module" src="/qa-runtime.js"></script></body>'))
 source={'revision':rev,'mode':mode,'hashes':{str(p.relative_to(d)):hashlib.sha256(p.read_bytes()).hexdigest()for p in (d/'src').rglob('*')if p.is_file()}}
 (d/'source.json').write_text(json.dumps(source,indent=2)+'\n')
 config={'base':'./','define':{'__BUILD__':json.dumps(rev[:7]+' roads '+mode)},'server':{'host':'127.0.0.1','port':port,'strictPort':True,'fs':{'allow':[str(d),str(repo/'node_modules')]}},'build':{'target':'es2022'}}
 (d/'qa-vite.config.mjs').write_text('export default '+json.dumps(config)+';\n');roots[mode]={'path':str(d),'port':port,'source':source}
meta.write_text(json.dumps({'revision':rev,'roots':roots},indent=2)+'\n');print(json.dumps({k:v['path']for k,v in roots.items()}))
