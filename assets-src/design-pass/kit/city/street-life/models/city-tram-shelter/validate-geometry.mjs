import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import * as T from 'three';
const dir=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(dir,'../../../../../../..');
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
function clip(poly,axis,value,above) {
  const output=[];
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length],insideA=above?a[axis]>=value:a[axis]<=value,insideB=above?b[axis]>=value:b[axis]<=value;
    if(insideA)output.push(a);
    if(insideA!==insideB)output.push(a.clone().lerp(b,(value-a[axis])/(b[axis]-a[axis])));
  }
  return output;
}
function inBox(triangle,min,max) {
  let polygon=triangle;
  for(const axis of ['x','y','z']) {
    polygon=clip(polygon,axis,min[axis],true);
    if(!polygon.length)return false;
    polygon=clip(polygon,axis,max[axis],false);
    if(!polygon.length)return false;
  }
  return polygon.length>=3;
}

const file=path.join(repo,'public/models/city-tram-shelter.glb'),bytes=await fs.readFile(file),document=await io.readBinary(bytes),triangles=[];
for(const node of document.getRoot().listNodes()){
 if(!node.getMesh())continue;const matrix=new T.Matrix4().fromArray(node.getWorldMatrix());
 for(const primitive of node.getMesh().listPrimitives()){
  const positions=primitive.getAttribute('POSITION'),indices=primitive.getIndices().getArray();
  for(let i=0;i<indices.length;i+=3)triangles.push([0,1,2].map(k=>new T.Vector3(...positions.getElement(indices[i+k],[])).applyMatrix4(matrix)));
 }
}
const minimum=new T.Vector3(-1.25,.02,.25),maximum=new T.Vector3(1.25,1.65,.8);
const obstructionCount=triangles.filter(t=>inBox(t,minimum,maximum)).length;
const floorTriangleCount=triangles.filter(t=>inBox(t,new T.Vector3(-1.25,-.001,.25),new T.Vector3(1.25,.02,.8))).length;
const rays=[];
for(let x=0;x<7;x++)for(let y=0;y<7;y++){
 const origin=new T.Vector3(-1.25+x*2.5/6,.04+y*1.6/6,1.1),ray=new T.Ray(origin,new T.Vector3(0,0,-1));
 const hits=triangles.reduce((n,t)=>{const h=ray.intersectTriangle(...t,false,new T.Vector3());return n+(h&&h.z>=.25?1:0)},0);rays.push({x:origin.x,y:origin.y,hits});
}
const report={sha256:createHash('sha256').update(bytes).digest('hex'),clearFrontVolume:{min:minimum.toArray(),max:maximum.toArray(),width:2.5,height:1.63,depth:.55},obstructionCount,floorTriangleCount,rays,pass:obstructionCount===0&&floorTriangleCount===0&&rays.every(r=>r.hits===0)};
await fs.writeFile(path.join(dir,'geometry.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.pass)process.exitCode=1;
