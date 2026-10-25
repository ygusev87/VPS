#!/usr/bin/env node
/** Fit the kitten's static hayloft to the existing lift, then compact it for mobile. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {NodeIO, Logger} from '@gltf-transform/core';
import {ALL_EXTENSIONS, EXTTextureWebP} from '@gltf-transform/extensions';
import {compressTexture, dequantize, getBounds, meshopt, simplify, weld} from '@gltf-transform/functions';
import {MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier} from 'meshoptimizer';
import {Matrix4, Vector3, Ray, Triangle} from 'three';
import sharp from 'sharp';

const [input, output] = process.argv.slice(2);
if (!input || !output || path.resolve(input) === path.resolve(output, 'hayloft.glb'))
  throw Error('Usage: build-hayloft.mjs RAW.glb OUTPUT_DIR');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder
});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function stats(doc, bytes) {
  const r=doc.getRoot();
  return {bytes, triangles:r.listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((n,p)=>
    n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0),
    meshes:r.listMeshes().length, materials:r.listMaterials().length,
    bounds:getBounds(r.listScenes()[0]),
    textures:r.listTextures().map(t=>({size:t.getSize(),mime:t.getMimeType(),bytes:t.getImage().length}))};
}
// Nine vertical rays over the kitten's actual standing area. Use node transforms
// after Meshopt quantization as well as the original float geometry.
function deckSamples(doc) {
  const samples=[];
  for (const x of [.08,.3,.52]) for (const z of [0,.2,.4]) {
    const ray=new Ray(new Vector3(x,5,z),new Vector3(0,-1,0));
    let top=-Infinity;
    for (const node of doc.getRoot().listNodes()) if(node.getMesh()) {
      const matrix=new Matrix4().fromArray(node.getWorldMatrix());
      for (const p of node.getMesh().listPrimitives()) {
        const pos=p.getAttribute('POSITION'),idx=p.getIndices();
        const count=idx?.getCount()??pos.getCount();
        for(let i=0;i<count;i+=3) {
          const v=[0,1,2].map(k=>new Vector3().fromArray(pos.getElement(idx?idx.getScalar(i+k):i+k,[])).applyMatrix4(matrix));
          // Only top-facing surfaces count as a floor.
          if(new Triangle(...v).getNormal(new Vector3()).y < .6) continue;
          const hit=ray.intersectTriangle(...v,false,new Vector3());
          if(hit)top=Math.max(top,hit.y);
        }
      }
    }
    if(!Number.isFinite(top))throw Error('Missing deck beneath kitten at '+x+','+z);
    samples.push({x,z,y:top});
  }
  return samples;
}
const raw=await fs.readFile(input),doc=await io.readBinary(raw),root=doc.getRoot();
doc.setLogger(new Logger(Logger.Verbosity.WARN));
if(root.listSkins().length||root.listAnimations().length||root.listMeshes().some(m=>m.listPrimitives().some(p=>p.listTargets().length)))
  throw Error('This calibration is for a static hayloft only');
await doc.transform(dequantize());
const meshNodes=root.listNodes().filter(n=>n.getMesh());
if(meshNodes.length!==1 || !meshNodes[0].getWorldMatrix().every((v,i)=>Math.abs(v-(i%5===0?1:0))<1e-7))
  throw Error('Expected the measured, single identity-transformed Studio mesh');
const before=stats(doc,raw.length);
const b=before.bounds, centerX=(b.min[0]+b.max[0])/2, centerZ=(b.min[2]+b.max[2])/2;
// Deck height measured at raw (x=.3/1.8,z=.2/1.8), not the maximum (hay/post).
const rawDeckY=.6698751546939745;
const targetDeckY=1.95;
const xzScale=Math.min(1.8/(b.max[0]-b.min[0]),1.5/(b.max[2]-b.min[2]));
const postYScale=targetDeckY/(rawDeckY-b.min[1]);
for(const p of meshNodes[0].getMesh().listPrimitives()) {
  const pos=p.getAttribute('POSITION'),normal=p.getAttribute('NORMAL');
  const positions=new Float32Array(pos.getCount()*3);
  const normals=normal?new Float32Array(normal.getCount()*3):null;
  for(let i=0;i<pos.getCount();i++) {
    const [x,y,z]=pos.getElement(i,[]),below=y<=rawDeckY;
    positions.set([(x-centerX)*xzScale,
      below?(y-b.min[1])*postYScale:targetDeckY+(y-rawDeckY)*xzScale,
      (z-centerZ)*xzScale],i*3);
    if(normal) {
      const [nx,ny,nz]=normal.getElement(i,[]);
      const n=new Vector3(nx/xzScale,ny/(below?postYScale:xzScale),nz/xzScale).normalize();
      normals.set(n.toArray(),i*3);
    }
  }
  pos.setArray(positions);
  if(normal)normal.setArray(normals);
}
const fittedDeck=deckSamples(doc);
await fs.mkdir(path.join(output,'before'),{recursive:true});
await fs.writeFile(path.join(output,'before/hayloft.glb'),await io.writeBinary(doc));
for(const texture of root.listTextures())
  await compressTexture(texture,{encoder:sharp,targetFormat:'webp',resize:[512,512],quality:88,effort:70});
doc.createExtension(EXTTextureWebP).setRequired(true);
await doc.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:2200/before.triangles,error:.0015}),
  meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));
const bytes=await io.writeBinary(doc),ready=await io.readBinary(bytes);
const samples=deckSamples(ready);
if(samples.some(s=>Math.abs(s.y-targetDeckY)>.025))throw Error('Deck no longer matches lift within .025');
await fs.writeFile(path.join(output,'hayloft.glb'),bytes);
const report={name:'hayloft',sourceSha256:sha(raw),outputSha256:sha(bytes),before,after:stats(ready,bytes.length),
  calibration:{rawDeckY,targetDeckY,xzScale,postYScale,
    method:'Stretch posts below the measured deck. Preserve hay proportions above the deck with uniform XZ scale.',
    fittedDeck,outputDeck:samples},
  anchors:{base:[0,0,0],kittenFeet:[.3,1.95,.2],liftRelative:[2.3,0,.25],deckY:1.95,
    worldOrigin:[-21.3,0,-16.25],fit:{},rotateY:0,front:'+Z'},
  notes:['Static GLB. Already in game units: model(hayloft,{}) without extra height/width fitting.',
    '512px color WebP, Meshopt, one material. Full-resolution calibrated source in before/ is QA-only.',
    'No roof or ladder: kitten visible, lift remains necessary. Asset counts are not measured iPad FPS.']};
await fs.writeFile(path.join(output,'model-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({before:report.before,after:report.after,deck:report.calibration.outputDeck},null,2));
