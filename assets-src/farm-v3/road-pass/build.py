"""Emit width-only candidates through the pinned, unchanged --from-authoring exporter."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
from json_spans import replace, masked

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
BASE = HERE / 'baseline'
CANDIDATE = HERE / 'candidate'
SNAPSHOT = HERE / '.snapshot'
manifest = json.loads((HERE / 'baseline-manifest.json').read_text())
REVISION = manifest['revision']
for f in manifest['files']:
    assert hashlib.sha256((HERE / f['snapshot']).read_bytes()).hexdigest() == f['sha256']

texts = {name: (BASE / name).read_text() for name in ['decor-authoring.json', 'decor-layout.json']}
author, layout = (json.loads(texts[name]) for name in ['decor-authoring.json', 'decor-layout.json'])
assert len(author['paths']) == len(layout['PATHS']) == 19
assert sum(len(g['items']) for g in layout['DECOR']) == 686
wide = {'yard-spine', 'barn-entry', 'horse-yard', 'south-loop', 'shed-entry', 'tractor-gate'}
narrow = {'kitten-lift', 'farmhouse-porch', 'garden-cross'}
assert wide | narrow <= {p['name'] for p in author['paths']}
patch = []
for path, runtime in zip(author['paths'], layout['PATHS']):
    assert {k: v for k, v in path.items() if k != 'name'} == runtime
    after = 1.4 if path['name'] in wide else 1.0 if path['name'] in narrow else 1.2
    assert 0 < after < path['width']
    patch.append({'name': path['name'], 'before': path['width'], 'after': after})
(HERE / 'patch.json').write_text(json.dumps(patch, ensure_ascii=False, indent=2) + '\n')
CANDIDATE.mkdir(exist_ok=True)
for name, key in [('decor-authoring.json', 'paths'), ('decor-layout.json', 'PATHS')]:
    edits = {(key, i, 'width'): row['after'] for i, row in enumerate(patch)}
    changed = replace(texts[name], edits)
    assert masked(changed, edits) == masked(texts[name], edits)
    (CANDIDATE / name).write_text(changed)

for source, target in [
    ('build-decor.py', 'assets-src/farm-v3/build-decor.py'),
    ('model-bounds.json', 'assets-src/farm-v3/model-bounds.json'),
    ('farm-decor.ts', 'src/farm-decor.ts'),
    ('check-farm-decor.mjs', 'scripts/check-farm-decor.mjs'),
]:
    out = SNAPSHOT / target
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes((BASE / source).read_bytes())
model_manifest = []
for name in sorted({g['model'] for g in author['groups'] if g['category'] != 'future-toy'}):
    relative = f'public/models/{name}.glb'
    data = subprocess.check_output(['git', 'show', f'{REVISION}:{relative}'], cwd=REPO)
    out = SNAPSHOT / relative
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)
    model_manifest.append({'path': relative, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
(HERE / 'model-manifest.json').write_text(json.dumps(model_manifest, indent=2) + '\n')

# First prove that the accepted baseline is byte-stable under the unchanged exporter.
logs = []
for variant, folder in [('before', BASE), ('after', CANDIDATE)]:
    for name in texts:
        (SNAPSHOT / 'assets-src/farm-v3' / name).write_bytes((folder / name).read_bytes())
    run = subprocess.run([sys.executable, str(SNAPSHOT / 'assets-src/farm-v3/build-decor.py'), '--from-authoring'], cwd=SNAPSHOT, check=True, capture_output=True, text=True)
    source = (SNAPSHOT / 'src/farm-decor.ts').read_bytes()
    generated_layout = (SNAPSHOT / 'assets-src/farm-v3/decor-layout.json').read_bytes()
    assert generated_layout == (folder / 'decor-layout.json').read_bytes(), 'Exporter reformatted unrelated layout bytes'
    if variant == 'before':
        assert source == (BASE / 'farm-decor.ts').read_bytes(), 'Baseline exporter is not byte-stable'
    else:
        (CANDIDATE / 'farm-decor.ts').write_bytes(source)
    validation = subprocess.run(['node', str(SNAPSHOT / 'scripts/check-farm-decor.mjs')], cwd=SNAPSHOT, check=True, capture_output=True, text=True)
    (HERE / f'validation-{variant}.json').write_bytes((SNAPSHOT / 'assets-src/farm-v3/decor-validation.json').read_bytes())
    logs.append({'variant': variant, 'exporter': json.loads(run.stdout), 'validatorExitCode': validation.returncode, 'validatorStderr': validation.stderr})
(HERE / 'build-log.json').write_text(json.dumps(logs, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'status': 'built', 'baseline': REVISION, 'roads': len(patch), 'instances': 686, 'widths': {'1.4': len(wide), '1.0': len(narrow), '1.2': len(patch) - len(wide) - len(narrow)}, 'candidate': str(CANDIDATE)}))
