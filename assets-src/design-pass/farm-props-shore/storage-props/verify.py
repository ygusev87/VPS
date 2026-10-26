from pathlib import Path
import json,hashlib,math
q=Path(__file__).resolve().parent
load=lambda p:json.loads((q/p).read_text())
b=load('baseline/decor-layout.json');c=load('candidate/decor-layout.json');a=load('candidate/decor-authoring.json');old=load('baseline/decor-authoring.json')
assert all(c[k]==b[k] for k in b if k!='DECOR')
assert all(a[k]==old[k] for k in old if k!='groups')
assert c['DECOR']==[{k:v for k,v in g.items() if k!='category'}for g in a['groups']if g['category']!='future-toy']
for g in b['DECOR']:
 if g['model']=='pond-reeds':continue
 matches=[t for t in c['DECOR']if t['model']==g['model']and t['fit']==g['fit']];assert len(matches)==1
 assert matches[0]['items'][:len(g['items'])]==g['items']
assert sum(len(g['items'])for g in b['DECOR'])==645
assert sum(len(g['items'])for g in c['DECOR'])==686
for g in load('forest-additions.json')['groups']:
 t=next(t for t in c['DECOR']if t['model']==g['model']and t['fit']==g['fit']);assert t['items'][-len(g['items']):]==g['items']
for m in load('models.json')['models']:
 assert hashlib.sha256((q/(m['name']+'.glb')).read_bytes()).hexdigest()==m['sha256']
 assert m['validation']['numErrors']==m['validation']['numWarnings']==0
views=[];rays=0
for width in [1180,390,1024]:
 d=load(f'qa/tasks-{width}.json');assert len(d['results'])==17 and d['addedOcclusions']==0
 assert d['viewport'][0]==width and not d['contextLost'] and not d['errors']
 assert not d['staticOverlaps'] and not d['workOverlaps'] and not d['pairOverlaps']
 assert all(i['planned']==i['accepted'] for i in d['acceptance'])
 assert all(x['minClearanceWithBodyRadius075']>0 for x in d['duckClearance'])
 for t in d['results']:rays+=t['sampledTargets']
 views.append({'viewport':d['viewport'],'tasks':17,'rays':sum(t['sampledTargets']for t in d['results']),'addedOcclusions':0})
d=load('qa/wide-1180.json');bounds=d['bounds']
def pointseg(p,a,b):
 dx,dz=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz)
def intersect(a,b,c,d):
 cross=lambda x,y:x[0]*y[1]-x[1]*y[0];sub=lambda x,y:(x[0]-y[0],x[1]-y[1]);u,v,w=sub(b,a),sub(d,c),sub(c,a);den=cross(u,v)
 if abs(den)<1e-12:return False
 return 0<=cross(w,v)/den<=1 and 0<=cross(w,u)/den<=1

def clearance(box,p,z):
 x0,z0=box['min'][0],box['min'][2];x1,z1=box['max'][0],box['max'][2];corners=[(x0,z0),(x1,z0),(x1,z1),(x0,z1)];edges=list(zip(corners,corners[1:]+corners[:1]))
 if any(x0<=t[0]<=x1 and z0<=t[1]<=z1 for t in [p,z]) or any(intersect(p,z,x,y)for x,y in edges):return 0
 return min([pointseg(t,p,z)for t in corners]+[pointseg(t,x,y)for x,y in edges for t in [p,z]])
roads=[];fences=[]
for box in bounds:
 assert box['min'][0]>=-55 and box['max'][0]<=55 and box['min'][2]>=-37.5 and box['max'][2]<=37.5
 roads.extend(clearance(box,p,z)-r['width']/2 for r in c['PATHS']for p,z in zip(r['points'],r['points'][1:]))
 fences.extend(clearance(box,p,z)-.15 for line in c['FENCES']for p,z in zip(line,line[1:]))
assert min(roads)>0 and min(fences)>0
samples=d['renderCost']['samples'];sceneShadow=max(x['triangles']for x in samples if x['shadowRefresh']and not x['aoRefresh']);full=max(x['triangles']for x in samples)
assert sceneShadow<2600000
r={'status':'pass','baselineInstances':645,'preservedNonReedInstances':642,'candidateInstances':686,'forestAdded':33,'storageAdded':4,'reedsBeforeAfter':[3,7],'preservedTerrain':[k for k in b if k!='DECOR'],'views':views,'rays':rays,'addedOcclusions':0,'nativeAcceptance':d['acceptance'],'newPropsRoadClearance':min(roads),'newPropsFenceClearance':min(fences),'duckClearanceWithBodyRadius075':min(x['minClearanceWithBodyRadius075']for x in d['duckClearance']),'sceneAndShadowsTriangles':sceneShadow,'fullFrameTriangles':full,'states':sorted(set(x['triangles']for x in samples)),'source':d['source'],'scope':'44 new or refined instances raycast together; baseline vegetation may occlude independently; FPS/iPad/PWA not measured.'}
(q/'verification.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps(r,ensure_ascii=False))
