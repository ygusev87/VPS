import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as T from 'three';
import validator from 'gltf-validator';
import {getBounds} from '@gltf-transform/functions';
import {dir,io,sha,bytes,doc as original,sourceNode,triangles,labels,key,edgeMap,topology} from './source.mjs';

const bin=await fs.readFile(path.join(dir,'candidate/tractor.glb'));
const doc=await io.readBinary(bin),root=doc.getRoot();
const build=JSON.parse(await fs.readFile(path.join(dir,'build-report.json'),'utf8'));
const debug=JSON.parse(await fs.readFile(path.join(dir,'mesh-debug.json'),'utf8'));
const sweep=JSON.parse(await fs.readFile(path.join(dir,'sweep-report.json'),'utf8'));
const surfaces=JSON.parse(await fs.readFile(path.join(dir,'surface-check.json'),'utf8'));
const groups=new Map(),rawSignatures=new Map();
const faceKey=t=>t.v.map(v=>key(v.p)).sort().join('|');
const rawKey=(p,ids)=>ids.map(i=>p.listSemantics().sort().map(s=>{
  const a=p.getAttribute(s),n=a.getElementSize();return s+':'+Array.from(a.getArray().slice(i*n,(i+1)*n)).join(',');
}).join(';')).sort().join('|');
for(const n of root.listNodes()){
  if(!n.getMesh())continue;
  const name=n.getName()==='tractor-body'?'tractor-body':n.getName().replace('tire-','wheel-');
  const tris=[],signatures=new Map();
  for(const p of n.getMesh().listPrimitives()){
    const a=p.getAttribute('POSITION'),ids=p.getIndices().getArray(),m=new T.Matrix4().fromArray(n.getWorldMatrix()),vs=[];
    for(let i=0;i<a.getCount();i++)vs.push({p:new T.Vector3(...a.getElement(i,[])).applyMatrix4(m).toArray()});
    for(let i=0;i<ids.length;i+=3){
      const face=Array.from(ids.slice(i,i+3));tris.push({v:face.map(j=>vs[j])});const k=rawKey(p,face);signatures.set(k,(signatures.get(k)||0)+1);
    }
  }
  groups.set(name,tris);rawSignatures.set(name,signatures);
}
const checks={};
assert.equal(sha(bin),build.outputSha256);
assert.equal(sweep.candidateSha256,sha(bin));assert.equal(surfaces.candidateSha256,sha(bin));
assert(sweep.pass&&surfaces.pass);checks.sweepAndSurfaceReportsMatchFinalBinary=true;
for(const part of debug.parts){
  const decoded=groups.get(part.name),expected=part.triangles.map(faceKey).sort(),actual=decoded.map(faceKey).sort();
  assert.deepEqual(actual,expected,part.name+' decoded surface mismatch');
}
checks.decodedGeometryMatchesCheckedReconstruction=true;
const originalPrim=sourceNode.getMesh().listPrimitives()[0],originalIds=originalPrim.getIndices().getArray();
const preserved=[];
for(const part of debug.parts){
  let count=0;const counts=new Map(rawSignatures.get(part.name));
  for(const t of part.triangles.filter(t=>t.source!==null&&!t.clipped)){
    const k=rawKey(originalPrim,Array.from(originalIds.slice(t.source*3,t.source*3+3)));
    assert(counts.get(k)>0,`Original attributes changed: ${part.name} / ${t.source}`);counts.set(k,counts.get(k)-1);count++;
  }
  preserved.push({part:part.name,originalFacesWithByteExactPositionNormalUV:count});
}
const sourceBody=labels.map((l,i)=>l==='body'?i:null).filter(i=>i!==null),removed=new Set(build.bodyAttachmentFacesRemoved);
assert.equal(sourceBody.length-removed.size,build.bodyRetainedOriginalTriangles);
assert.equal(preserved.find(p=>p.part==='tractor-body').originalFacesWithByteExactPositionNormalUV,6416);
checks.retainedSourceVertexAttributesExact=true;
const bodyEdges=edgeMap(groups.get('tractor-body')),sourceEdges=edgeMap(triangles);
const inheritedNonManifold=[...bodyEdges].filter(([,e])=>e.length>2).map(([k,e])=>({edge:k,candidateIncidence:e.length,sourceIncidence:sourceEdges.get(k)?.length}));
assert(inheritedNonManifold.every(e=>e.sourceIncidence===e.candidateIncidence));
const bodyTopology=topology(groups.get('tractor-body'));assert.equal(bodyTopology.openEdges,0);assert.equal(bodyTopology.sameDirectionEdges,0);
checks.bodyHasNoNewNonManifoldEdges=true;
const wheels=root.listNodes().filter(n=>n.getName().startsWith('wheel-'));
assert.equal(wheels.length,4);
const wheelTopology=wheels.map(n=>({name:n.getName(),...topology(groups.get(n.getName()))}));
for(const t of wheelTopology)for(const k of ['openEdges','nonManifoldEdges','sameDirectionEdges','degenerate'])assert.equal(t[k],0,t.name+' '+k);
for(const w of wheelTopology){
  const mesh=groups.get(w.name);w.signedVolume=mesh.reduce((sum,t)=>sum+new T.Vector3(...t.v[0].p).dot(new T.Vector3(...t.v[1].p).cross(new T.Vector3(...t.v[2].p)))/6,0);
  w.minimumTriangleArea=Math.min(...mesh.map(t=>new T.Vector3(...t.v[1].p).sub(new T.Vector3(...t.v[0].p)).cross(new T.Vector3(...t.v[2].p).sub(new T.Vector3(...t.v[0].p))).length()/2));
  assert(w.signedVolume>0&&w.minimumTriangleArea>0);
}
checks.fourClosedConsistentlyOrientedWheels=true;
const wheelPairClearance=[];
for(let i=0;i<build.wheels.length;i++)for(let j=i+1;j<build.wheels.length;j++){
  const a=build.wheels[i],b=build.wheels[j],axialGap=Math.max(a.rawXRange[0]-b.rawXRange[1],b.rawXRange[0]-a.rawXRange[1]);
  const radialGap=Math.hypot(a.pivotRaw[1]-b.pivotRaw[1],a.pivotRaw[2]-b.pivotRaw[2])-a.radius-b.radius;
  assert(axialGap>0||radialGap>0);wheelPairClearance.push({a:a.name,b:b.name,axialGap,radialGap});
}
checks.wheelPairsClearAtEveryRotation=true;
const candidateRoot=root.listNodes().find(n=>n.getName()===sourceNode.getName());
assert.deepEqual(candidateRoot.getTranslation(),sourceNode.getTranslation());assert.deepEqual(candidateRoot.getScale(),sourceNode.getScale());assert.deepEqual(candidateRoot.getRotation(),sourceNode.getRotation());
const bodyNode=root.listNodes().find(n=>n.getName()==='tractor-body'),bodyMatrix=bodyNode.getWorldMatrix();
for(const w of wheels){
  assert.equal(w.getParentNode(),candidateRoot);assert.deepEqual(w.getRotation(),[0,0,0,1]);
  const measured=build.wheels.find(m=>m.name===w.getName());
  assert.deepEqual(w.getTranslation(),measured.pivotInSourceNode);
  for(const phase of [0,45,90,360]){w.setRotation(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),phase*Math.PI/180).toArray());assert.deepEqual(bodyNode.getWorldMatrix(),bodyMatrix);}
  w.setRotation([0,0,0,1]);
}
checks.pivotsLocalPositiveXAndBodyIndependent=true;
const before=getBounds(original.getRoot().listScenes()[0]),after=getBounds(root.listScenes()[0]);
const maxBoundsDifference=Math.max(...['min','max'].flatMap(k=>before[k].map((v,i)=>Math.abs(v-after[k][i]))));
assert(maxBoundsDifference<1e-12);checks.sourceRootAndBoundsPreserved=true;
const materialSlots=['getBaseColorTexture','getNormalTexture','getMetallicRoughnessTexture'];
const oldMaterial=originalPrim.getMaterial(),newMaterial=root.listMaterials()[0];assert.equal(root.listMaterials().length,1);
const textureSlots=materialSlots.map(get=>({slot:get,sourceSha256:sha(oldMaterial[get]().getImage()),candidateSha256:sha(newMaterial[get]().getImage())}));
assert(textureSlots.every(t=>t.sourceSha256===t.candidateSha256));
for(const getter of ['getBaseColorFactor','getMetallicFactor','getRoughnessFactor','getAlphaMode','getDoubleSided','getEmissiveFactor'])assert.deepEqual(newMaterial[getter](),oldMaterial[getter]());
checks.originalAtlasAndMaterialPreserved=true;
const sourcePublicSha=sha(await fs.readFile(path.resolve(dir,'../../../../../../public/models/tractor.glb')));
assert.equal(sourcePublicSha,sha(bytes));checks.publicTractorUnchanged=true;
const totalTriangles=[...groups.values()].reduce((s,g)=>s+g.length,0);assert(totalTriangles<=triangles.length);assert.equal(totalTriangles,13416);
const rawValidation=await validator.validateBytes(bin,{maxIssues:200});
const sourceValidation=await validator.validateBytes(bytes,{maxIssues:200});
// Meshopt payloads are not validated by Khronos. Also validate a decoded copy in memory.
const decoded=await io.readBinary(bin);decoded.getRoot().listExtensionsUsed().find(e=>e.extensionName==='EXT_meshopt_compression')?.dispose();
const decodedValidation=await validator.validateBytes(await io.writeBinary(decoded),{maxIssues:200});
await fs.writeFile(path.join(dir,'validator.json'),JSON.stringify({source:sourceValidation,compressed:rawValidation,decoded:decodedValidation},null,2)+'\n');
assert.equal(decodedValidation.issues.numErrors,0);
assert(sourceValidation.issues.messages.some(m=>m.code==='MESH_PRIMITIVE_GENERATED_TANGENT_SPACE'));
assert(decodedValidation.issues.messages.filter(m=>m.severity===1).every(m=>m.code==='MESH_PRIMITIVE_GENERATED_TANGENT_SPACE'));
checks.decodedGltfValidatorZeroErrorsOnlyInheritedTangentWarnings=true;
const report={status:'PASS_EXPERIMENTAL_ABOVE_TARGET',candidateSha256:sha(bin),sourceSha256:sha(bytes),bytes:bin.length,totalTriangles,targetTriangles:8000,sourceTriangles:triangles.length,checks,preserved,bodyTopology,inheritedNonManifold,wheelTopology,textureSlots,bounds:{before,after,maxDifference:maxBoundsDifference},validator:{compressed:rawValidation.issues,decoded:decodedValidation.issues},limits:['13,416 > 8,000 target; experimental candidate only.','Body retains six original non-manifold geometric edges outside the reconstructed attachments.','Hidden wheel inner walls are planar reconstructed caps with existing atlas samples.','No physical iPad or production integration test in this candidate-only task.']};
await fs.writeFile(path.join(dir,'audit-report.json'),JSON.stringify(report,null,2)+'\n');
await fs.writeFile(path.join(dir,'wheel-pair-clearance.json'),JSON.stringify({candidateSha256:sha(bin),method:'Disjoint axial intervals or disjoint YZ bounding circles prove separation for every independent wheel phase.',pairs:wheelPairClearance,pass:true},null,2)+'\n');
await fs.writeFile(path.join(dir,'change-mask.json'),JSON.stringify({candidateSha256:sha(bin),sourceSha256:sha(bytes),changedSourceTriangleIds:build.changedSourceTriangles,bodyAttachmentFacesRemoved:build.bodyAttachmentFacesRemoved,frontLeftHubFacesRemoved:build.wheels.find(w=>w.name==='wheel-front-left').hubRepair.removedSourceFaces,parts:debug.parts.map(p=>({name:p.name,reconstructedCandidateFaceIds:p.triangles.flatMap((t,i)=>t.reconstructed?[i]:[]),clippedCandidateFaceIds:p.triangles.flatMap((t,i)=>t.clipped?[i]:[])})),indexMeaning:'Source IDs index original triangle order; candidate IDs index the respective part triangle order. Diagnostic mask GLBs encode the same sets.'},null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks,totalTriangles,bytes:bin.length,validator:report.validator},null,2));
