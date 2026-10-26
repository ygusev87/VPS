#!/usr/bin/env python3
"""Serve an immutable game revision with the button-driven integration QA page."""
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

qa = Path(__file__).resolve().parent
repo = qa.parents[3]
spec = json.loads((qa / 'snapshot.json').read_text())
snapshot = Path(tempfile.mkdtemp(prefix='pond-integration-37a1a7c-'))
archive = subprocess.check_output(
    ['git', 'archive', spec['revision'], '--', *spec['archivePaths']], cwd=repo
)
with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
    bundle.extractall(snapshot, filter='data')
for name, expected in spec['sha256'].items():
    actual = hashlib.sha256((snapshot / name).read_bytes()).hexdigest()
    if actual != expected:
        raise RuntimeError(f'Snapshot hash mismatch: {name}')
(snapshot / 'node_modules').symlink_to(repo / 'node_modules', target_is_directory=True)
shutil.copyfile(qa / 'review.html', snapshot / 'qa.html')
config = {
    'base': './',
    'define': {'__BUILD__': json.dumps('37a1a7c · isolated pond integration QA')},
    'server': {'host': '127.0.0.1', 'port': 5197, 'strictPort': True,
               'fs': {'allow': [str(snapshot), str(repo / 'node_modules')]}},
    'build': {'target': 'es2022'},
}
(snapshot / 'qa-vite.config.mjs').write_text('export default ' + json.dumps(config) + ';\n')
print(f'Snapshot: {snapshot}\nOpen http://127.0.0.1:5197/qa.html', flush=True)
subprocess.run([str(repo / 'node_modules/.bin/vite'), '--config', 'qa-vite.config.mjs'],
               cwd=snapshot, check=True)
