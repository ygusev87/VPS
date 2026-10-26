// Candidate mask rectangles, not new meshes. Geometry/task anchors come from current source.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {getBounds} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {Box3,Matrix4,Vector3} from 'three';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../../..');
const city=await fs.readFile(root+'/src/city.ts'),decor=await fs.readFile(root+'/src/city-decor.ts');
const sha=b=>createHash('sha256').update(b).digest('hex');
const layout=JSON.parse(await fs.readFile(root+'/assets-src/city-v2/layout-proposal.json'));
if(layout.source.sha256!==sha(city))throw Error('Refresh build-layout.mjs first');
const {DECOR,SOIL}=await import(root+'/src/city-decor.ts');
// Two pre-existing lawns are locked; generated additions must not be consumed on a second run.
const locked=SOIL.slice(0,2);
const rect=(x,z,w,d)=>({x0:x-w/2,z0:z-d/2,x1:x+w/2,z1:z+d/2});
const box=(id,a)=>({id,x0:a[0],z0:a[1],x1:a[2],z1:a[3]});
const regions=[
 ['west-edge',[-54,-36.2,-48,24]],['northwest',[-48,-36.2,-24.5,-16.2]],
 ['bakery-gardens',[-24.5,-36.2,-4.5,-16.2]],['school-gardens',[4.5,-36.2,33.8,-16.2]],
 ['east-north',[40.2,-36.2,54,-3.8]],['parking-edge',[-48,-16.2,-24.5,-3.8]],
 ['west-courts',[-48,3.8,-24.5,24]],['southwest-inner',[-22.5,16.2,-4.5,24]],
 ['southeast-inner',[4.5,16.2,33.8,24]],['east-south',[40.2,3.8,54,24]],
 ['southwest',[-54,30,-4.5,36.5]],['southeast',[4.5,30,54,36.5]]
].map(([id,a])=>box(id,a));
const exclusions=locked.map((r,i)=>({...r,id:'existing-lawn-'+i}));
const segmentBox=(a,b,r)=>({x0:Math.min(a[0],b[0])-r,z0:Math.min(a[1],b[1])-r,x1:Math.max(a[0],b[0])+r,z1:Math.max(a[1],b[1])+r});
for(const l of layout.lanes)for(let i=1;i<l.points.length;i++)exclusions.push({...segmentBox(l.points[i-1],l.points[i],l.width/2+.8),id:'road-'+l.id+'-'+i});
for(const t of layout.tasks){for(const p of t.patches)exclusions.push({...rect(...p.center,4.8,4.8),id:p.anchor});for(const p of t.poles)exclusions.push({...rect(...p.center,4.8,4.8),id:p.anchor});}
for(const name of ['SUBSTATION','BUILDER','BAKER','SHOPKEEPER','BASKET','BURNING'])exclusions.push({...rect(...layout.anchors[name],name==='SUBSTATION'||name==='BURNING'?6:2.6,name==='SUBSTATION'||name==='BURNING'?6:2.6),id:name});
for(const route of layout.protectedRoutes)for(let i=1;i<route.points.length;i++)exclusions.push({...segmentBox(route.points[i-1],route.points[i],route.name==='SCHOOL_BEAM'?1:1.5),id:route.name+'-'+i});
const c=layout.canal,h=layout.harbor;
exclusions.push({id:'canal-bank',x0:c.x-c.w/2-.8,x1:c.x+c.w/2+.8,z0:c.z0,z1:c.z1+.8},{id:'harbour-bank',...rect(h.x,h.z,(h.rx+.8)*2,(h.rz+.8)*2)});
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const skip=new Set(['tree-oak-lite','tree-pine-lite','bush-lite','flower-cluster','bench']);
const buildings=[];
for(const g of DECOR.filter(g=>!skip.has(g.model))){
 const file=root+'/public/models/'+g.model+'.glb';const doc=await io.read(file),bounds=getBounds(doc.getRoot().listScenes()[0]);
 const corners=[];for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]])corners.push(new Vector3(x,y,z).applyMatrix4(new Matrix4().makeRotationY(g.fit.rotateY??0)));
 const b=new Box3().setFromPoints(corners),s=b.getSize(new Vector3()),center=b.getCenter(new Vector3());const scale=g.fit.width?g.fit.width/s.x:g.fit.depth?g.fit.depth/s.z:g.fit.height?g.fit.height/s.y:1;
 for(const [i,p] of g.items.entries()){
 const points=corners.map(v=>v.clone().sub(new Vector3(center.x,b.min.y,center.z)).multiplyScalar(scale*p[3]).applyMatrix4(new Matrix4().makeRotationY(p[2])).add(new Vector3(p[0],0,p[1])));
 const a=new Box3().setFromPoints(points),r={id:g.model+'-'+i,x0:a.min.x-.85,z0:a.min.z-.85,x1:a.max.x+.85,z1:a.max.z+.85};
 buildings.push({...r,center:[p[0],p[1]],model:g.model});exclusions.push(r);
 // Paved front approach, including the porch: northern row faces south, southern row north.
 if(p[1]<-16&&p[0]<34)exclusions.push({id:r.id+'-approach',x0:p[0]-1.1,x1:p[0]+1.1,z0:a.max.z,z1:-15});
 if(p[1]>29)exclusions.push({id:r.id+'-approach',x0:p[0]-1.1,x1:p[0]+1.1,z0:29,z1:a.min.z});
 }
}
const overlap=(a,b)=>Math.min(a.x1,b.x1)>Math.max(a.x0,b.x0)+1e-8&&Math.min(a.z1,b.z1)>Math.max(a.z0,b.z0)+1e-8;
function cut(a,b){if(!overlap(a,b))return [a];const x0=Math.max(a.x0,b.x0),x1=Math.min(a.x1,b.x1),z0=Math.max(a.z0,b.z0),z1=Math.min(a.z1,b.z1);return [{...a,x1:x0},{...a,x0:x1},{...a,x0,x1,z1:z0},{...a,x0,x1,z0:z1}].filter(r=>r.x1-r.x0>1e-8&&r.z1-r.z0>1e-8);}
// Claude city mask grows the union outward by0.5; reserve0.55 more before cutting.
for(const r of exclusions){r.x0-=.55;r.z0-=.55;r.x1+=.55;r.z1+=.55;}
let patches=regions.flatMap(r=>exclusions.filter(e=>e.x1>e.x0&&e.z1>e.z0).reduce((parts,e)=>parts.flatMap(a=>cut(a,e)),[r]));
patches=patches.filter(r=>r.x1-r.x0>=2.5&&r.z1-r.z0>=2.5&&(r.x1-r.x0)*(r.z1-r.z0)>=4).map((r,i)=>({...r,id:r.id+'-'+i}));
for(const r of patches){if(r.x0< -55||r.x1>55||r.z0< -37.5||r.z1>37.5)throw Error('Outside board');for(const e of exclusions)if(overlap(r,e))throw Error(r.id+' touches '+e.id);}
for(let i=0;i<patches.length;i++)for(let j=i+1;j<patches.length;j++)if(overlap(patches[i],patches[j]))throw Error('Overlapping patches');
const round=v=>Math.round(v*1e5)/1e5;
const soil=[...locked,...patches.map(({x0,z0,x1,z1})=>({x0:Math.ceil(x0*1e5)/1e5,z0:Math.ceil(z0*1e5)/1e5,x1:Math.floor(x1*1e5)/1e5,z1:Math.floor(z1*1e5)/1e5}))];
const area=r=>(r.x1-r.x0)*(r.z1-r.z0);
const report={status:'candidate ground-mask data; no vegetation or gameplay changes',source:{citySha256:sha(city),decorSha256:sha(decor)},locked,regions,patches,SOIL:soil,exclusions,buildings,lanes:layout.lanes,canal:c,harbor:h,checks:{newRectangles:patches.length,oldArea:locked.reduce((n,r)=>n+area(r),0),addedArea:patches.reduce((n,r)=>n+area(r),0),protectedExclusions:exclusions.length,maskExpansionAllowance:.55,overlaps:0,scope:'Conservative 2D bounds including real building GLBs, task/pole pads and route AABBs; not a rendered gameplay/FPS check.'}};
await fs.writeFile(dir+'/lawns.json',JSON.stringify(report,null,2)+'\n');
await fs.writeFile(dir+'/lawns.ts.txt','export const SOIL: Rect[] = [\n'+soil.map(r=>'  { '+Object.entries(r).map(([k,v])=>k+': '+v).join(', ')+' },').join('\n')+'\n];\n');
console.log(JSON.stringify(report.checks));
