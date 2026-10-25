#!/usr/bin/env node
// Measure the actual exported well in model('well', {width:2.8}) coordinates.
import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {getBounds} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {Matrix4,Vector3,Ray} from 'three';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: measure-well.mjs well.glb report.json');
await MeshoptDecoder.ready;
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(input);
const b=getBounds(doc.getRoot().listScenes()[0]),scale=2.8/(b.max[0]-b.min[0]);
const fit=new Matrix4().makeTranslation(-(b.min[0]+b.max[0])*scale/2,-b.min[1]*scale,-(b.min[2]+b.max[2])*scale/2).multiply(new Matrix4().makeScale(scale,scale,scale));
const triangles=[];
for(const n of doc.getRoot().listNodes())if(n.getMesh()){
  const m=fit.clone().multiply(new Matrix4().fromArray(n.getWorldMatrix()));
  for(const p of n.getMesh().listPrimitives()){
    const a=p.getAttribute('POSITION'),idx=p.getIndices(),count=idx?.getCount()??a.getCount();
    for(let i=0;i<count;i+=3)triangles.push([0,1,2].map(k=>new Vector3().fromArray(a.getElement(idx?idx.getScalar(i+k):i+k,[])).applyMatrix4(m)));
  }
}
function firstHit(origin,dir){
  const ray=new Ray(new Vector3(...origin),new Vector3(...dir).normalize());
  const hits=triangles.map(t=>ray.intersectTriangle(...t,false,new Vector3())).filter(Boolean).sort((a,b)=>a.distanceTo(ray.origin)-b.distanceTo(ray.origin));
  return hits[0]??null;
}
const bucketXZ=[0,.45],bucketRadius=.18,clearances=[];
for(const y of [.25,.5,.8,1.05,1.3,1.55])for(let i=0;i<16;i++){
  const a=i*Math.PI/8,origin=[bucketXZ[0],y,bucketXZ[1]],h=firstHit(origin,[Math.cos(a),0,Math.sin(a)]);
  if(h)clearances.push(h.distanceTo(new Vector3(...origin)));
}
const minClearance=Math.min(...clearances);
if(minClearance<bucketRadius+.12)throw Error('Bucket path too close to well masonry');
const rimY=firstHit([0,1.5,1],[0,-1,0])?.y;
if(!rimY||rimY<.9||rimY>1.2)throw Error('Unexpected front rim height');
const gameSight=firstHit([0,1.3,.45],[0,1,.78]);
if(gameSight)throw Error('Raised bucket hidden from game direction');
const postL=firstHit([0,1.7,-.4],[-1,0,0]),postR=firstHit([0,1.7,-.4],[1,0,0]);
if(!postL||!postR)throw Error('Missing side posts at proposed axle');
const report={
 fit:{width:2.8},rotateY:0,front:'+Z',origin:'model() centered XZ, base Y0',
 size:[2.8,(b.max[1]-b.min[1])*scale,(b.max[2]-b.min[2])*scale],
 measured:{frontRimY:rimY,postInnerLeft:postL.toArray(),postInnerRight:postR.toArray(),bucketPathMinWallDistance:minClearance,sampledHeights:[.25,.5,.8,1.05,1.3,1.55],directionsPerHeight:16,raisedBucketClearFromGameDirection:true},
 suggested:{rimY:1.05,axleCenter:[0,1.7,-.4],axleAxis:'+X',axleLength:2.2,
 bucketXZ,bucketRadius,raisedBucketCenterY:1.3,loweredBucketCenterY:.25,waterCenter:[0,.2,0],waterRadius:.78},
 notes:['Suggested bucket location is forward of posts to keep it visible. Route a rope over a forward guide or short brackets; do not assume a vertical rope from the rear axle.',
 'Geometry probes do not replace a visual review of the real animated toy.',
 'Do not bake bucket, water, crank or rope into this static asset.']
};
await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
