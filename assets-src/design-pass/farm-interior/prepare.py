"""Freeze the current game plus the staged item-only patch for final integration QA."""
from pathlib import Path
import hashlib, io, json, shutil, subprocess, tarfile, tempfile
q = Path(__file__).resolve().parent
repo = q.parents[2]
child = repo / 'assets-src/farm-v3/interior-density-pass'
report = json.loads((q / 'integration.json').read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
for path, expected in report['candidateHashes'].items():
    assert sha(q / 'candidate' / Path(path).name) == expected
for path, expected in report['handoffHashes'].items():
    assert sha(child / path) == expected, 'Child changed handoff; restage first'
rev = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip()
dest = Path(tempfile.mkdtemp(prefix='farm-interior-')).resolve()
paths = ['src','public','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','scripts','assets-src/farm-v3/model-bounds.json']
archive = subprocess.check_output(['git','archive',rev,'--',*paths],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
    bundle.extractall(dest, filter='data')
for relative in report['candidateHashes']:
    target = dest / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(q / 'candidate' / Path(relative).name, target)
checker = dest / 'scripts/check-farm-decor.mjs'
old = checker.read_text()
count = len(json.loads((child / 'field-wheat-replacement.json').read_text())['after'])
needle = 'assert.equal(fieldCrops.length,18,'
if needle in old:
    assert old.count(needle) == 1
    checker.write_text(old.replace(needle, f'assert.equal(fieldCrops.length,{count},'))
    adaptation = 'Snapshot only: field count 18 to '+str(count)+'; every other assertion unchanged.'
else:
    adaptation = 'Current checker retained; no snapshot override required.'
(dest / 'node_modules').symlink_to(repo / 'node_modules', target_is_directory=True)
for a, b in [('qa-runtime.js','qa-runtime.js'),('candidate-audit.json','candidate-audit.json')]:
    shutil.copyfile(child / a, dest / b)
# The before view uses current accepted dressing, not the child\'s older road snapshot.
shutil.copyfile(repo / 'assets-src/farm-v3/decor-layout.json', dest / 'baseline-layout.json')
shutil.copyfile(repo / 'assets-src/farm-v3/decor-authoring.json', dest / 'baseline-authoring.json')
html = (child / 'review.html').read_text().replace('<title>Ферма A · внутренние посадки</title>', '<title>Ферма A · интеграция посадок</title>')
html = html.replace('iframe{display:block;border:0}', 'iframe{display:block;border:0;transform:scale(.75);transform-origin:top left}')
html = html.replace('<option value="1180,820">1180×820 · budget</option>', '<option value="1180,820">1180×820 · budget</option><option value="1024,768">1024×768</option>')
(dest / 'qa.html').write_text(html)
(dest / 'qa-game.html').write_text((dest / 'index.html').read_text().replace('</body>','<script type="module" src="/qa-runtime.js"></script></body>'))
source = {'baseRevision':rev,'candidateDecorSha256':sha(dest / 'src/farm-decor.ts'),'snapshot':str(dest),'checkerAdaptation':adaptation,'stageReportSha256':sha(q / 'integration.json'),'sourceHashes':{str(p.relative_to(dest)):sha(p) for p in (dest / 'src').rglob('*') if p.is_file()},'childHarnessSha256':sha(dest / 'qa-runtime.js')}
(dest / 'source.json').write_text(json.dumps(source,indent=2)+'\n')
config = {'base':'./','define':{'__BUILD__':json.dumps(rev[:7]+' interior integration')},'server':{'host':'127.0.0.1','port':5212,'strictPort':True,'fs':{'allow':[str(dest),str(repo / 'node_modules')]}},'build':{'target':'es2022'}}
(dest / 'qa-vite.config.mjs').write_text('export default '+json.dumps(config)+';\n')
(q / 'snapshot.json').write_text(json.dumps(source,indent=2)+'\n')
print(json.dumps({'snapshot':str(dest),'revision':rev,'checkerAdaptation':adaptation}))
