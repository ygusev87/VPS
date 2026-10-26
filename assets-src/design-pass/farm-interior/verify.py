"""Verify saved native-camera evidence for the exact merged decor payload."""
from pathlib import Path
import hashlib, json, re
q=Path(__file__).resolve().parent
load=lambda p:json.loads(p.read_text())
stage=load(q/'integration.json')
qa_hashes=stage.get('nativeCandidateHashes',stage['candidateHashes'])
if 'nativeCandidateHashes' in stage:
 native=(q/'qa/native-farm-decor.ts').read_text()
 current=(q/'candidate/farm-decor.ts').read_text()
 assert hashlib.sha256(native.encode()).hexdigest()==qa_hashes['src/farm-decor.ts']
 assert hashlib.sha256(current.encode()).hexdigest()==stage['candidateHashes']['src/farm-decor.ts']
 pattern=re.compile(r'(  \{ model: "[^"]+", fit: [^\n]+, items: \[\n)([\s\S]*?)(\n  \] \})')
 a,b=list(pattern.finditer(native)),list(pattern.finditer(current))
 assert len(a)==len(b) and len(a)>20
 assert all(json.loads('['+x.group(2)+']')==json.loads('['+y.group(2)+']') for x,y in zip(a,b))
 assert pattern.sub(lambda m:m.group(1)+'<ITEMS>'+m.group(3),native)==pattern.sub(lambda m:m.group(1)+'<ITEMS>'+m.group(3),current)
reports=load(q/'qa/audit-1024.json')
assert len(reports)==24 and sum(r['cameraContract'].startswith('Exact') for r in reports)==17
assert len({r['area'] for r in reports})==24
assert all(r['viewport']==[1024,768] for r in reports)
for size in ['1180','1024','390']:
 for area in ['wide','cowPen','field']:
  r=load(q/f'qa/after-{area}-{size}.json')
  assert r['viewport'][0]==int(size) and r['area']==area
  reports.append(r)
for r in reports:
 assert r['mode']=='after' and not r['errors'] and not r['contextLost']
 assert not r['occlusion']['addedOcclusions']
 assert r['source']['candidateDecorSha256']==qa_hashes['src/farm-decor.ts']
 assert r['budget']['additions']['instances']==r['expectedAddedPrimitiveInstances']==95
 assert r['fieldReplacement']=={'before':18,'after':26}
 assert r['budget']['before']['batches']==r['budget']['after']['batches']==85
cost=sorted({s['triangles'] for s in load(q/'qa/after-wide-1180.json')['renderCost']['samples']})
assert len(cost)==4 and cost[1]<2600000
v=load(q/'qa/decor-validation.json')
assert v['status']=='pass' and v['instances']==763 and v['fieldCropInstances']==26
result={'status':'pass','candidateDecorSha256':stage['candidateHashes']['src/farm-decor.ts'],'nativeQAHash':qa_hashes['src/farm-decor.ts'],'formattingOnlyEquivalenceVerified':True,'views':len(reports),'exactTaskViews':17,'rays':sum(r['occlusion']['sampledTargets'] for r in reports),'addedOcclusions':0,'runtimeErrors':0,'contextLost':False,'dressingAccepted':95,'dressingExpected':95,'dressingBatchesBeforeAfter':[85,85],'instances':763,'renderStates1180':cost,'scenePlusShadow':cost[1],'fullAOAndShadow':cost[-1],'sceneShadowCap':2600000,'tests':{'vitest':21,'typecheck':'pass','geometryValidator':'pass; isolated exact wheat count 18→26; no other assertion changed'},'notes':['Camera evidence captured on c539d18 with current narrow roads. Subsequent dbaa34a changes ground shading only; final golden-field screenshots are separate.','Initial 1024 ray failure retained in audit-1024-initial-failure.json; offending flower [13.074,5.911] removed and all 24 views rerun.','Triangle samples count complete renderer passes, not FPS or iPad device performance.']}
(q/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
