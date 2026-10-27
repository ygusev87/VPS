import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as T from 'three';
import sharp from 'sharp';
const dir=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(dir,'../../../../../../..');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read(path.join(repo,'assets-src/raw/factory-background-2026-10-27/factory-forklift.glb'));
const n=doc.getRoot().listNodes().find(n=>n.getMesh()),p=n.getMesh().listPrimitives()[0],pos=p.getAttribute('POSITION'),uv=p.getAttribute('TEXCOORD_0'),norm=p.getAttribute('NORMAL');
const transform=new T.Matrix4().makeRotationY(Math.PI/2).multiply(new T.Matrix4().fromArray(n.getWorldMatrix()));
const points=[],uvs=[],normals=[];
for(let i=0;i<pos.getCount();i++){points.push(new T.Vector3(...pos.getElement(i,[])).applyMatrix4(transform).toArray());uvs.push(uv.getElement(i,[]));normals.push(new T.Vector3(...norm.getElement(i,[])).transformDirection(transform).toArray())}
const box=new T.Box3().setFromPoints(points.map(p=>new T.Vector3(...p))),centre=box.getCenter(new T.Vector3()),scale=2.2/(box.max.y-box.min.y);
for(const p of points){p[0]=(p[0]-centre.x)*scale;p[1]=(p[1]-box.min.y)*scale;p[2]=(p[2]-centre.z)*scale}
const seg=JSON.parse(await fs.readFile(path.join(dir,'candidate/segments-geometry.json'),'utf8'));
const allSegments=seg.parts.flatMap(part=>part.indices.map(t=>({name:part.name,ps:t.map(i=>part.points[i])})));
const key=ps=>ps.map(p=>p.map(x=>x.toFixed(4)).join(',')).sort().join('|'),labels=new Map();
for(const part of seg.parts)for(const t of part.indices)labels.set(key(t.map(i=>part.points[i])),part.name);
const {data,info}=await sharp(p.getMaterial().getBaseColorTexture().getImage()).removeAlpha().raw().toBuffer({resolveWithObject:true});
const sample=([u,v])=>{const x=Math.max(0,Math.min(info.width-1,Math.round(u*(info.width-1)))),y=Math.max(0,Math.min(info.height-1,Math.round(v*(info.height-1)))),at=(y*info.width+x)*info.channels;return [...data.subarray(at,at+3)]};
const triangles=[],ix=p.getIndices().getArray();for(let i=0;i<ix.length;i+=3){const ids=[...ix.slice(i,i+3)],ps=ids.map(i=>points[i]);const c=[0,1,2].map(a=>ps.reduce((s,p)=>s+p[a],0)/3),color=sample([0,1].map(a=>ids.reduce((s,i)=>s+uvs[i][a],0)/3));let label=labels.get(key(ps));if(!label){const match=allSegments.find(t=>ps.every(v=>t.ps.some(w=>v.every((x,a)=>Math.abs(x-w[a])<.0003))));label=match?.name||'unmatched';}const isBeige=color[0]>=color[1]-8&&color[1]>=color[2]-8&&Math.max(...color)-Math.min(...color)<70&&Math.min(...color)>50;const moving=i/3===152||['tripo_part_12','tripo_part_13'].includes(label)||(label==='tripo_part_1'&&c[1]<1.1&&c[2]>.6&&isBeige&&ps.every(v=>v[1]<1));triangles.push({ids,centroid:c,color,label,moving});}
await fs.writeFile(path.join(dir,'candidate/split-analysis.json'),JSON.stringify({points,normals,uvs,triangles}));
console.log(JSON.stringify({triangles:triangles.length,unmatched:triangles.filter(t=>t.label==='unmatched').length,moving:triangles.filter(t=>t.moving).length,carriage:triangles.filter(t=>t.moving&&t.label==='tripo_part_1').length,carriageTriangles:triangles.map((t,i)=>({...t,id:i})).filter(t=>t.label==='tripo_part_1'&&t.centroid[1]<1.1)},null,2));
