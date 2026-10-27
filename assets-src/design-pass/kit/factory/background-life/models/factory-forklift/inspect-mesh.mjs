import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import * as T from 'three';
import sharp from 'sharp';
const dir=path.dirname(fileURLToPath(import.meta.url));
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const doc=await io.read(path.join(dir,'candidate/factory-forklift.glb'));
const node=doc.getRoot().listNodes().find(n=>n.getMesh()),p=node.getMesh().listPrimitives()[0];
const pos=p.getAttribute('POSITION'),uv=p.getAttribute('TEXCOORD_0'),world=new T.Matrix4().fromArray(node.getWorldMatrix());
const {data,info}=await sharp(p.getMaterial().getBaseColorTexture().getImage()).removeAlpha().raw().toBuffer({resolveWithObject:true});
const points=[],colors=[],triangles=[];
for(let i=0;i<pos.getCount();i++){
  points.push(new T.Vector3(...pos.getElement(i,[])).applyMatrix4(world).toArray());
  const [u,v]=uv.getElement(i,[]),x=Math.max(0,Math.min(info.width-1,Math.round(u*(info.width-1)))),y=Math.max(0,Math.min(info.height-1,Math.round(v*(info.height-1)))),at=(y*info.width+x)*info.channels;
  colors.push([...data.subarray(at,at+3)]);
}
const indices=p.getIndices().getArray();for(let i=0;i<indices.length;i+=3)triangles.push([...indices.slice(i,i+3)]);
const par=points.map((_,i)=>i),seen=new Map(),find=i=>par[i]===i?i:(par[i]=find(par[i])),join=(a,b)=>par[find(a)]=find(b);
points.forEach((v,i)=>{const k=v.map(x=>Math.round(x*1e4)).join(',');if(seen.has(k))join(i,seen.get(k));else seen.set(k,i)});
for(const [a,b,c] of triangles){join(a,b);join(b,c)}
const groups=new Map();triangles.forEach((t,i)=>{const key=find(t[0]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i)});
const components=[...groups.values()].map(ids=>{const ps=ids.flatMap(i=>triangles[i].map(v=>points[v]));return {triangleIds:ids,triangles:ids.length,min:[0,1,2].map(a=>Math.min(...ps.map(p=>p[a]))),max:[0,1,2].map(a=>Math.max(...ps.map(p=>p[a])))}}).sort((a,b)=>b.triangles-a.triangles);
await fs.writeFile(path.join(dir,'candidate/geometry.json'),JSON.stringify({points,colors,triangles,components}));
console.log(JSON.stringify(components.map(({triangleIds,...c})=>c),null,2));
