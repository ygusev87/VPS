"""Independent static checks: exact bytes, rational topology, and monotonic clearance."""
from pathlib import Path
from fractions import Fraction
import copy
import hashlib
import json
import math
import re
import subprocess
from json_spans import spans, masked

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[2]
BASE=HERE/'baseline'
CANDIDATE=HERE/'candidate'
manifest=json.loads((HERE/'baseline-manifest.json').read_text())
patch=json.loads((HERE/'patch.json').read_text())
before=json.loads((BASE/'decor-layout.json').read_text())
after=json.loads((CANDIDATE/'decor-layout.json').read_text())
a0=json.loads((BASE/'decor-authoring.json').read_text())
a1=json.loads((CANDIDATE/'decor-authoring.json').read_text())
assert len(patch)==len(a0['paths'])==len(before['PATHS'])==len(after['PATHS'])==19
wide={'yard-spine','barn-entry','horse-yard','south-loop','shed-entry','tractor-gate'}
narrow={'kitten-lift','farmhouse-porch','garden-cross'}
for i,(p,q,change) in enumerate(zip(a0['paths'],a1['paths'],patch)):
    target=1.4 if p['name'] in wide else 1.0 if p['name'] in narrow else 1.2
    assert change=={'name':p['name'],'before':p['width'],'after':target}
    assert q=={**p,'width':target}
    assert after['PATHS'][i]=={k:v for k,v in q.items() if k!='name'}
    assert 0<target<p['width']

preservation=[]
for name,key in [('decor-authoring.json','paths'),('decor-layout.json','PATHS')]:
    b=(BASE/name).read_text();c=(CANDIDATE/name).read_text();paths=[(key,i,'width') for i in range(19)]
    assert masked(b,paths).encode()==masked(c,paths).encode(),name+' has changes outside widths'
    xb,xc=spans(b),spans(c);tokens=[]
    for path in paths:
        bs,be=xb[path];cs,ce=xc[path];tokens.append({'index':path[1],'beforeToken':b[bs:be],'afterToken':c[cs:ce]})
    preservation.append({'file':name,'status':'only-19-width-tokens-changed','unchangedOutsideWidthTokens':True,'maskedSha256':hashlib.sha256(masked(b,paths).encode()).hexdigest(),'tokens':tokens})

# Validate byte preservation in generated TypeScript, including header and every other export.
def masked_ts(source):
    start=source.index('export const PATHS:')
    end=source.index('export const FENCES:',start)
    part,n=re.subn(r'("width": )-?\d+(?:\.\d+)?',r'\1<WIDTH>',source[start:end])
    assert n==19
    return source[:start]+part+source[end:]
assert masked_ts((BASE/'farm-decor.ts').read_text()).encode()==masked_ts((CANDIDATE/'farm-decor.ts').read_text()).encode()
preservation.append({'file':'farm-decor.ts','status':'only-19-PATHS-width-tokens-changed','unchangedOutsideWidthTokens':True})
for key in before:
    if key!='PATHS':assert before[key]==after[key]
for key in a0:
    if key!='paths':assert a0[key]==a1[key]
assert sum(len(g['items']) for g in after['DECOR'])==686

# Exact center-line graph: Fraction(decimal spelling), including T-junctions and crossings.
def cross(a,b):return a[0]*b[1]-a[1]*b[0]
def sub(a,b):return a[0]-b[0],a[1]-b[1]
def rational(p):return tuple(Fraction(str(v)) for v in p)
def intersects(a,b,c,d):
    a,b,c,d=map(rational,(a,b,c,d));u,v,w=sub(b,a),sub(d,c),sub(c,a);den=cross(u,v)
    if den:
        t=cross(w,v)/den;s=cross(w,u)/den
        return 0<=t<=1 and 0<=s<=1
    return cross(w,u)==0 and all(max(min(a[k],b[k]),min(c[k],d[k]))<=min(max(a[k],b[k]),max(c[k],d[k])) for k in (0,1))
def segments(paths):
    return [(i,j,p['points'][j],b,p['width']) for i,p in enumerate(paths) for j,b in enumerate(p['points'][1:])]
def topology(paths):
    rows=segments(paths);edges=set();parents=list(range(len(paths)))
    def find(i):
        while parents[i]!=i:i=parents[i]
        return i
    for x,a in enumerate(rows):
        for b in rows[x+1:]:
            if a[0]!=b[0] and intersects(a[2],a[3],b[2],b[3]):
                edges.add(tuple(sorted((a[0],b[0]))));parents[find(a[0])]=find(b[0])
    components=len({find(i) for i in range(len(paths))})
    return {'components':components,'roadAdjacency':sorted(edges),'segments':len(rows),'pointOccurrences':sum(len(p['points']) for p in paths),'centerlineSha256':hashlib.sha256(json.dumps([p['points'] for p in paths],separators=(',',':')).encode()).hexdigest()}
g0,g1=topology(before['PATHS']),topology(after['PATHS']);assert g0==g1 and g1['components']==1

# Quantitative corroboration on every fixed DECOR center, task/pole/toy point and full fence segment.
def point_distance(p,a,b):
    u=sub(b,a);q=u[0]*u[0]+u[1]*u[1];assert q>0
    t=max(0,min(1,((p[0]-a[0])*u[0]+(p[1]-a[1])*u[1])/q))
    return math.hypot(p[0]-a[0]-t*u[0],p[1]-a[1]-t*u[1])
def segment_distance(a,b,c,d):
    if intersects(a,b,c,d):return 0.0
    return min(point_distance(a,c,d),point_distance(b,c,d),point_distance(c,a,b),point_distance(d,a,b))
s0,s1=segments(before['PATHS']),segments(after['PATHS'])
points=[('decor:'+str(i)+':'+g['model']+':'+str(j),p[:2]) for i,g in enumerate(before['DECOR']) for j,p in enumerate(g['items'])]
points += [('task:'+t['id'],t['workingPatch']['center']) for t in a0['tasks']]
points += [('pole:'+t['id'],t['pole']) for t in a0['tasks']]
points += [('toy:'+str(i),p[:2]) for i,p in enumerate(a0['toys'])]
clearances=[]
for name,p in points:
    old=min(point_distance(p,s[2],s[3])-s[4]/2 for s in s0)
    new=min(point_distance(p,s[2],s[3])-s[4]/2 for s in s1)
    assert new>=old+.2-1e-10
    clearances.append({'kind':'point','name':name,'point':p,'before':old,'after':new,'gain':new-old})
for i,line in enumerate(before['FENCES']):
    for j,b in enumerate(line[1:]):
        a=line[j];old=min(segment_distance(a,b,s[2],s[3])-s[4]/2 for s in s0);new=min(segment_distance(a,b,s[2],s[3])-s[4]/2 for s in s1)
        assert new>=old+.2-1e-10
        clearances.append({'kind':'fence-segment','name':f'fence:{i}:{j}','points':[a,b],'before':old,'after':new,'gain':new-old})
(HERE/'clearance-audit.json').write_text(json.dumps(clearances,ensure_ascii=False,indent=2)+'\n')

# The unchanged ground mask uses monotone functions of w, with round caps/joins.
ground=(BASE/'ground.ts').read_text();farm=(BASE/'farm.ts').read_text()
for text in ["g.lineCap = 'round'", "g.lineJoin = 'round'", "g.globalCompositeOperation = 'lighten'", '(w + 0.6 * k) * MASK_PX', 'Math.max(0.2, w - 0.8) * MASK_PX']:
    assert text in ground
assert "{ pts: FOX_PATH.map((q) => [q.x, q.z] as [number, number]), w: 1.1 }" in farm
stroke_widths=[]
for row in patch:
    layers=lambda w:[w+.6*k for k in range(6,0,-1)]+[w,max(.2,w-.8)]
    old,new=layers(row['before']),layers(row['after'])
    assert all(n<=o and n>0 for o,n in zip(old,new))
    stroke_widths.append({'name':row['name'],'before':old,'after':new})

run=subprocess.run(['node',str(HERE/'verify-runtime.mjs')],cwd=REPO,check=True,capture_output=True,text=True)
runtime=json.loads(run.stdout)
validators={v:json.loads((HERE/f'validation-{v}.json').read_text()) for v in ['before','after']}
assert all(v['status']=='pass' and v['instances']==686 and v['roadComponents']==1 for v in validators.values())
for f in manifest['files']:
    assert hashlib.sha256((HERE/f['snapshot']).read_bytes()).hexdigest()==f['sha256']
live_drift=[f['source'] for f in manifest['files'] if hashlib.sha256((REPO/f['source']).read_bytes()).hexdigest()!=f['sha256']]
report={'status':'pass','baselineRevision':manifest['revision'],'paths':19,'instances':686,'changesOnlyWidths':True,'bytePreservation':preservation,'topologyBefore':g0,'topologyAfter':g1,'runtimeExports':runtime,'clearance':{'samples':len(clearances),'decorCenters':686,'fullFenceSegments':sum(x['kind']=='fence-segment' for x in clearances),'minimumGain':min(x['gain'] for x in clearances),'maximumGain':max(x['gain'] for x in clearances),'fenceMinimumBefore':validators['before']['minRoadClearance'],'fenceMinimumAfter':validators['after']['minRoadClearance'],'proof':'Each unchanged centerline C has new half-width r_new <= r_old. Its round-joined/capped corridor C (+) disk(r_new) is a subset of C (+) disk(r_old). Their unions retain inclusion. Distance to any unchanged obstacle set cannot decrease. Signed distance-to-centerline minus half-width grows by 0.2..0.4 for each changed road. This proof applies to whole fixed footprints, not only sampled centers.','fixedFoxLane':'Runtime FOX_PATH at width 1.1 is unchanged. Including this fixed lane, global clearance cannot decrease but the 0.2 minimum gain is no longer universal.'},'groundMask':{'sourceUnchanged':True,'allEightPaintedStrokeWidthsNonincreasing':True,'layers':stroke_widths,'scope':'Analytic stroke support only. Pixel antialiasing, shader appearance, shoulders and gameplay readability belong to main browser QA.'},'liveBaselineDriftAtVerification':live_drift,'candidateHashes':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(CANDIDATE.iterdir())},'checksNotRun':['browser','npm tests','npm typecheck'],'limitations':['No new assertion that all old road/object overlaps are absent; this proves they cannot worsen under narrowing.','Rendered before/after and current game candidate QA are performed by main.']}
(HERE/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':report['status'],'paths':19,'instances':686,'centerlineComponents':g1['components'],'centerlineSegments':g1['segments'],'roadAdjacencyEdges':len(g1['roadAdjacency']),'clearanceSamples':len(clearances),'minGain':report['clearance']['minimumGain'],'fenceBefore':report['clearance']['fenceMinimumBefore'],'fenceAfter':report['clearance']['fenceMinimumAfter'],'liveBaselineDrift':live_drift},indent=2))
