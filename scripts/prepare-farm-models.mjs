#!/usr/bin/env node
/**
 * Canonical orientation and mesh compression for NEW static Tripo farm assets.
 * Run before optimize-mobile-models.mjs. Existing game assets/rigs must not enter this pass.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
const [input, output, specFile, ...names] = process.argv.slice(2);
if (!input || !output || !specFile || !names.length) throw Error('Usage: prepare-farm-models.mjs INPUT OUTPUT SPEC.json names...');
if (path.resolve(input) === path.resolve(output)) throw Error('Keep original source files; input and output must differ.');
const spec = JSON.parse(await fs.readFile(specFile, 'utf8'));
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
await fs.mkdir(output,{recursive:true});
for (const name of names) {
  if (!/^[a-z0-9-]+$/.test(name) || !Object.hasOwn(spec,name)) throw Error('Unknown model: '+name);
  const doc = await io.read(path.join(input,name+'.glb')), root=doc.getRoot();
  if (root.listSkins().length || root.listAnimations().length) throw Error(name+': this pass is for static assets only.');
  if(spec[name].baseColorPath){
    const textures=new Set(root.listMaterials().map(m=>m.getBaseColorTexture()).filter(Boolean));
    if(textures.size!==1)throw Error(name+': expected exactly one color atlas.');
    for(const t of textures)t.setImage(await fs.readFile(spec[name].baseColorPath)).setMimeType('image/png');
  }
  const yaw = (spec[name].yawDegrees ?? 0)*Math.PI/180;
  for (const scene of root.listScenes()) {
    const children=scene.listChildren();
    const orient=doc.createNode('FarmOrientation').setRotation([0,Math.sin(yaw/2),0,Math.cos(yaw/2)]);
    for(const child of children){scene.removeChild(child);orient.addChild(child);}
    scene.addChild(orient);
    if(spec[name].footprint){
      const b=getBounds(scene),size=b.max.map((v,i)=>v-b.min[i]),fit=spec[name].footprint;
      const fitted=doc.createNode('FarmFootprint').setScale([fit[0]/size[0],fit[0]/size[0],fit[1]/size[2]]);
      scene.removeChild(orient);fitted.addChild(orient);scene.addChild(fitted);
    }
  }
  if(spec[name].module){
    const m=spec[name].module;
    for(const scene of root.listScenes()){
      const b=getBounds(scene),sx=m.pitch/(b.max[0]-m.sourcePostCenterX),sy=m.height/(b.max[1]-b.min[1]);
      const transform=doc.createNode('FarmModuleOrigin').setScale([sx,sy,sx]).setTranslation([-m.sourcePostCenterX*sx,-b.min[1]*sy,-(b.min[2]+b.max[2])/2*sx]);
      for(const child of scene.listChildren()){scene.removeChild(child);transform.addChild(child);}scene.addChild(transform);
      scene.setExtras({...scene.getExtras(),farmModule:{pitch:m.pitch,postAxisX:0,height:m.height,forward:'+x'}});
    }
  }
  if(spec[name].placement){
    const p=spec[name].placement;
    for(const scene of root.listScenes()){
      const transform=doc.createNode('FarmSharedOrigin').setScale(p.scale).setTranslation(p.translation);
      for(const child of scene.listChildren()){scene.removeChild(child);transform.addChild(child);}scene.addChild(transform);
    }
  }
  await doc.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));
  await io.write(path.join(output,name+'.glb'),doc);
  console.log(JSON.stringify({name,yawDegrees:spec[name].yawDegrees??0,bounds:getBounds(root.listScenes()[0])}));
}
