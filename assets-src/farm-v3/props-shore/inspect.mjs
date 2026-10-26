import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {Vector3,Matrix3,Matrix4,Box3} from 'three';
const dir=path.dirname(fileURLToPath(import.meta.url));
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const d=await io.read(path.join(dir,'original/hayloft.glb'));await d.transform(dequantize());
const vertices=[],triangles=[],nodes=[];
for(const node of d.getRoot().listNodes()){
 const m=new Matrix4().fromArray(node.getWorldMatrix()),normalMatrix=new Matrix3().getNormalMatrix(m);
 nodes.push({name:node.getName(),mesh:node.getMesh()?.getName(),matrix:m.elements,determinant:m.determinant()});
 for(const prim of node.getMesh()?.listPrimitives()??[]){
  const position=prim.getAttribute('POSITION'),normal=prim.getAttribute('NORMAL'),uv=prim.getAttribute('TEXCOORD_0'),offset=vertices.length;
  for(let i=0;i<position.getCount();i++)vertices.push({p:new Vector3(...position.getElement(i,[])).applyMatrix4(m).toArray(),n:new Vector3(...normal.getElement(i,[])).applyNormalMatrix(normalMatrix).toArray(),uv:uv.getElement(i,[])});
  const idx=prim.getIndices()?.getArray()??Array.from({length:position.getCount()},(_,i)=>i);
  for(let i=0;i<idx.length;i+=3)triangles.push([idx[i]+offset,idx[i+1]+offset,idx[i+2]+offset]);
 }
}
const bounds=ids=>{const b=new Box3();for(const i of ids)b.expandByPoint(new Vector3(...vertices[i].p));return{min:b.min.toArray(),max:b.max.toArray(),size:b.getSize(new Vector3()).toArray()};};
function components(indices){
 const parent=indices.map((_,i)=>i),seen=new Map(),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
 for(const [j,i] of indices.entries())for(const v of triangles[i]){const key=vertices[v].p.map(n=>n.toFixed(5)).join(',');if(seen.has(key))parent[find(j)]=find(seen.get(key));else seen.set(key,j);}
 const groups=new Map();indices.forEach((t,i)=>{const key=find(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);});
 return [...groups.values()].sort((a,b)=>b.length-a.length).map(ids=>({triangles:ids.length,ids,bounds:bounds(ids.flatMap(i=>triangles[i]))}));
}
const all=triangles.map((_,i)=>i),top=all.filter(i=>triangles[i].every(v=>vertices[v].p[1]>1.965));
const report={nodes,vertices:vertices.length,triangles:triangles.length,bounds:bounds(vertices.map((_,i)=>i)),allComponents:components(all),topComponents:components(top),topThreshold:1.965,materials:d.getRoot().listMaterials().map(m=>({name:m.getName(),baseColor:m.getBaseColorFactor(),metallic:m.getMetallicFactor(),roughness:m.getRoughnessFactor(),doubleSided:m.getDoubleSided()})),textures:d.getRoot().listTextures().map(t=>({name:t.getName(),size:t.getSize(),mime:t.getMimeType(),bytes:t.getImage().length}))};
await fs.writeFile(path.join(dir,'source-inspection.json'),JSON.stringify(report,null,2)+'\n');
await fs.writeFile(path.join(dir,'source-geometry.json'),JSON.stringify({vertices,triangles})+'\n');
for(const [i,t] of d.getRoot().listTextures().entries())await fs.writeFile(path.join(dir,'original',`texture-${i}.webp`),t.getImage());
console.log(JSON.stringify({...report,allComponents:report.allComponents.map(({ids,...c})=>c),topComponents:report.topComponents.map(({ids,...c})=>c)},null,2));
