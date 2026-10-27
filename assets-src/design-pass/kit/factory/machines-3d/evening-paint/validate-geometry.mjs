import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import * as T from 'three';
const dir=path.dirname(fileURLToPath(import.meta.url)), repo=path.resolve(dir,'../../../../../..');
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const tuning=JSON.parse(await fs.readFile(path.join(dir,'tuning.json'),'utf8'));

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
function radial(polygon) {
  let minimum=Infinity,inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j],dy=b.y-a.y,dz=b.z-a.z,t=T.MathUtils.clamp(-(a.y*dy+a.z*dz)/(dy*dy+dz*dz||1),0,1);
    minimum=Math.min(minimum,Math.hypot(a.y+t*dy,a.z+t*dz));
    if((a.z>0)!==(b.z>0)&&0<(b.y-a.y)*(-a.z)/(b.z-a.z)+a.y)inside=!inside;
  }
  return inside?0:minimum;
}
for(const name of process.argv.slice(2)) {
  const config=tuning[name],file=path.join(repo,'public/models',name+'.glb'),bytes=await fs.readFile(file),document=await io.readBinary(bytes),triangles=[];
  for(const node of document.getRoot().listNodes()) {
    if(!node.getMesh())continue;
    const matrix=new T.Matrix4().fromArray(node.getWorldMatrix());
    for(const primitive of node.getMesh().listPrimitives()) {
      const positions=primitive.getAttribute('POSITION'),indices=primitive.getIndices().getArray();
      for(let i=0;i<indices.length;i+=3)triangles.push([0,1,2].map(k=>new T.Vector3(...positions.getElement(indices[i+k],[])).applyMatrix4(matrix)));
    }
  }
  const vertices=triangles.flat(),bounds=new T.Box3().setFromPoints(vertices),size=bounds.getSize(new T.Vector3()).toArray();
  const report={name,sha256:createHash('sha256').update(bytes).digest('hex'),triangles:triangles.length,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),size},floor:{minimumY:bounds.min.y,verticesBelowFloor:vertices.filter(v=>v.y<-.00002).length},dimensionsPass:size.every((v,i)=>Math.abs(v-config.size[i])<.002)};
  if(name==='paint-booth') {
    const minimum=new T.Vector3(-1.2,.001,-.699),maximum=new T.Vector3(1.2,.999,.699);
    const obstructing=triangles.filter(t=>inBox(t,minimum,maximum)).length;
    const floorTriangles=triangles.filter(t=>inBox(t,new T.Vector3(-1.2,-.001,-.699),new T.Vector3(1.2,.01,.699))).length;
    const rays=[];
    for(let y=0;y<7;y++)for(let z=0;z<7;z++) {
      const origin=new T.Vector3(-1.3,.02+y*.16,-.68+z*1.36/6),ray=new T.Ray(origin,new T.Vector3(1,0,0));
      const hits=triangles.reduce((n,t)=>{const hit=ray.intersectTriangle(...t,false,new T.Vector3());return n+(hit&&hit.x<=1.3?1:0);},0);
      rays.push({y:origin.y,z:origin.z,hits});
    }
    report.tunnel={axis:'X',minimumClearWidthZ:1.4,minimumClearHeightY:1.0,obstructingTriangles:obstructing,attachedFloorTriangles:floorTriangles,rays};
    report.pass=report.dimensionsPass&&report.floor.verticesBelowFloor===0&&obstructing===0&&floorTriangles===0&&rays.every(r=>r.hits===0);
  } else {
    if(!config.outlet)throw new Error('Outlet must be measured before validation');
    const outlet=config.outlet,centre=new T.Vector3(...outlet.boreCentre);
    const collisions=triangles.filter(t=>{
      let p=t.map(v=>v.clone().sub(centre));
      p=clip(p,'x',-outlet.boreLength/2+.001,true);
      if(!p.length)return false;
      p=clip(p,'x',outlet.boreLength/2-.001,false);
      return p.length>=3&&radial(p)<outlet.boreRadius-.001;
    }).length;
    report.outlet={...outlet,axis:'+X',boreObstructions:collisions};
    report.pass=report.dimensionsPass&&report.floor.verticesBelowFloor===0&&centre.x>0&&collisions===0;
  }
  await fs.writeFile(path.join(dir,name+'-geometry.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({name,pass:report.pass,bounds:report.bounds,obstructions:report.tunnel?.obstructingTriangles??report.outlet.boreObstructions}));
  if(!report.pass)process.exitCode=1;
}
