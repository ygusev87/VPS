#!/usr/bin/env node
/** Read-only audit of a hero rig against its shipped static appearance. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {Box3, Matrix4, PropertyBinding, Vector3} from 'three';
import sharp from 'sharp';

const [staticPath, rigPath, outputPath] = process.argv.slice(2);
if (!staticPath || !rigPath || !outputPath) throw Error('Usage: audit-hero-rig.mjs static.glb rig.glb report.json');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const original = await io.read(staticPath), rig = await io.read(rigPath);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function fitPoints(doc) {
  const points = [];
  for (const node of doc.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    const matrix = new Matrix4().fromArray(node.getWorldMatrix());
    for (const primitive of node.getMesh().listPrimitives()) {
      const positions = primitive.getAttribute('POSITION');
      for (let i = 0; i < positions.getCount(); i++) points.push(new Vector3(...positions.getElement(i,[])).applyMatrix4(matrix));
    }
  }
  const box = new Box3().setFromPoints(points), center = box.getCenter(new Vector3()), size = box.getSize(new Vector3());
  return {bounds:{min:box.min.toArray(),max:box.max.toArray()},size:size.toArray(),points:points.map(p=>[(p.x-center.x)/size.x,(p.y-box.min.y)/size.x,(p.z-center.z)/size.x])};
}
function nearest(from,to) {
  let max = 0, sum = 0;
  for (const p of from) {
    let best=Infinity;
    for(const q of to) best=Math.min(best,(p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2);
    max=Math.max(max,best);sum+=best;
  }
  return {max:Math.sqrt(max),rms:Math.sqrt(sum/from.length)};
}
const a=fitPoints(original),b=fitPoints(rig);
if(original.getRoot().listTextures().length!==rig.getRoot().listTextures().length)throw Error('Texture counts differ');
const textures=[];
for(let i=0;i<original.getRoot().listTextures().length;i++) {
  const x=original.getRoot().listTextures()[i],y=rig.getRoot().listTextures()[i];
  if(!y)throw Error('Rig lost a texture');
  const px=await sharp(x.getImage()).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const py=await sharp(y.getImage()).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  textures.push({index:i,sourceSize:x.getSize(),rigSize:y.getSize(),pixelsIdentical:JSON.stringify(px.info)===JSON.stringify(py.info)&&px.data.equals(py.data),bytesIdentical:sha(x.getImage())===sha(y.getImage())});
}
const skin=rig.getRoot().listSkins()[0];
if(rig.getRoot().listSkins().length!==1)throw Error('Expected exactly one skin');
const joints=skin.listJoints().map((node,index)=>({index,sourceName:node.getName(),threeName:PropertyBinding.sanitizeNodeName(node.getName()),parent:node.getParentNode()?.getName(),worldPosition:node.getWorldTranslation(),restTranslation:node.getTranslation(),restRotation:node.getRotation(),restScale:node.getScale()}));
let weightSumError=0,negativeWeights=0,invalidJointReferences=0,bindPoseError=0;
for(const node of rig.getRoot().listNodes()) {
  if(!node.getSkin())continue;
  const sk=node.getSkin(),ibm=sk.getInverseBindMatrices();
  const matrices=sk.listJoints().map((n,i)=>new Matrix4().fromArray(n.getWorldMatrix()).multiply(new Matrix4().fromArray(ibm.getElement(i,[]))));
  const nodeMatrix=new Matrix4().fromArray(node.getWorldMatrix());
  for(const primitive of node.getMesh().listPrimitives()) {
    const pos=primitive.getAttribute('POSITION'),indices=primitive.getAttribute('JOINTS_0'),weights=primitive.getAttribute('WEIGHTS_0');
    for(let i=0;i<pos.getCount();i++) {
      const p=new Vector3(...pos.getElement(i,[])),ji=indices.getElement(i,[]),w=weights.getElement(i,[]),deformed=new Vector3();
      weightSumError=Math.max(weightSumError,Math.abs(w.reduce((s,v)=>s+v,0)-1));
      for(let k=0;k<w.length;k++) {
        if(w[k]<0)negativeWeights++;
        if(!matrices[ji[k]]){invalidJointReferences++;continue;}
        deformed.addScaledVector(p.clone().applyMatrix4(matrices[ji[k]]),w[k]);
      }
      bindPoseError=Math.max(bindPoseError,deformed.distanceTo(p.clone().applyMatrix4(nodeMatrix)));
    }
  }
}
const tris=doc=>doc.getRoot().listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0);
const report={staticPath,rigPath,staticSha256:sha(await fs.readFile(staticPath)),rigSha256:sha(await fs.readFile(rigPath)),fitWidth:1,static:{vertices:a.points.length,triangles:tris(original),bounds:a.bounds},rig:{vertices:b.points.length,triangles:tris(rig),bounds:b.bounds,skins:rig.getRoot().listSkins().length,animations:rig.getRoot().listAnimations().length},rigToStatic:nearest(b.points,a.points),staticToRig:nearest(a.points,b.points),textures,skinIntegrity:{weightSumError,negativeWeights,invalidJointReferences,bindPoseMaxWorldError:bindPoseError},joints};
await fs.mkdir(path.dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({rigToStatic:report.rigToStatic,staticToRig:report.staticToRig,textures,skinIntegrity:report.skinIntegrity,joints:joints.map(j=>({name:j.sourceName,parent:j.parent,world:j.worldPosition.map(n=>+n.toFixed(3))}))}));
