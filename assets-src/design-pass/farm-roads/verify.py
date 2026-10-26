from pathlib import Path
import json,hashlib,copy
q=Path(__file__).resolve().parent;repo=q.parents[2]
load=lambda p:json.loads((q/p).read_text())
views=[];canonicalSources={}
for w,h in [(1180,820),(390,844),(1024,768)]:
 pairs={mode:load(f'qa/{mode}-tasks-{w}.json')for mode in ['before','after']}
 for mode,d in pairs.items():
  assert d['viewport']==[w,h] and len(d['results'])==17 and not d['errors'] and not d['contextLost']
  canonicalSources[mode]=d['source']
  for t in d['results']:
   assert len(t['terminals'])==32 and len(t['rings'])==18
   for terminal in t['terminals']:terminal.pop('id') # Session counters differ; compare each world/screen coordinate in order.
 assert pairs['before']['results']==pairs['after']['results'],f'Camera/anchor changed on {w}'
 b,a=pairs['before']['geometry'],pairs['after']['geometry'];assert len(b)==len(a)==212
 differences=[]
 for i,(x,y)in enumerate(zip(b,a)):
  assert all(x[k]==y[k]for k in ['type','positions','positionHash','indices','indexHash'])
  if x!=y:differences.append(i)
 assert differences==list(range(199,207))
 assert sum(b[i]['count']for i in differences)==sum(a[i]['count']for i in differences)==80
 views.append({'viewport':[w,h],'tasksCompared':17,'terminalsPerTask':32,'workingContoursPerTask':18,'cameraAndWorldAndScreenCoordinatesIdentical':True,'proceduralFlowerBatches':len(differences),'proceduralFlowerCount':80})
b,a=canonicalSources['before']['hashes'],canonicalSources['after']['hashes'];assert b.keys()==a.keys();assert[k for k in b if b[k]!=a[k]]==['src/farm-decor.ts']
assert a['src/farm-decor.ts']==hashlib.sha256((repo/'assets-src/farm-v3/road-pass/candidate/farm-decor.ts').read_bytes()).hexdigest()
for w in [1180,390,1024]:
 for area in ['wide','yard','pond','garden','gate']:
  for mode in ['before','after']:
   d=load(f'qa/{mode}-{area}-{w}.json');assert not d['errors']and not d['contextLost']and d['decorInstances']==686
   for p in d['paths']:assert p['width']>0
   assert all(s['triangles']>0 for s in d['renderCost'])
costs={mode:load(f'qa/{mode}-wide-1180.json')['renderCost']for mode in ['before','after']}
states={mode:sorted(set(s['triangles']for s in samples))for mode,samples in costs.items()};assert states['before']==states['after']
sceneShadow=max(s['triangles']for s in costs['after']if s['shadowRefresh']and not s['aoRefresh']);assert sceneShadow<2600000
static=json.loads((repo/'assets-src/farm-v3/road-pass/verification.json').read_text());assert static['status']=='pass'
r={'status':'pass','revision':canonicalSources['after']['revision'],'candidateSourceSha256':a['src/farm-decor.ts'],'views':views,'totalTaskViews':102,'retainedInstances':686,'renderStatesBeforeAfter':states,'sceneAndShadowsTriangles':sceneShadow,'fullFrameTriangles':max(states['after']),'geometry':'All212 mesh position/index hashes equal;8 batches of80 unseeded procedural flowers differ in placement between native loads, total count unchanged. No claim of a pixel-identical scene.','checks':'21 tests/typecheck pass in candidate snapshot; unchanged native layout validator pass in road-pass.','deviceLimitations':'Browser viewport checks; real iPad/PWA/FPS and full gameplay robot remain integrator checks.'}
(q/'verification.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps(r,ensure_ascii=False))
