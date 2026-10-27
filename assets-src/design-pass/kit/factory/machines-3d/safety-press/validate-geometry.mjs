import fs from 'node:fs/promises';import {fileURLToPath} from 'node:url';import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {MeshoptDecoder} from 'meshoptimizer';import * as T from 'three';
const dir=path.dirname(fileURLToPath(import.meta.url));await MeshoptDecoder.ready;
const d=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(path.join(dir,'candidate/safety-press.glb'));
const ts=[];for(const n of d.getRoot().listNodes()){const mat=new T.Matrix4().fromArray(n.getWorldMatrix());for(const p of n.getMesh()?.listPrimitives()??[]){const a=p.getAttribute('POSITION'),idx=p.getIndices().getArray();for(let i=0;i<idx.length;i+=3)ts.push(new T.Triangle(...[0,1,2].map(k=>new T.Vector3(...a.getElement(idx[i+k],[])).applyMatrix4(mat))));}}
// Test in model-local coordinates; runtime adds [.0,.16,-.35].
const head=new T.Box3(new T.Vector3(-.5,.475,-.35),new T.Vector3(.5,1.575,.35));
const headIntersections=ts.map((t,i)=>head.intersectsTriangle(t)?i:null).filter(i=>i!==null);
function clipY(poly,y,sign){const q=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a.y-y)*sign,db=(b.y-y)*sign;if(da>=0)q.push(a);if((da>=0)!=(db>=0))q.push(a.clone().lerp(b,da/(da-db)));}return q;}
function distanceXZ(poly){let min=Infinity,positive=false,negative=false;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];const dx=b.x-a.x,dz=b.z-a.z;const v=-(a.x*dx+a.z*dz)/(dx*dx+dz*dz||1),t=Math.min(1,Math.max(0,v));min=Math.min(min,Math.hypot(a.x+t*dx,a.z+t*dz));const c=a.x*b.z-b.x*a.z;if(c>1e-10)positive=true;if(c< -1e-10)negative=true;}return positive!==negative?0:min;}
let minRod=Infinity;const rodIntersections=[];
for(let i=0;i<ts.length;i++){const t=ts[i],poly=clipY(clipY([t.a,t.b,t.c],.8,1),2.45,-1);if(poly.length<3)continue;const dist=distanceXZ(poly);minRod=Math.min(minRod,dist);if(dist<.1-1e-5)rodIntersections.push(i);}
const phases=[0,.5,1].map(v=>{const y=1.4-.75*v;const box=new T.Box3(new T.Vector3(-.5,y-.175,-.35),new T.Vector3(.5,y+.175,.35));return{phase:v,headY:[y-.175+.16,y+.175+.16],intersections:ts.filter(t=>box.intersectsTriangle(t)).length};});
const report={triangleCount:ts.length,headSweepIntersections:headIntersections.length,headTriangleIds:headIntersections,rodSweepIntersections:rodIntersections.length,rodTriangleIds:rodIntersections,minimumRadialRodClearance:minRod-.1,phases,method:'Triangle-AABB SAT for full head sweep; Y-clipped projected triangle distance to vertical rod axis for full rod sweep. Coordinates include model transforms; runtime translation removed from moving envelopes.'};
await fs.writeFile(path.join(dir,'geometry-review.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(headIntersections.length||rodIntersections.length)process.exitCode=1;
