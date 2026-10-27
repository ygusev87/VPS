import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {getBounds} from '@gltf-transform/functions';
import * as T from 'three';
const dir=path.dirname(fileURLToPath(import.meta.url));
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),source=path.resolve(dir,'../../../../../../../assets-src/raw/factory-background-2026-10-27/factory-forklift-segmented.glb');
const doc=await io.read(source),root=doc.getRoot(),bounds=getBounds(root.listScenes()[0]),scale=2.2/(bounds.max[1]-bounds.min[1]);
const rot=new T.Matrix4().makeRotationY(Math.PI/2),parts=[];
for(const n of root.listNodes()){
 if(!n.getMesh())continue;const m=new T.Matrix4().fromArray(n.getWorldMatrix()),ps=[],tris=[];
 for(const p of n.getMesh().listPrimitives()){const a=p.getAttribute('POSITION'),offset=ps.length;for(let i=0;i<a.getCount();i++)ps.push(new T.Vector3(...a.getElement(i,[])).applyMatrix4(m).applyMatrix4(rot).multiplyScalar(scale).toArray());const ix=p.getIndices().getArray();for(let i=0;i<ix.length;i+=3)tris.push([...ix.slice(i,i+3)].map(j=>j+offset));}
 parts.push({name:n.getName(),triangles:tris.length,min:[0,1,2].map(a=>Math.min(...ps.map(p=>p[a]))),max:[0,1,2].map(a=>Math.max(...ps.map(p=>p[a]))),points:ps,indices:tris});
}
await fs.writeFile(path.join(dir,'candidate/segments-geometry.json'),JSON.stringify({source,bounds,scale,parts}));
console.log(JSON.stringify({materials:root.listMaterials().length,textures:root.listTextures().length,bounds,parts:parts.map(({points,indices,...p})=>p)},null,2));
