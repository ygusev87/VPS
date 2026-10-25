from pathlib import Path
import json, math, random

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets-src/farm-v3'
tasks=json.loads((OUT/'layout-proposal.json').read_text())['tasks']
# m0120: mechanical anchors supersede the initial concept proposal.
updates={'gateStuck':([28.3,17.4],[26,13.5]),'foxTip':([-34,-10],[-35.5,-7.5]),
 'ducksAsk':([-30.5,5.5],[-27,9.5]),'kittenStuck':([-19,-16],[-23.5,-12.5]),
 'puppyAsk':([-23,-8],[-23.5,-12.5]),'pigThirsty':([27,-13],[21.5,-13.5]),
 'eggsCold':([16,-14],[21.5,-13.5]),'geeseDark':([-31,15.5],[-26.5,14.5]),
 'horseHot':([39,13],[34.5,13.5]),'henDark':([7,-15],[2.5,-15]),
 'roosterAsk':([-1,-10],[-5.5,-10])}
for task in tasks:
    if task['id'] in updates:task['workingPatch']['center'],task['pole']=updates[task['id']]
fox=[[-27,-37],[-27.5,-29],[-29.5,-19],[-32.5,-12.5],[-34,-10],[-38,-10],[-39.5,-10.8]]
toys=[[-7.5,-18.5],[-1.5,-3.2],[8.3,25.2],[-32.5,-21.6],[-34.6,8.4]]
travel=[fox,[[-23,-8.15],[-8,-8.15]],[[30,12],[29,26.5]]]
rng=random.Random(25102503)
paths=[]
def lane(name,points,width=1.8): paths.append({'name':name,'points':points,'width':width})
lane('yard-spine',[[-38.5,-19],[-29,-19],[-29,-12],[-8,-12],[-8,-9],[32,-9],[32,13],[-28,13],[-28,-4],[-47,-4]],2.0)
lane('barn-entry',[[-29,-19],[-16,-19],[-16,-20.8]],1.8)
lane('kitten-lift',[[-19,-19],[-19,-16]],1.6)
lane('farmhouse-porch',[[-38.5,-19],[-38.5,-21]],1.8)
lane('rabbit-entry',[[-43,-4],[-43,-12.5]],1.6)
lane('dog-entry',[[-34,-4],[-34,-11],[-38.5,-13.8]],1.6)
lane('hen-entry',[[7,-9],[7,-19.4]],1.6)
lane('nest-entry',[[7,-12],[16,-12],[16,-14]],1.8)
lane('pig-entry',[[27,-9],[27,-21.8]],1.6)
lane('hill-entry',[[32,-9],[38,-14],[44,-17],[44,-22]],1.8)
lane('horse-yard',[[32,13],[36,13],[36,18],[39,18],[39,13],[42,7],[42,2.5]],1.8)
lane('courtyard',[[-8,-9],[-8.5,-2],[-8.5,10],[0,13]],1.8)
lane('south-loop',[[-28,13],[-28,35.5],[36,35.5],[36,13],[32,13]],1.8)
lane('orchard-entry',[[-28,25],[-36,25]],1.6)
lane('apiary-entry',[[-20,13],[-20,23]],1.6)
lane('garden-north',[[3,13],[3,26],[-1,26]],1.6)
lane('garden-cross',[[3,26],[15,26]],1.4)
lane('garden-south',[[11,26],[11,35.5]],1.6)
lane('shed-entry',[[36,28],[38,28]],1.8)
lane('tractor-gate',[[30,13],[30,21]],1.8)

def point_segment(p,a,b):
    dx=b[0]-a[0]; dz=b[1]-a[1]; q=dx*dx+dz*dz
    t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/q)) if q else 0
    return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz)
def road_distance(p):
    return min(point_segment(p,a,b)-q['width']/2 for q in paths for a,b in zip(q['points'],q['points'][1:]))

# Rectangles are yards, not building footprints. Gate gaps include the full road width.
pens=[
 {'name':'rabbit','rect':[-50.5,-18,-40.7,-6],'gates':{'S':[(-43,4.8)]}},
 {'name':'dog','rect':[-40.7,-18.5,-29.8,-6],'gates':{'S':[(-34,4.8)]},'omit':['W']},
 {'name':'chickens','rect':[-4,-29.5,18,-10.8],'gates':{'S':[(-1,6),(7,4.8)]}},
 {'name':'pigs','rect':[18,-21,36,-11],'gates':{'N':[(27,5)],'S':[(27,5)]}},
 {'name':'hill','rect':[36,-34,51,-18],'gates':{'S':[(44,5.2)]}},
 {'name':'goats','rect':[-22,-5,-10,10],'gates':{'S':[(-15,5)],'W':[(5,4.8)]}},
 {'name':'cows','rect':[1,-7,28,10],'gates':{'S':[(10,4.8),(20,4.8)]}},
 {'name':'horses','rect':[35,3.5,49,16],'gates':{'N':[(42,10)],'S':[(39,5)]}},
 {'name':'orchard','rect':[-49,19,-31,33],'gates':{'E':[(25,4.6)]}},
 {'name':'apiary','rect':[-24,20,-9,31],'gates':{'N':[(-20,4.8)]}},
 {'name':'garden','rect':[-5,19,20,33],'gates':{'N':[(3,3.2)],'S':[(11,3.2)]}},
 # Gate posts are x=28.4/31.6, z=16.4 (root 30,17 plus local z=-.6).
 {'name':'tractor-field','rect':[22,16.4,34,33],'gates':{'N':[(30,3.4)]}},
]
fences=[]; cuts=[]
for pen in pens:
    x0,z0,x1,z1=pen['rect']
    sides={'N':([x0,z0],[x1,z0]),'E':([x1,z0],[x1,z1]),'S':([x1,z1],[x0,z1]),'W':([x0,z1],[x0,z0])}
    for side,(a,b) in sides.items():
        if side in pen.get('omit',[]):continue
        length=math.dist(a,b);count=math.ceil(length/.04)
        def point(t):return [a[k]+(b[k]-a[k])*t for k in (0,1)]
        def allowed(t):
            p=point(t);value=p[0] if side in ('N','S') else p[1]
            if any(abs(value-center)<width/2+.04 for center,width in pen['gates'].get(side,[])):return False
            # Additional automatic cuts are reported; no lane may run into a closed fence.
            if any(point_segment(p,c,d)<1.0 for c,d in zip(fox,fox[1:])):return False
            # The active gate itself is the deliberate exception to the working square.
            if any(t['id']!='gateStuck' and abs(p[0]-t['workingPatch']['center'][0])<2.15 and abs(p[1]-t['workingPatch']['center'][1])<2.15 for t in tasks):return False
            if any(math.dist(p,t['pole'])<1.15 for t in tasks):return False
            return road_distance(p)>.4
        start=None
        for i in range(count+1):
            ok=allowed(i/count)
            if ok and start is None:start=min(1,(i+.6)/count)
            if (not ok or i==count) and start is not None:
                end=max(0,(i-.6)/count)
                if (end-start)*length>.55:
                    run=[[round(v,3) for v in point(start)],[round(v,3) for v in point(end)]]
                    # Preserve authored corners (avoid a tiny gap between adjoining sides).
                    if start<1.7/count:run[0]=a
                    if i==count and allowed(1):run[1]=b
                    fences.append(run);cuts.append({'pen':pen['name'],'side':side,'line':run})
                start=None

soil=[]
for x0 in [-4,4,12]:
    for z0 in [20,27]:soil.append({'x0':x0,'z0':z0,'x1':x0+6,'z1':z0+5})
soil.append({'x0':24,'z0':21,'x1':33.5,'z1':31})
mud=[{'x':28,'z':-17.1,'rx':5.6,'rz':3.3}]
meadow=[{'x':43,'z':-27,'rx':8,'rz':7},{'x':14,'z':1,'rx':14,'rz':9},{'x':-16,'z':2,'rx':6,'rz':8}]
ponds=[{'x':-40,'z':3.5,'rx':7.5,'rz':5}]

groups=[]; skipped=[]
def add(model,fit,items,category='prop'):
    groups.append({'model':model,'fit':fit,'items':[[round(v,3) for v in p] for p in items],'category':category})
turn=-math.pi/2
add('barn',{'width':10.5,'rotateY':turn},[[-16,-27,0,1]],'building')
add('coop',{'width':4.6,'rotateY':turn},[[8,-23.5,0,1]],'building')
add('stable',{'width':10,'rotateY':turn},[[42,-4,0,1]],'building')
add('doghouse',{'width':3,'rotateY':turn},[[-38.5,-16.5,0,1]],'building')
add('hutch',{'width':3,'rotateY':turn},[[-44,-14.5,0,1]],'building')
# Missing models are deliberate slots; integration skips missing files without boxes.
add('farmhouse',{'width':11,'rotateY':turn},[[-38.5,-25.5,0,1]],'future')
add('silo',{'height':12},[[-5,-27,0,1]],'future')
add('pigsty',{'width':10,'rotateY':turn},[[27,-25,0,1]],'future')
add('tractor-shed',{'width':10,'rotateY':math.pi},[[43,26,0,1]],'future')
add('well',{'width':2.8},[[-1.5,-3.2,0,1]],'future-toy')
add('beehive',{'height':1.7},[[-15,25,.2,1],[-20,28,-.1,.95]],'prop')
add('haystack',{'width':2.8},[[-24,-25,.3,1],[-24,-22,-.15,.8],[-7,-22,.1,.9],[46,21,.5,1],[46,30,-.4,.85],[39,-30,.2,.7]],'prop')
add('sack',{'height':1.25},[[-22.7,-23,.3,1],[-22.6,-24.5,-.2,.95],[-22,-24.8,.1,.85]],'prop')
add('cow',{'height':1.65},[[6,-3,-.3,1],[20,-3,-2,.94],[24,5,2.8,1.02]],'herd')
add('sheep',{'height':1.2},[[41,-28,-.2,1],[46,-30,1.2,.92]],'herd')
add('pig',{'height':1.2},[[24,-18,-.4,1],[32,-16,2.1,.85]],'herd')
add('hen',{'height':.7},[[4,-17,1.3,1],[10,-17,-.7,.9],[12,-13,2.1,.92]],'herd')
add('horse',{'height':1.8},[[45,8,-1.9,.97]],'herd')
add('goat',{'height':1.2},[[-18,-2,-.6,.9]],'herd')
add('goose',{'height':.85},[[-35,14,1.2,1],[-37,12,-.2,.9]],'herd')

def clear(p,radius):
    x,z=p
    for t in tasks:
        px,pz=t['workingPatch']['center']
        if abs(x-px)<2+radius+.25 and abs(z-pz)<2+radius+.25:return False
        if math.dist(p,t['pole'])<1.4+radius:return False
    if any(math.dist(p,q)<radius+1.15 for q in toys):return False
    if road_distance(p)<radius+.3:return False
    if any(point_segment(p,a,b)<radius+1.1 for line in travel for a,b in zip(line,line[1:])):return False
    for e in ponds:
        if ((x-e['x'])/(e['rx']+radius+.35))**2+((z-e['z'])/(e['rz']+radius+.35))**2<1:return False
    # Authored buildings and future buildings retain their full footprint.
    for cx,cz,w,d in [(-16,-27,10.5,11.686),(8,-23.5,4.6,7.682),(42,-4,10,12.75),(-38.5,-25.5,11,9),(-5,-27,5,5),(27,-25,10,6),(43,26,10,10)]:
        if abs(x-cx)<w/2+radius+.35 and abs(z-cz)<d/2+radius+.35:return False
    return True

# Forest is authored as layered border belts, not random trees across activity yards.
pine=[];oak=[]
for i in range(29):
    x=-51.5+i*3.65;z=-35.5+(i%3)*.18
    if clear([x,z],1.6):pine.append([x,z,rng.uniform(-math.pi,math.pi),rng.uniform(.88,1.09)])
for xbase in [-53,53]:
    for i,z in enumerate([-30,-24,-1,5,11,17,23,29,33]):
        x=xbase+rng.uniform(-.35,.35)
        if clear([x,z],1.6):pine.append([x,z,rng.uniform(-math.pi,math.pi),rng.uniform(.8,1.05)])
for x,z in [(-49,-30),(-29,-29),(-28,-24),(-8,-34),(3,-33),(18,-31),(34,-30),(50,-26),(-51,1),(-52,13),(-52,20),(52,5),(52,11),(51,31)]:
    if clear([x,z],1.3):oak.append([x,z,rng.uniform(-math.pi,math.pi),rng.uniform(.8,1.1)])
add('tree-oak-lite',{'height':5.2},oak,'forest')
oak=[]
# Orchard: regular rows are intentional; reuse oak until an apple variant is available.
for x in [-46,-39]:
    for z in [22,29]:oak.append([x,z,.25 if z==22 else -.3,.82])
add('tree-pine-lite',{'height':6.2},pine,'forest')
add('tree-oak',{'height':5.2},oak,'forest')

bush=[];flowers=[];rocks=[]
# Borders follow existing fence runs. Leave real openings clear, especially at gates.
for row in cuts:
    a,b=row['line'];length=math.dist(a,b);steps=max(1,int(length/3.2))
    for k in range(1,steps):
        t=k/steps;p=[a[j]+(b[j]-a[j])*t for j in (0,1)]
        # Thin hedge follows the fence, with a little irregularity in size, not location.
        if clear(p,.65):bush.append([*p,-math.atan2(b[1]-a[1],b[0]-a[0]),rng.uniform(.65,.9)])
        fp=[p[0]+.65,p[1]+.65]
        if clear(fp,.45):flowers.append([*fp,rng.uniform(-math.pi,math.pi),rng.uniform(.75,1.1)])
for x,z in [(-51,-32),(-29,-33),(14,-33),(32,-33),(51,-31),(-51,14),(-51,31),(-34,33),(50,30),(51,8),(-49,10),(-47,-1),(-33,2)]:
    if clear([x,z],.9):rocks.append([x,z,rng.uniform(-math.pi,math.pi),rng.uniform(.65,1)])
for x,z in [(-23,26),(-22,28),(-12,24),(-12,27),(-16,29),(-47,-22),(-45,-22),(-3,-23),(1,-23)]:
    if clear([x,z],.4):flowers.append([x,z,rng.uniform(-math.pi,math.pi),1.1])
add('bush-lite',{'width':2.3},bush,'planting')
# Preserve the sculpted petals; thin the repeated border clumps instead of damaging them.
flowers=[p for i,p in enumerate(flowers) if i%2==0 or p[3]==1.1]
add('flower-cluster',{'height':.5},flowers,'planting')
add('rock-cluster',{'width':2.6},rocks,'prop')

# Future 2-unit planted-row modules: three rows per 6x5 garden bed, already spaced.
crop_names=['crop-wheat','crop-lavender','crop-carrot','crop-sunflower','crop-tomato','crop-cabbage']
for name,bed in zip(crop_names,soil[:6]):
    items=[]
    for x in [bed['x0']+1,bed['x0']+3,bed['x0']+5]:
        for z in [bed['z0']+1.3,bed['z0']+3.7]:items.append([x,z,0,1])
    add(name,{'width':1.8},items,'future-crop')
add('crop-wheat',{'width':1.8},[[x,z,0,1] for x in [25,27.3,29.6,32] for z in [22.2,24.7,27.2,29.7]],'future-crop')

# Future groups stay in authoring only. Missing crop groups would suppress the
# integration's wheat fallback even when no GLB can be loaded (m0121).
payload={'DECOR':[{k:v for k,v in g.items() if k!='category'} for g in groups if g['category']!='future-toy' and (ROOT/'public/models'/f"{g['model']}.glb").exists()],
 'PATHS':[{k:v for k,v in p.items() if k!='name'} for p in paths],
 'FENCES':fences,'SOIL':soil,'MUD':mud,'MEADOW':meadow,'PONDS':ponds}
comments={g['model']:g['category'] for g in groups}
header="""// Farm v3: authored placement data for the 110 x 75 board; +x east, +z south.
// Contract agreed with Claude in m0117. No scene construction or gameplay here.
// Existing models are reused; missing future models must be skipped, never boxed in.
// Source/provenance and independent layout checks: assets-src/farm-v3/.
import type { Fit } from './parts/assets';

/** x, z, yaw around y in radians, uniform multiplier applied after fit. */
export type Place = [number, number, number, number];
export interface DecorGroup { model: string; fit: Fit; items: Place[] }

"""
types={'DECOR':'DecorGroup[]','PATHS':'{ points: [number, number][]; width: number }[]','FENCES':'[number, number][][]','SOIL':'{ x0: number; z0: number; x1: number; z1: number }[]','MUD':'{ x: number; z: number; rx: number; rz: number }[]','MEADOW':'{ x: number; z: number; rx: number; rz: number }[]','PONDS':'{ x: number; z: number; rx: number; rz: number }[]'}
def compact(value):return json.dumps(value,ensure_ascii=False,separators=(', ', ': '))
def literal(name,value):
    if name=='DECOR':
        return '[\n'+',\n'.join('  { model: '+compact(g['model'])+', fit: '+compact(g['fit'])+', items: [\n'+',\n'.join('    '+compact(p) for p in g['items'])+'\n  ] }' for g in value)+'\n]'
    return '[\n'+',\n'.join('  '+compact(row) for row in value)+'\n]'
source=header+'\n\n'.join('export const '+name+': '+types[name]+' = '+literal(name,value)+';' for name,value in payload.items())+'\n'
(ROOT/'src/farm-decor.ts').write_text(source)
(OUT/'decor-layout.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
(OUT/'decor-authoring.json').write_text(json.dumps({'seed':25102503,'anchorsSource':'Claude m0120; farm.ts mechanical constants','tasks':tasks,'toys':toys,'travel':travel,'paths':paths,'pens':pens,'fenceRuns':cuts,'groups':groups},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'groups':len(groups),'instances':sum(len(g['items']) for g in groups),'paths':len(paths),'fenceRuns':len(fences),'forest':sum(len(g['items']) for g in groups if g['model'].startswith('tree-'))}))
