/** Spatial preflight, or --verify-applied for the reviewed layout. Writes reports, never game sources. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const verifyApplied=process.argv.includes('--verify-applied');
const source=await fs.readFile(path.join(root,'src/city-decor.ts'),'utf8');
const layout=JSON.parse(await fs.readFile(path.join(root,'assets-src/city-v2/layout-proposal.json'),'utf8'));
if(!verifyApplied)assert.equal(createHash('sha256').update(source).digest('hex'),layout.source.decorSha256,'Source differs from proposal; use --verify-applied after approved integration.');
const currentCity=await fs.readFile(path.join(root,'src/city.ts'),'utf8');
assert.equal(createHash('sha256').update(currentCity).digest('hex'),layout.source.sha256,'Refresh gameplay anchors first');
const round=x=>Math.round(x*1000)/1000;
const rect=(x,z,w,d)=>({x0:round(x-w/2),z0:round(z-d/2),x1:round(x+w/2),z1:round(z+d/2)});
const overlap=(a,b)=>{const x=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0),z=Math.min(a.z1,b.z1)-Math.max(a.z0,b.z0);return x>1e-6&&z>1e-6?{x:round(x),z:round(z),area:round(x*z)}:null;};
const names=['grandma-house','school','club','toy-shop','fire-station','house-a','house-b','house-c'];
const buildings=[];
for(const m of source.matchAll(/\{ model: '([^']+)', fit: \{([^}]*)\}, items: (\[\[.*?\]\]) \}/g)) {
 if(!names.includes(m[1]))continue;
 const width=Number(m[2].match(/width:\s*([\d.]+)/)?.[1]);assert(width>0,'Unsupported fit');
 const exists=await fs.access(path.join(root,'public/models',m[1]+'.glb')).then(()=>true,()=>false);
 assert(!exists,'Real GLB now exists; replace placeholder estimate with decoded bounds: '+m[1]);
 const placements=JSON.parse(m[3]);
 for(const [i,[x,z,yaw,scale]] of placements.entries()){
  assert.equal(yaw,0,'Support rotated buildings before using this audit');
  const w=width*scale;
  buildings.push({id:m[1]+'-'+i,model:m[1],center:[x,z],groupFitWidth:width,scale,width:w,bodyDepth:w*.8,body:rect(x,z,w,w*.8),roofProjection:rect(x,z,w*1.5/Math.sqrt(2),w*1.5/Math.sqrt(2)),basis:'current townHouse/boxHouse placeholder; body is exact, roof is overhead projection, not ground collision'});
 }
}
assert.equal(new Set(buildings.map(b=>b.model)).size,names.length,'Building extraction incomplete');
const roads=layout.lanes.flatMap(l=>l.points.slice(1).map((p,i)=>{
 const a=l.points[i];assert(a[0]===p[0]||a[1]===p[1],'Non-axis-aligned lane needs segment/box method');
 return{id:l.id+'-'+i,box:a[0]===p[0]?rect(a[0],(a[1]+p[1])/2,l.width,Math.abs(a[1]-p[1])):rect((a[0]+p[0])/2,a[1],Math.abs(a[0]-p[0]),l.width)};
}));
function check(bs) {
 const out=[];
 for(const b of bs){
  for(const r of roads){const hit=overlap(b.body,r.box);if(hit)out.push({building:b.id,type:'body-in-road',target:r.id,overlap:hit});}
  for(const t of layout.tasks)for(const p of t.patches){const hit=overlap(b.body,rect(...p.center,...p.size));if(hit)out.push({building:b.id,type:'nominal-task-envelope',target:p.anchor,overlap:hit,note:'4x4 design reservation, not proof of device mesh collision'});}
 }
 return out;
}
const initial=check(buildings);
if (verifyApplied) {
 const proposal=JSON.parse(await fs.readFile(path.join(root,'assets-src/city-v2/building-contracts.json'),'utf8'));
 for(const b of buildings) {
  const expected=structuredClone(proposal.proposedBuildings.find(p=>p.id===b.id));
  // Browser QA: the approved footprint cleared the bell, but its ring was hidden by the roof.
  if(b.id==='toy-shop-0')expected.center=[49.75,-22.4];
  assert.deepEqual(b.center,expected.center,'Approved center differs: '+b.id);
  assert.equal(b.scale,expected.scale,'Approved scale differs: '+b.id);
  assert.equal(b.groupFitWidth,b.model==='grandma-house'?6.2:expected.groupFitWidth,'Unapproved size: '+b.id);
 }
 assert.equal(initial.length,0,'Building still occupies road or task reservation');
 const alarm=rect(...layout.anchors.ALARM_SPOT,1.7,1.5);
 assert(!overlap(buildings.find(b=>b.model==='toy-shop').roofProjection,alarm),'Shop roof covers alarm');
 const grandma=buildings.find(b=>b.model==='grandma-house');
 const deckLeft=layout.anchors.BALCONY[0]-.8;
 assert(Math.abs(grandma.body.x1-deckLeft)<1e-6,'Grandma body/deck gap remains');
 // Decode the real lite assets. A rotated full-mesh AABB is deliberately conservative:
 // leaf canopy participates, so passing also protects the much smaller trunks.
 const {NodeIO}=await import('@gltf-transform/core');
 const {ALL_EXTENSIONS}=await import('@gltf-transform/extensions');
 const {getBounds}=await import('@gltf-transform/functions');
 const {MeshoptDecoder}=await import('meshoptimizer');
 await MeshoptDecoder.ready;
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
 const cache=new Map();
 async function asset(name) {
  if(cache.has(name))return cache.get(name);
  const doc=await io.read(path.join(root,'public/models',name+'.glb'));
  const b=getBounds(doc.getRoot().listScenes()[0]);
  const data={size:b.max.map((v,i)=>v-b.min[i]),triangles:doc.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0)};
  cache.set(name,data);return data;
 }
 const edgeSource=source.slice(source.indexOf('// A small planted boundary'),source.indexOf("  { model: 'bench'"));
 const edge=[];
 for(const m of edgeSource.matchAll(/\{ model: '([^']+)', fit: \{ (height|width): ([\d.]+) \}, items: (\[\[.*?\]\]) \}/g)) {
  const a=await asset(m[1]),scale=Number(m[3])/a.size[m[2]==='height'?1:0];
  for(const [x,z,yaw,s] of JSON.parse(m[4])) {
   const w=a.size[0]*scale*s,d=a.size[2]*scale*s;
   const box=rect(x,z,Math.abs(Math.cos(yaw))*w+Math.abs(Math.sin(yaw))*d,Math.abs(Math.sin(yaw))*w+Math.abs(Math.cos(yaw))*d);
   edge.push({model:m[1],center:[x,z],box});
  }
 }
 assert.equal(edge.length,7,'Review changed planting group');
 const protectedBoxes=[...roads.map(r=>({name:r.id,box:r.box})),...layout.tasks.flatMap(t=>[...t.patches.map(p=>({name:p.anchor,box:rect(...p.center,...p.size)})),...t.poles.map(p=>({name:p.anchor,box:rect(...p.center,4,4)}))]),...buildings.map(b=>({name:b.id,box:b.body})),{name:'SUBSTATION',box:rect(...layout.anchors.SUBSTATION,4,4)}];
 for(const b of edge){
  assert(b.box.x0>=-55&&b.box.x1<=55&&b.box.z0>=-37.5&&b.box.z1<=37.5,'Canopy outside board');
  for(const p of protectedBoxes)assert(!overlap(b.box,p.box),`${b.model} overlaps ${p.name}`);
 }
 // Existing sculpted fence: same anchor math as src/decor.ts (two-unit pitch).
 const fence=await asset('fence-lite'),post=await asset('fence-post-lite');
 const fenceLines=JSON.parse(source.match(/export const FENCES[^=]*=\s*(\[[\s\S]*?\]);/)[1]);
 assert.equal(fenceLines.length,1,'Review additional fence runs');
 const [[x0,z0],[x1,z1]]=fenceLines[0];assert.equal(z0,z1);assert(x1>x0);
 const length=x1-x0,n=Math.round(length/2),sx=length/n/2,scale=.8/fence.size[1];
 const fenceBox={x0:x0+(2-fence.size[0]*scale)*sx,z0:z0-fence.size[2]*scale/2,x1:x1+post.size[0]*(.8/post.size[1])/2,z1:z1+Math.max(fence.size[2]*scale,post.size[2]*(.8/post.size[1]))/2};
 assert(fenceBox.z1<=37.5&&fenceBox.x0>=-55,'Fence outside board');
 for(const p of protectedBoxes)assert(!overlap(fenceBox,p.box),'Fence overlaps '+p.name);
 const oak=await asset('tree-oak-lite'),bush=await asset('bush-lite');
 const oldOak=await asset('tree-oak'),oldBush=await asset('bush');
 const before=10*oldOak.triangles+5*oldBush.triangles;
 const count=(name)=>[...source.matchAll(/\{ model: '([^']+)', fit: \{([^}]*)\}, items: (\[\[.*?\]\]) \}/g)].filter(m=>m[1]===name).reduce((n,m)=>n+JSON.parse(m[3]).length,0);
 const after=count('tree-oak-lite')*oak.triangles+count('bush-lite')*bush.triangles+n*fence.triangles+post.triangles;
 const report={status:'Applied m0195; static spatial checks passed, full gameplay/iPad QA pending',sources:{city:layout.source.sha256,decor:createHash('sha256').update(source).digest('hex'),baseline:'building-contracts.json at80403c5'},buildings,remaining:initial,visualCorrection:{building:'toy-shop-0',approvedCenter:[49.75,-24.2],finalCenter:[49.75,-22.4],reason:'Night QA at1180/390: roof hid the bell ring; move1.8 forward, gameplay anchors unchanged.'},grandma:{bodyRightX:grandma.body.x1,deckLeftX:deckLeft,gap:round(deckLeft-grandma.body.x1),balcony:'existing code object; new GLB must be shell-only'},edgePlanting:edge,fenceBox,geometryBudget:{beforeOakAndBushTriangles:before,afterOakBushAndFenceTriangles:after,scope:'Maximum instances before runtime avoidance; excludes all other scene geometry and render passes. Not an FPS or frame-time measurement.'},limitations:['Full AABB canopy checks against roads, task/pole envelopes, placeholder bodies and substation; existing runtime protects moving routes.','Real future building GLB bounds need a fresh audit.','Night background beyond board remains; handoff to Claude.']};
 await fs.writeFile(path.join(root,'assets-src/city-v2/building-integration-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({buildings:buildings.length,conflicts:initial.length,grandma:report.grandma,edgePlants:edge.length,geometryBudget:report.geometryBudget}));
 process.exit(0);
}

const changes=[
 {id:'house-a-2',center:[-50,32.2],scale:1,reason:'Keep body and placeholder roof clear of tram corridor.'},
 {id:'house-c-2',center:[50,32.2],scale:1,reason:'Keep body and placeholder roof clear of tram corridor.'},
 {id:'house-b-1',center:[-5.75,-33],scale:.9,reason:'Clear north road without moving the street or bakery.'},
 {id:'toy-shop-0',center:[49.75,-24.2],scale:.9,reason:'Leave the alarm plate and raccoon alley open, keep actor/slot anchors unchanged.'},
 {id:'house-a-3',center:[14.5,21],scale:1,reason:'Increase gap to LIGHT_POLE base from0.05 to0.55 world units.'},
];
const proposed=buildings.map(b=>{const c=changes.find(x=>x.id===b.id);if(!c)return b;const w=b.groupFitWidth*c.scale;return{...b,center:c.center,scale:c.scale,width:w,bodyDepth:w*.8,body:rect(...c.center,w,w*.8),roofProjection:rect(...c.center,w*1.5/Math.sqrt(2),w*1.5/Math.sqrt(2))};});
for(const b of proposed)assert(b.body.x0>=-55&&b.body.x1<=55&&b.body.z0>=-37.5&&b.body.z1<=37.5,'Proposed building outside board');
const after=check(proposed);
assert.equal(after.filter(x=>x.type==='body-in-road').length,0,'Proposed road overlap remains');
const shop=buildings.find(b=>b.model==='toy-shop');
const alarm=rect(...layout.anchors.ALARM_SPOT,1.7,1.5);
const alarmOverlap=overlap(shop.body,alarm);
assert(alarmOverlap&&alarmOverlap.z>.6,'Expected current physical alarm overlap changed; re-check source');
assert(!overlap(proposed.find(b=>b.model==='toy-shop').roofProjection,alarm),'Proposed shop roof hides alarm');
const report={
 status:'proposal only; no city-decor.ts or gameplay edits; building mesh QA pending',
 sources:{city:layout.source.sha256,decor:layout.source.decorSha256,placeholder:'src/city.ts townHouse() and src/storymap.ts boxHouse()',alarmBase:'src/parts/chain.ts Bell: basePlate(1.7,1.5)'},
 excluded:['bakery: already a real GLB, this pass addresses missing building placeholders only','Full 3D intersections, actual future GLB bounds, roof-over-person height separation and device motion not tested'],
 current:buildings,findings:initial,
 actualDeviceFinding:{building:shop.id,device:'ALARM_SPOT bell base',base:alarm,overlap:alarmOverlap,note:'Axis-aligned footprint intersection with existing toy-shop body; bell physical plate dimensions from source, not the4x4 design margin.'},
 proposedChanges:changes,proposedBuildings:proposed,remainingDesignReservations:after,
 summary:{missingBuildingKinds:names.length,placements:buildings.length,currentRoadBodyOverlaps:initial.filter(x=>x.type==='body-in-road').length,proposedRoadBodyOverlaps:after.filter(x=>x.type==='body-in-road').length,currentTaskReservations:initial.filter(x=>x.type==='nominal-task-envelope').length,proposedTaskReservations:after.filter(x=>x.type==='nominal-task-envelope').length},
 grandmaInterface:{houseCenter:[-44,-27],fitWidth:6,estimatedBodyRightX:-41,balconyCenter:layout.anchors.BALCONY,deckSize:[1.6,.14,1.3],deckTopY:1.95,deckLeftX:-40.9,currentBodyToDeckGap:.1,grandma:layout.anchors.GRANDMA,lift:layout.anchors.LIFT_SPOT,rule:'Current code always adds balcony(BALCONY). Do not bake a second balcony into grandma-house GLB without explicit integration change. model() fits and recenters the entire bounding box, including attachments.',proposal:'House shell without balcony plus a separate authored balcony asset at the fixed BALCONY anchor; alternatively agree on full assembly fit and suppress the code balcony. A replacement deck can extend left to overlap the facade while all gameplay anchors stay fixed.'},
 assetLimits:{status:'targets, not claimed achieved',mainBuildingsTriangles:8000,repeatHousesTriangles:5000,colorMapPixels:512,materials:1,sourceFront:'+X',integrationRotateY:-Math.PI/2,fullBoundsInclude:'roof eaves, sill boxes, porch, chimney; no baked plants/characters/work devices'},
};
await fs.writeFile(path.join(root,'assets-src/city-v2/building-contracts.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({summary:report.summary,actualAlarmOverlap:alarmOverlap,remaining:after}));
