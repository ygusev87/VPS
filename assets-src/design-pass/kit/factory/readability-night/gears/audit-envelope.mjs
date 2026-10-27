// Read-only source/GLB audit. Writes only the adjacent contract; never generates a model.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../../../../../..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const sources={};
for(const f of ['src/parts/factory.ts','src/parts/mech.ts','src/parts/workshop.ts','src/parts/kit.ts']) sources[f]=await fs.readFile(path.join(root,f),'utf8');
function extract(file,name){const s=sources[file],a=s.indexOf('function '+name+'('),b=s.indexOf('\n}',a)+2;if(a<0||b<2)throw Error('Function not found');return s.slice(a,b).replace(/: number|: string|: THREE\.BufferGeometry|: THREE\.Group/g,'');}
// Evaluate only the two repository-owned geometry factories; rendering helpers are geometry-equivalent.
const geom=new Function('THREE',extract('src/parts/mech.ts','gearGeometry')+';return gearGeometry;')(T);
const factory=new Function('THREE','C','mesh','mat','gearGeometry',extract('src/parts/factory.ts','gearMesh')+';return gearMesh;')(T,{metal:'#888888',navy2:'#333344'},(g,m)=>new T.Mesh(g,m),()=>new T.MeshBasicMaterial(),geom);
const items=[];
for(const [kind,r] of [['smallGear',.4],['gear',.6],['bigGear',1]]){
 const g=factory(r,'#888888');g.updateMatrixWorld(true);
 const parts=g.children.map((m,i)=>{let min=Infinity,max=-Infinity,radius=0;const a=m.geometry.attributes.position,p=new T.Vector3();for(let j=0;j<a.count;j++){p.fromBufferAttribute(a,j).applyMatrix4(m.matrixWorld);min=Math.min(min,p.y);max=Math.max(max,p.y);radius=Math.max(radius,Math.hypot(p.x,p.z));}return {name:i<3?'spoke'+i:i===3?'rim':'hub',radius,y:[min,max]};});
 const box=new T.Box3().setFromObject(g);
 items.push({kind,logicalRadius:r,teeth:Math.round(r*14),parts,phaseZeroBounds:{min:box.min.toArray(),max:box.max.toArray()},fullRotationRadius:Math.max(...parts.map(p=>p.radius)),replacementLimits:{rim:{radius:r,y:[-.069,.069]},upperSpokes:{radius:r*.7,y:[.069,.084]},hub:{radius:r*.3-.001,y:[-.099,.099]}},note:'Contract limits intentionally inside current swept component cylinders; exact triangle acceptance must split across Y slabs. Single bounding box containment is insufficient.'});
}
function clip(poly,axis,value,sign){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-value)*sign,db=(b[axis]-value)*sign;if(da>=0)out.push(a);if((da>=0)!=(db>=0))out.push(a.clone().lerp(b,da/(da-db)));}return out;}
function radialDistance(poly,c){let best=Infinity,pos=false,neg=false;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],x=a.x-c[0],z=a.z-c[1],xx=b.x-c[0],zz=b.z-c[1],dx=xx-x,dz=zz-z,t=T.MathUtils.clamp(-(x*dx+z*dz)/(dx*dx+dz*dz||1),0,1);best=Math.min(best,Math.hypot(x+t*dx,z+t*dz));const cross=x*zz-z*xx;if(cross>1e-10)pos=true;if(cross< -1e-10)neg=true;}return pos!==neg?0:best;}
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const cases=[{id:'shaft-motor',width:1.1,at:[0,.16,-.1],axis:[0,.51,-.35],gears:['smallGear','bigGear']},{id:'lathe',width:2.6,at:[.1,.16,.2],axis:[-1.1,.51,-.45],gears:['bigGear']},{id:'grinder',width:2.6,at:[.1,.16,.2],axis:[-1.1,.51,-.45],gears:['smallGear']}];
const checks=[];
for(const c of cases){
 const bytes=await fs.readFile(path.join(root,'public/models',c.id+'.glb')),doc=await io.readBinary(bytes),dr=doc.getRoot(),b=getBounds(dr.listScenes()[0]),scale=c.width/(b.max[0]-b.min[0]),offset=new T.Vector3(-(b.min[0]+b.max[0])/2,-b.min[1],-(b.min[2]+b.max[2])/2),triangles=[];
 for(const node of dr.listNodes())for(const prim of node.getMesh()?.listPrimitives()??[]){const a=prim.getAttribute('POSITION'),ix=prim.getIndices().getArray(),m=new T.Matrix4().fromArray(node.getWorldMatrix());for(let i=0;i<ix.length;i+=3)triangles.push([0,1,2].map(k=>new T.Vector3().fromArray(a.getElement(ix[i+k],[])).applyMatrix4(m).add(offset).multiplyScalar(scale).add(new T.Vector3(...c.at))));}
 for(const kind of c.gears){const it=items.find(i=>i.kind===kind);const volumes=[it.parts[3],it.parts[0],it.parts[4]].map(p=>({name:p.name,radius:p.radius,y:p.y.map(y=>y+c.axis[1])}));
 for(const v of volumes){let minimum=Infinity,hits=0;for(const tri of triangles){const poly=clip(clip(tri,'y',v.y[0]-1e-7,1),'y',v.y[1]+1e-7,-1);if(poly.length<3)continue;const d=radialDistance(poly,[c.axis[0],c.axis[2]]);minimum=Math.min(minimum,d);if(d<v.radius-1e-6)hits++;}v.minimumSurfaceRadius=Number.isFinite(minimum)?minimum:null;v.clearance=Number.isFinite(minimum)?minimum-v.radius:null;v.intersectingTriangleCount=hits;}
 let witness=null;
 if(c.id==='lathe'&&kind==='bigGear'){
  let best=Infinity;
  for(let ti=0;ti<triangles.length;ti++){
   const poly=clip(clip(triangles[ti],'y',c.axis[1]-.08,1),'y',c.axis[1]+.08,-1);
   for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],dx=b.x-a.x,dz=b.z-a.z,t=T.MathUtils.clamp(-((a.x-c.axis[0])*dx+(a.z-c.axis[2])*dz)/(dx*dx+dz*dz||1),0,1),point=a.clone().lerp(b,t),radius=Math.hypot(point.x-c.axis[0],point.z-c.axis[2]);
    if(radius<best){best=radius;witness={bodyTriangleIndex:ti,pointPartLocal:point.toArray(),radiusFromGearAxis:radius,hubGuaranteedInteriorRadius:it.logicalRadius*.3*Math.cos(Math.PI/16),radialInteriorMargin:it.logicalRadius*.3*Math.cos(Math.PI/16)-radius,verticalInteriorMargin:.1-Math.abs(point.y-c.axis[1]),meaning:'A point on the rendered lathe body surface is strictly inside the current16-sided hub at everyYrotation; this confirms a local overlap beyond a conservative outer rim sweep. Not a global penetration maximum.'};}
   }
  }
 }
 checks.push({model:c.id,sha256:hash(bytes),kind,fit:c,volumes,witness,pass:volumes.every(v=>v.intersectingTriangleCount===0)});
 }
}
const report={createdAt:new Date().toISOString(),status:'draft-contract-no-order-no-dispatch',request:['m0528','m0537'],sourceSHA:Object.fromEntries(Object.entries(sources).map(([k,s])=>[k,hash(s)])),items,bodyChecks:checks,bodyChecksPass:checks.every(c=>c.pass),method:'Current gearGeometry/gearMesh executed with installed Three.js. Max vertex radial norm bounds every triangle under arbitrary rotation about Y. Mesh-body surfaces clipped to each rim/spoke/hub Y slab and convex XZ projection tested against continuous cylindrical sweep. Source helper material/shadow behavior does not change geometry.',scope:'Only intended small/big shaft-motor, big lathe and small grinder body clearances; no gameplay, neighbouring machine/terminal/dial/plate/shaft full assembly, tooth phase, wrong-size gear or physical iPad proof. Existing shaft/hub bearing overlap is intentional and excluded from body-only test.',replacementContract:{pivot:[0,0,0],axis:'+Y',orientation:'Flat on XZ. Special exception to ground-Y0 convention: centre pivotY0; geometry extends below pivot. Do not floor-normalize.',fitting:'Use uniform scale from actual decoded radial maximum, not phase-zero AABB width. Preserve axis centre and node quantization transforms. Runtime code retains plate/peg/pickables and gearAtY.51.',body:'One static gear mesh, no shaft/stand/base, no skeleton or animation. Rim/upper decoration/hub must each remain within listed cylindrical union in all phases. Target nominal outer radii .4/.6/1; no bevel expansion beyond hard limits.',appearance:'Small brass #d9ad4c, medium steel #8d97a3, big copper #c4553f; painted metal, clear tooth silhouette, distinct readable spoke pattern.',budget:{trianglesMax:4000,bytesTargetMax:150000,materials:1,texture:'512 WebP OPAQUE + Meshopt'},mechanics:'Cosmetic replacement accepted by Claude m0537. Existing6/8/14 teeth and logical radius ratio are approximate: not phase-locked mechanical meshing. No no-intersection promise for gear pairs.'},next:'Current bigGear/lathe overlap must first be resolved with Claude; cosmetic replacement alone does not fix it. No Studio order or worker dispatch from this draft. If proceeding later: render reference to envelope, validate generated mesh against piecewise cylinders, then test actual assemblies and native game loader. Keep current accepted assets unchanged.',cost:0};
await fs.writeFile(path.join(dir,'replacement-contract.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,items:items.map(i=>({kind:i.kind,radius:i.fullRotationRadius})),checks:checks.map(c=>({model:c.model,kind:c.kind,pass:c.pass,volumes:c.volumes,witness:c.witness})),bodyChecksPass:report.bodyChecksPass},null,2));
