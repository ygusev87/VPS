import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {getBounds} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
const dir=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(dir,'../../../../../..');
const names=process.argv.slice(2);await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
for(const name of names){const d=await io.read(path.join(repo,'assets-src/raw/factory-2026-10-27',name+'.glb')),r=d.getRoot(),islands=[];
for(const mesh of r.listMeshes())for(const p of mesh.listPrimitives()){
 const pos=p.getAttribute('POSITION'),ind=p.getIndices().getArray(),parent=Array.from({length:pos.getCount()},(_,i)=>i),same=new Map();
 function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i]}return i}function join(a,b){parent[root(a)]=root(b)}
 for(let i=0;i<pos.getCount();i++){const k=pos.getElement(i,[]).map(v=>Math.round(v*1e5)).join(',');if(same.has(k))join(i,same.get(k));else same.set(k,i)}
 for(let i=0;i<ind.length;i+=3){join(ind[i],ind[i+1]);join(ind[i+1],ind[i+2]);}
 const components=new Map();for(let i=0;i<ind.length;i+=3){const k=root(ind[i]);if(!components.has(k))components.set(k,{triangles:0,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});const c=components.get(k);c.triangles++;for(let j=0;j<3;j++){const v=pos.getElement(ind[i+j],[]);for(let a=0;a<3;a++){c.min[a]=Math.min(c.min[a],v[a]);c.max[a]=Math.max(c.max[a],v[a]);}}}islands.push(...components.values());
}
const report={name,bounds:getBounds(r.listScenes()[0]),nodes:r.listNodes().map(n=>({name:n.getName(),translation:n.getTranslation(),rotation:n.getRotation(),scale:n.getScale()})),triangles:r.listMeshes().flatMap(m=>m.listPrimitives()).reduce((s,p)=>s+p.getIndices().getCount()/3,0),materials:r.listMaterials().length,textures:r.listTextures().map(t=>({size:t.getSize(),mime:t.getMimeType()})),islands:islands.sort((a,b)=>b.triangles-a.triangles)};await fs.writeFile(path.join(dir,name+'-raw-inspection.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
