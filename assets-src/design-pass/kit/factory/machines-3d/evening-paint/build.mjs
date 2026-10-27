import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS, EXTTextureWebP} from '@gltf-transform/extensions';
import {compressTexture, getBounds, meshopt, prune, weld, simplify} from '@gltf-transform/functions';
import {MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier} from 'meshoptimizer';
import * as T from 'three';
import sharp from 'sharp';
import validator from 'gltf-validator';
const {Brush, Evaluator, SUBTRACTION} = await import('/tmp/electro-factory-csg/node_modules/three-bvh-csg/src/index.js');
const dir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(dir, '../../../../../..');
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder, 'meshopt.decoder':MeshoptDecoder});
const evaluator = new Evaluator();
evaluator.useGroups = false;
const sha = data => createHash('sha256').update(data).digest('hex');
const tuning = JSON.parse(await fs.readFile(path.join(dir, 'tuning.json'), 'utf8'));

function extract(node, primitive) {
  const geometry = new T.BufferGeometry();
  for (const [semantic, attribute] of [['POSITION','position'], ['NORMAL','normal'], ['TEXCOORD_0','uv']]) {
    const accessor = primitive.getAttribute(semantic);
    geometry.setAttribute(attribute, new T.BufferAttribute(Float32Array.from(accessor.getArray()), accessor.getElementSize()));
  }
  geometry.setIndex(new T.BufferAttribute(Uint32Array.from(primitive.getIndices().getArray()), 1));
  geometry.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));
  return geometry;
}

function subtract(geometry, shape, position, rotation, uv) {
  for (let i=0; i<shape.attributes.uv.count; i++) shape.attributes.uv.setXY(i, ...uv);
  const a = new Brush(geometry), b = new Brush(shape);
  b.position.set(...position);
  b.rotation.set(...rotation);
  a.updateMatrixWorld(); b.updateMatrixWorld();
  return evaluator.evaluate(a, b, SUBTRACTION).geometry;
}

for (const name of process.argv.slice(2)) {
  const config = tuning[name];
  if (!config || !config.reviewed) throw new Error('Raw orientation and feature coordinates must be reviewed first: '+name);
  const source = path.join(repo, 'assets-src/raw/factory-evening-2026-10-27', name+'.glb');
  const raw = await fs.readFile(source), document = await io.readBinary(raw), root = document.getRoot();
  const meshNodes = root.listNodes().filter(n=>n.getMesh());
  if (meshNodes.length!==1 || meshNodes[0].getMesh().listPrimitives().length!==1 || root.listMaterials().length!==1) throw new Error('Inspect unexpected source structure');
  const sourceBounds = getBounds(root.listScenes()[0]);
  const primitive = meshNodes[0].getMesh().listPrimitives()[0], material = primitive.getMaterial(), buffer = root.listBuffers()[0];
  const sourceTriangles = primitive.getIndices().getCount()/3;
  let geometry = extract(meshNodes[0], primitive);
  geometry.rotateY(config.rotationY);
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new T.Vector3()), centre = geometry.boundingBox.getCenter(new T.Vector3()), floor = geometry.boundingBox.min.y;
  geometry.translate(-centre.x, -floor, -centre.z);
  geometry.scale(config.size[0]/size.x, config.size[1]/size.y, config.size[2]/size.z);
  if (name==='paint-booth') {
    geometry = subtract(geometry, new T.BoxGeometry(3.2, 1.004, 1.404), [0,.498,0], [0,0,0], config.cutUV);
  } else if (config.outlet) {
    const outlet = config.outlet;
    geometry = subtract(geometry, new T.CylinderGeometry(outlet.boreRadius,outlet.boreRadius,outlet.boreLength,32), outlet.boreCentre, [0,0,Math.PI/2], config.cutUV);
  }
  geometry.computeVertexNormals();
  for (const scene of root.listScenes()) for (const child of scene.listChildren()) scene.removeChild(child);
  for (const node of [...root.listNodes()]) node.dispose();
  for (const mesh of [...root.listMeshes()]) mesh.dispose();
  const output = document.createPrimitive().setMaterial(material);
  for (const [semantic, attribute] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]) {
    const a = geometry.attributes[attribute];
    output.setAttribute(semantic, document.createAccessor(name+'-'+semantic).setType(a.itemSize===2?'VEC2':'VEC3').setArray(Float32Array.from(a.array)).setBuffer(buffer));
  }
  const indices = geometry.index?.array || Array.from({length:geometry.attributes.position.count},(_,i)=>i);
  output.setIndices(document.createAccessor(name+'-indices').setType('SCALAR').setArray(Uint32Array.from(indices)).setBuffer(buffer));
  root.listScenes()[0].addChild(document.createNode(name+'-body').setMesh(document.createMesh(name+'-body').addPrimitive(output)));
  material.setName(name+'-paint').setRoughnessFactor(.62).setMetallicFactor(.15).setDoubleSided(false);
  material.setExtension('KHR_materials_volume',null); material.setExtension('KHR_materials_transmission',null);
  await document.transform(prune());
  const cutTriangles = indices.length/3;
  if (cutTriangles>3950) await document.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:3900/cutTriangles,error:.001}));
  for (const texture of root.listTextures()) await compressTexture(texture,{encoder:sharp,targetFormat:'webp',resize:[512,512],quality:90,effort:70});
  document.createExtension(EXTTextureWebP).setRequired(true);
  await document.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));
  const bytes = await io.writeBinary(document), check = await io.readBinary(bytes), validation = await validator.validateBytes(bytes,{uri:name+'.glb'}), r = check.getRoot();
  const report = {name,source:path.relative(repo,source),sourceSha256:sha(raw),sourceBytes:raw.length,sourceTriangles,sourceBounds,outputSha256:sha(bytes),bytes:bytes.length,cutTriangles,triangles:r.listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+p.getIndices().getCount()/3,0),materials:r.listMaterials().length,textures:r.listTextures().map(t=>({size:t.getSize(),mime:t.getMimeType()})),bounds:getBounds(r.listScenes()[0]),contract:config,validation:validation.issues};
  await fs.mkdir(path.join(dir,'candidate'),{recursive:true});
  await fs.writeFile(path.join(dir,'candidate',name+'.glb'),bytes);
  await fs.writeFile(path.join(dir,name+'-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({name,bytes:report.bytes,triangles:report.triangles,bounds:report.bounds,sha256:report.outputSha256,errors:validation.issues.numErrors}));
  if (report.triangles>4000 || report.materials!==1 || report.bytes>205000 || validation.issues.numErrors || validation.issues.numWarnings) throw new Error('Budget/validator failed');
}
