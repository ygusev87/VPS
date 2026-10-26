"""Freeze current runtime inputs without modifying the shared checkout."""
import hashlib, json, shutil, subprocess, datetime
from pathlib import Path
qa=Path(__file__).resolve().parent;repo=qa.parents[2]
sha=lambda b:hashlib.sha256(b).hexdigest()
revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
paths=['src','public','scripts','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','assets-src/farm-v3/model-bounds.json']
names=subprocess.check_output(['git','ls-files','--',*paths],cwd=repo,text=True).splitlines()
names+=subprocess.check_output(['git','ls-files','--others','--exclude-standard','--',*paths],cwd=repo,text=True).splitlines()
content={n:(repo/n).read_bytes() for n in names if (repo/n).is_file()}
files=['src/farm-decor.ts','assets-src/farm-v3/decor-layout.json','assets-src/farm-v3/decor-authoring.json','assets-src/farm-v3/decor-validation.json','scripts/check-farm-decor.mjs']
base={n:(repo/n).read_bytes() for n in files}
for n,b in content.items():
 if sha((repo/n).read_bytes())!=sha(b):raise RuntimeError('Concurrent edit while capturing: '+n)
for n,b in base.items():
 if (repo/n).read_bytes()!=b:raise RuntimeError('Concurrent authoring edit: '+n)
# Compare frozen bytes against the exact pinned revision, keep only necessary overrides.
overrides=qa/'baseline/overrides'
if overrides.exists():shutil.rmtree(overrides)
overrides.mkdir()
changed=[]
for n,b in content.items():
 old=subprocess.run(['git','show',revision+':'+n],cwd=repo,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 if old.returncode or old.stdout!=b:
  target=overrides/n;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b);changed.append(n)
for n,b in base.items():(qa/'baseline'/Path(n).name).write_bytes(b)
manifest={'revision':revision,'created':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':{n:sha(b) for n,b in base.items()},'runtimeHashes':{n:sha(b) for n,b in content.items()},'overrides':changed,'instances':sum(len(g['items']) for g in json.loads(base['assets-src/farm-v3/decor-layout.json'])['DECOR']),'note':'Pinned git archive plus exact working-tree overrides; no shared writes.'}
(qa/'baseline/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'revision':revision,'instances':manifest['instances'],'overrides':changed,'runtimeFiles':len(content)}))
