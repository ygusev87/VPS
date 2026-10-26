// Extract the smaller right-hand bale from the accepted hayloft. No source asset is edited.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize,getBounds,meshopt,prune,weld,simplify} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';
import {Vector2,Vector3,Matrix3,Matrix4,ShapeUtils,Triangle} from 'three';
import validator from 'gltf-validator';
const dir=path.dirname(fileURLToPath(import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const bytes=await fs.readFile(path.join(dir,'original/hayloft.glb'));
const manifest=JSON.parse(await fs.readFile(path.join(dir,'original/manifest.json'),'utf8'));
if(sha(bytes)!==manifest.files['public/models/hayloft.glb'].sha256)throw Error('Captured original changed');
const d=await io.readBinary(bytes);await d.transform(dequantize());
const r=d.getRoot(),scene=r.listScenes()[0],sourceTriangles=[];
if(r.listMeshes().length!==1||r.listMeshes()[0].listPrimitives().length!==1)throw Error('Unexpected source structure');
const material=r.listMeshes()[0].listPrimitives()[0].getMaterial(),textureHashes=r.listTextures().map(t=>sha(t.getImage()));
for(const node of r.listNodes())for(const p of node.getMesh()?.listPrimitives()??[]){
 const m=new Matrix4().fromArray(node.getWorldMatrix()),nm=new Matrix3().getNormalMatrix(m),pos=p.getAttribute('POSITION'),normal=p.getAttribute('NORMAL'),uv=p.getAttribute('TEXCOORD_0'),idx=p.getIndices().getArray();
 const vertices=Array.from({length:pos.getCount()},(_,i)=>({p:new Vector3(...pos.getElement(i,[])).applyMatrix4(m).toArray(),n:new Vector3(...normal.getElement(i,[])).applyNormalMatrix(nm).toArray(),uv:uv.getElement(i,[])}));
 for(let i=0;i<idx.length;i+=3)sourceTriangles.push([vertices[idx[i]],vertices[idx[i+1]],vertices[idx[i+2]]]);
}
// The bale is fused into the wall/deck/other bale. Retain its exposed front-right quarter,
// reflect the geometry itself (never a negative node scale), then close only the underside.
const limits={min:[-.365,1.975,-.180],max:[-.230,2.218,.080]};
const interpolate=(a,b,t)=>({p:a.p.map((v,i)=>v+(b.p[i]-v)*t),n:a.n.map((v,i)=>v+(b.n[i]-v)*t),uv:a.uv.map((v,i)=>v+(b.uv[i]-v)*t)});
function clip(poly,axis,value,sign){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a.p[axis]-value)*sign,db=(b.p[axis]-value)*sign;if(da>=-1e-10)out.push(a);if((da>1e-10&&db< -1e-10)||(da< -1e-10&&db>1e-10))out.push(interpolate(a,b,da/(da-db)));}return out;}
const area=t=>new Vector3(...t[1].p).sub(new Vector3(...t[0].p)).cross(new Vector3(...t[2].p).sub(new Vector3(...t[0].p))).length()/2;
const key=p=>p.map(n=>Math.round(n*1e7)).join(',');
let originalSurface=[];
for(const source of sourceTriangles){
 let poly=source;
 for(let axis=0;axis<3;axis++){poly=clip(poly,axis,limits.min[axis],1);poly=clip(poly,axis,limits.max[axis],-1);}
 for(let i=1;i<poly.length-1;i++){const t=[poly[0],poly[i],poly[i+1]];if(area(t)>1e-12)originalSurface.push(t);}
}
let triangles=[];
for(const sx of [1,-1])for(const sz of [1,-1])for(const t of originalSurface){
 const result=t.map(v=>{
  const p=[...v.p],n=[...v.n];
  if(Math.abs(p[0]-limits.min[0])<1e-7)n[0]=0;
  if(Math.abs(p[2]-limits.min[2])<1e-7)n[2]=0;
  p[0]=limits.min[0]+sx*(p[0]-limits.min[0]);p[2]=limits.min[2]+sz*(p[2]-limits.min[2]);n[0]*=sx;n[2]*=sz;
  return {p,n,uv:[...v.uv]};
 });
 if(sx*sz<0)result.reverse();triangles.push(result);
}
// One closed bottom contour. The hidden contact face samples a gold point from the original atlas.
const edges=new Map();
for(const t of triangles)for(let i=0;i<3;i++){
 const a=t[i],b=t[(i+1)%3];if(Math.abs(a.p[1]-limits.min[1])>1e-7||Math.abs(b.p[1]-limits.min[1])>1e-7)continue;
 const k=[key(a.p),key(b.p)].sort().join('|');if(edges.has(k))edges.delete(k);else edges.set(k,[a,b]);
}
const remaining=[...edges.values()],loops=[];
while(remaining.length){const [a,b]=remaining.pop(),loop=[a,b];let last=key(b.p);while(last!==key(a.p)){const i=remaining.findIndex(e=>e.some(v=>key(v.p)===last));if(i<0)throw Error('Open bottom contour');const e=remaining.splice(i,1)[0],next=key(e[0].p)===last?e[1]:e[0];loop.push(next);last=key(next.p);if(loop.length>1000)throw Error('Invalid loop');}loop.pop();loops.push(loop);}
if(loops.length!==1)throw Error('Expected a single contact contour; got '+loops.length);
const donor=originalSurface.filter(t=>new Triangle(...t.map(v=>new Vector3(...v.p))).getNormal(new Vector3()).y>.5).sort((a,b)=>area(b)-area(a))[0];
const bottomUV=[0,1].map(i=>donor.reduce((sum,v)=>sum+v.uv[i],0)/3);
let bottomTriangles=0;
for(const loop of loops)for(const ids of ShapeUtils.triangulateShape(loop.map(v=>new Vector2(v.p[0],v.p[2])),[])){
 const t=ids.map(i=>({p:[...loop[i].p],n:[0,-1,0],uv:bottomUV}));
 if(new Triangle(...t.map(v=>new Vector3(...v.p))).getNormal(new Vector3()).y>0)t.reverse();if(area(t)>1e-12){triangles.push(t);bottomTriangles++;}
}
const bounds={min:[0,1,2].map(a=>Math.min(...triangles.flatMap(t=>t.map(v=>v.p[a])))),max:[0,1,2].map(a=>Math.max(...triangles.flatMap(t=>t.map(v=>v.p[a]))))};
const center=[(bounds.min[0]+bounds.max[0])/2,bounds.min[1],(bounds.min[2]+bounds.max[2])/2],arrays={POSITION:[],NORMAL:[],TEXCOORD_0:[]};
// Positive +90° yaw puts the bale's long axis along X, like the existing width-fit contract.
for(const t of triangles)for(const v of t){const p=v.p.map((n,i)=>n-center[i]),n=new Vector3(...v.n).normalize();arrays.POSITION.push(p[2],p[1],-p[0]);arrays.NORMAL.push(n.z,n.y,-n.x);arrays.TEXCOORD_0.push(...v.uv);}
for(const child of [...scene.listChildren()])scene.removeChild(child);
const buffer=r.listBuffers()[0],prim=d.createPrimitive().setMaterial(material);
for(const [semantic,array] of Object.entries(arrays))prim.setAttribute(semantic,d.createAccessor().setType(semantic==='TEXCOORD_0'?'VEC2':'VEC3').setArray(new Float32Array(array.map(v=>Math.round(v*1e5)/1e5))).setBuffer(buffer));
prim.setIndices(d.createAccessor().setType('SCALAR').setArray(new Uint32Array(triangles.length*3).map((_,i)=>i)).setBuffer(buffer));
scene.addChild(d.createNode('hay-bale').setMesh(d.createMesh('hay-bale').addPrimitive(prim)));
await d.transform(prune(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:.04,error:.0001}));
const optimizedTriangles=prim.getIndices().getCount()/3;
for(const ext of r.listExtensionsUsed())if(ext.extensionName==='EXT_meshopt_compression')ext.dispose();
await fs.writeFile(path.join(dir,'candidate/hay-bale-uncompressed.glb'),await io.writeBinary(d));
await d.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16,quantizeNormal:12}));
const b=getBounds(scene),offset=[-(b.min[0]+b.max[0])/2,-b.min[1],-(b.min[2]+b.max[2])/2];for(const n of scene.listChildren())n.setTranslation(n.getTranslation().map((v,i)=>v+offset[i]));
const out=await io.writeBinary(d);await fs.writeFile(path.join(dir,'candidate/hay-bale.glb'),out);
const after=await io.readBinary(out),validation=await validator.validateBytes(out,{uri:'hay-bale.glb'}),size=getBounds(after.getRoot().listScenes()[0]);
const report={status:'candidate-needs-visual-review',source:'original/hayloft.glb',sourceSha256:sha(bytes),sourceTriangles:sourceTriangles.length,selection:limits,selectedOriginalSurfaceTriangles:originalSurface.length,reconstruction:{method:'Exposed front-right quarter reflected in geometry about X/Z cut planes; triangle winding and normals corrected; positive node transforms only',mirrorPlanes:{x:limits.min[0],z:limits.min[2]},contactCap:{triangles:bottomTriangles,uv:bottomUV,contourVertices:loops[0].length}},rotationYDegrees:90,translationBeforeRotation:center.map(n=>-n),candidateSha256:sha(out),bytes:out.length,triangles:optimizedTriangles,preOptimizationTriangles:triangles.length,bounds:size,fit:{width:2.8},textureHashesBefore:textureHashes,textureHashesAfter:after.getRoot().listTextures().map(t=>sha(t.getImage())),materialUnchanged:true,validation:validation.issues,notes:['This is an extraction plus reconstruction of hidden sides, not a detachable original object. Visible geometry/UVs are copied from the same source bale; the only new face is the flat ground-contact cap.','All material properties and embedded texture bytes are preserved. Geometry reflections are baked with corrected winding and normals; nodes use positive transforms.','Positive 90 degree yaw; bottom y0 and XZ centered. Runtime/public untouched.']};
await fs.writeFile(path.join(dir,'extraction.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(validation.issues.numErrors)throw Error('glTF validation failed');
