import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {MeshoptDecoder} from 'meshoptimizer';import * as T from 'three';
const dir=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(dir,'../../../../../..');await MeshoptDecoder.ready;const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
function clip(poly,y,keepAbove){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=keepAbove?a.y>=y:a.y<=y,ib=keepAbove?b.y>=y:b.y<=y;if(ia)out.push(a);if(ia!==ib)out.push(a.clone().lerp(b,(y-a.y)/(b.y-a.y)));}return out;}
function radial(poly){let min=Infinity,inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j],dx=b.x-a.x,dz=b.z-a.z,t=T.MathUtils.clamp(-(a.x*dx+a.z*dz)/(dx*dx+dz*dz||1),0,1);min=Math.min(min,Math.hypot(a.x+t*dx,a.z+t*dz));if((a.z>0)!==(b.z>0)&&0<(b.x-a.x)*(-a.z)/(b.z-a.z)+a.x)inside=!inside;}return inside?0:min;}
function cylinderIntersections(tris,matrix,radius,height){const inv=matrix.clone().invert();return tris.filter(t=>{let p=t.map(v=>v.clone().applyMatrix4(inv));p=clip(p,-height/2,true);if(!p.length)return false;p=clip(p,height/2,false);return p.length>=3&&radial(p)<radius-1e-5}).length;}
for(const name of process.argv.slice(2)){
 const d=await io.read(path.join(repo,'public/models',name+'.glb')),tris=[],vertices=[];
 for(const n of d.getRoot().listNodes()){if(!n.getMesh())continue;const matrix=new T.Matrix4().fromArray(n.getWorldMatrix());for(const p of n.getMesh().listPrimitives()){const pos=p.getAttribute('POSITION'),ind=p.getIndices().getArray();for(let i=0;i<ind.length;i+=3){const tri=[0,1,2].map(k=>new T.Vector3(...pos.getElement(ind[i+k],[])).applyMatrix4(matrix));tris.push(tri);vertices.push(...tri);}}}
 const report={name,triangleCount:tris.length};
 if(name==='lever-box'){
  report.stickSweep=Array.from({length:45},(_,i)=>{const angle=-.55+i*1.1/44,m=new T.Matrix4().makeTranslation(0,.35,-.35).multiply(new T.Matrix4().makeRotationZ(angle)).multiply(new T.Matrix4().makeTranslation(0,.2,.3)).multiply(new T.Matrix4().makeRotationX(Math.PI/2-.5));return {angle,intersectingTriangles:cylinderIntersections(tris,m,.06,.75)}});
  report.pass=report.stickSweep.every(x=>x.intersectingTriangles===0);
 }else if(name==='shaft-motor'){report.shaftIntersectingTriangles=cylinderIntersections(tris,new T.Matrix4().makeTranslation(0,.25,-.25),.08,.5);report.pass=report.shaftIntersectingTriangles===0;}
 else if(name==='socket-board'){
  const panel=vertices.filter(v=>v.y>=.1001),feet=vertices.filter(v=>v.y<=.1001);const box=v=>{const b=new T.Box3().setFromPoints(v);return {min:b.min.toArray(),max:b.max.toArray(),size:b.getSize(new T.Vector3()).toArray()}};report.panelBounds=box(panel);report.feetBounds=box(feet);report.minimumTerminalZ=.75;report.maximumFrontZ=Math.max(...vertices.map(v=>v.z));report.minimumFrontClearance=report.minimumTerminalZ-report.maximumFrontZ-.09;report.pass=report.minimumFrontClearance>.4;
 }else throw Error('Unsupported '+name);
 await fs.writeFile(path.join(dir,name+'-geometry.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.pass)process.exitCode=1;
}
