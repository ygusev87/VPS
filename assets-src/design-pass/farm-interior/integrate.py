"""Stage only the accepted handoff's item arrays; apply requires an unchanged reviewed stage."""
from pathlib import Path
import argparse, hashlib, importlib.util, json, re, subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CHILD = ROOT / 'assets-src/farm-v3/interior-density-pass'
FILES = ['assets-src/farm-v3/decor-authoring.json', 'assets-src/farm-v3/decor-layout.json', 'src/farm-decor.ts']
HANDOFF = ['additions.json', 'field-wheat-replacement.json']
STAGE = HERE / 'candidate'
REPORT = HERE / 'integration.json'
spec = importlib.util.spec_from_file_location('json_spans', ROOT / 'assets-src/farm-v3/road-pass/json_spans.py')
spans = importlib.util.module_from_spec(spec)
spec.loader.exec_module(spans)
sha = lambda b: hashlib.sha256(b).hexdigest()
key = lambda g: (g['model'], json.dumps(g['fit'], sort_keys=True))
load = lambda p: json.loads(p.read_text())

def one(groups, identity):
    indices = [i for i, g in enumerate(groups) if key(g) == identity]
    assert len(indices) == 1, f'Ambiguous/missing model + fit: {identity}'
    return indices[0]

def stage():
    source = {p: (ROOT / p).read_bytes() for p in FILES}
    handoff = {p: (CHILD / p).read_bytes() for p in HANDOFF}
    additions, wheat = [json.loads(handoff[p]) for p in HANDOFF]
    assert additions['baseRevision'] == wheat['baseRevision']
    assert {g['model'] for g in additions['groups']} <= {'flower-cluster', 'bush-lite'}
    assert wheat['model'] == 'crop-wheat' and wheat['fit'] == {'width': 1.4}
    baseline = load(CHILD / 'baseline/decor-layout.json')
    author, layout = [json.loads(source[p]) for p in FILES[:2]]
    updates = {}
    for g in additions['groups']:
        identity = key(g)
        i = one(layout['DECOR'], identity)
        old = baseline['DECOR'][one(baseline['DECOR'], identity)]['items']
        assert layout['DECOR'][i]['items'] == old, f'Plant group changed since handoff: {identity}'
        assert identity not in updates
        extra = g['items']
        assert extra and len({tuple(p) for p in extra}) == len(extra)
        assert not set(map(tuple, old)) & set(map(tuple, extra)), 'An addition already exists'
        updates[identity] = old + extra
    wi = one(layout['DECOR'], key(wheat))
    assert baseline['DECOR'][wi]['items'] == wheat['before']
    assert layout['DECOR'][wi]['items'] == wheat['before'], 'Field wheat changed since handoff'
    assert wheat['after'] and wheat['after'] != wheat['before']
    updates[key(wheat)] = wheat['after']
    outputs = {}
    for path, document, group_key in [(FILES[0], author, 'groups'), (FILES[1], layout, 'DECOR')]:
        text = source[path].decode()
        replacements = {(group_key, one(document[group_key], identity), 'items'): items for identity, items in updates.items()}
        located = spans.spans(text)
        result = text
        edits = []
        for path_key, items in replacements.items():
            start, end = located[path_key]
            token = text[start:end]
            indent = token.splitlines()[-1].split(']')[0]
            old_items = document[group_key][path_key[1]]['items']
            if items[:len(old_items)] == old_items:
                suffix = json.dumps(items[len(old_items):], ensure_ascii=False, indent=2).splitlines()[1:-1]
                replacement = token[:token.rfind(']')].rstrip() + ',\n' + '\n'.join(indent + line for line in suffix) + '\n' + indent + ']'
            else:
                lines = json.dumps(items, ensure_ascii=False, indent=2).splitlines()
                replacement = lines[0] + '\n' + '\n'.join(indent + line for line in lines[1:])
            edits.append((start, end, replacement))
        for start, end, replacement in sorted(edits, reverse=True):
            result = result[:start] + replacement + result[end:]
        assert spans.masked(text, replacements) == spans.masked(result, replacements), 'Unrelated JSON bytes changed'
        outputs[path] = result.encode()
    # Keep every byte outside the three items blocks, including all current road widths.
    text = source[FILES[2]].decode()
    pattern = re.compile(r'(  \{ model: "[^"]+", fit: [^\n]+, items: \[\n)([\s\S]*?)(\n  \] \})')
    groups = list(pattern.finditer(text))
    assert len(groups) == len(layout['DECOR'])
    edits = []
    for i, match in enumerate(groups):
        current = layout['DECOR'][i]
        assert match.group(1).startswith(f'  {{ model: "{current["model"]}"')
        assert json.loads('[' + match.group(2) + ']') == current['items']
        if key(current) in updates:
            items = updates[key(current)]
            old_items = current['items']
            if items[:len(old_items)] == old_items:
                body = match.group(2) + ',\n' + ',\n'.join('    ' + json.dumps(p, separators=(',', ':')) for p in items[len(old_items):])
            else:
                body = ',\n'.join('    ' + json.dumps(p, separators=(',', ':')) for p in items)
            edits.append((match.start(2), match.end(2), body))
    assert len(edits) == len(updates)
    for start, end, body in reversed(edits):
        text = text[:start] + body + text[end:]
    outputs[FILES[2]] = text.encode()
    new = json.loads(outputs[FILES[1]])
    assert {k: v for k, v in new.items() if k != 'DECOR'} == {k: v for k, v in layout.items() if k != 'DECOR'}
    for before, after in zip(layout['DECOR'], new['DECOR']):
        assert {k: v for k, v in before.items() if k != 'items'} == {k: v for k, v in after.items() if k != 'items'}
        if key(before) not in updates:
            assert before == after
    STAGE.mkdir(exist_ok=True)
    for p, content in outputs.items():
        (STAGE / Path(p).name).write_bytes(content)
    report = {
        'status': 'staged-not-applied',
        'currentRevision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'handoffRevision': additions['baseRevision'],
        'currentHashes': {p: sha(b) for p, b in source.items()},
        'handoffHashes': {p: sha(b) for p, b in handoff.items()},
        'candidateHashes': {p: sha(b) for p, b in outputs.items()},
        'currentPathWidths': {p['name']: p['width'] for p in author['paths']},
        'preservedOtherJSONBytes': True,
        'preservedOtherTSBytes': True,
        'beforeInstances': sum(len(g['items']) for g in layout['DECOR']),
        'afterInstances': sum(len(g['items']) for g in new['DECOR']),
        'changes': [{'model': g['model'], 'fit': g['fit'], 'before': len(g['items']), 'after': len(updates[key(g)])} for g in layout['DECOR'] if key(g) in updates],
        'reviewRequired': 'Child native QA and visual review, then main validation on the merged candidate. Staging does not approve the preliminary handoff.'
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))

def apply():
    report = load(REPORT)
    assert report['status'] == 'staged-not-applied', 'Already applied or unreviewed stage'
    assert all(sha((ROOT / p).read_bytes()) == h for p, h in report['currentHashes'].items()), 'Shared sources changed; restage and review'
    assert all(sha((CHILD / p).read_bytes()) == h for p, h in report['handoffHashes'].items()), 'Child handoff changed; restage and review'
    assert all(sha((STAGE / Path(p).name).read_bytes()) == h for p, h in report['candidateHashes'].items()), 'Staged files changed'
    for p in FILES:
        target = ROOT / p
        assert sha(target.read_bytes()) == report['currentHashes'][p], f'Concurrent edit: {p}'
        target.write_bytes((STAGE / Path(p).name).read_bytes())
    report['status'] = 'applied'
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('Applied only the reviewed item arrays; current roads and all unrelated groups preserved.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Apply the explicitly reviewed unchanged candidate')
    args = parser.parse_args()
    apply() if args.apply else stage()
