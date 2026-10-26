#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {compressTexture,getBounds,meshopt,prune,weld} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {Vector2,ShapeUtils} from 'three';
import sharp from 'sharp';
import validator from 'gltf-validator';
const dir=path.dirname(fileURLToPath(import.meta.url));
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const sha=b=>createHash('sha256').update(b).digest('hex');
const stats=d=>({triangles:d.getRoot().listMeshes().reduce((a,m)=>a+m.listPrimitives().reduce((s,p)=>s+p.getIndices().getCount()/3,0),0),meshes:d.getRoot().listMeshes().length,materials:d.getRoot().listMaterials().length,bounds:getBounds(d.getRoot().listScenes()[0]),textures:d.getRoot().listTextures().map(t=>({size:t.getSize(),mime:t.getMimeType(),bytes:t.getImage().length})),nodes:d.getRoot().listNodes().map(n=>({name:n.getName(),translation:n.getTranslation(),rotation:n.getRotation(),scale:n.getScale()}))});
const key=v=>v.p.map(x=>x.toFixed(5)).join(',');
function lerp(a,b,t){return {p:a.p.map((v,i)=>v+(b.p[i]-v)*t),n:a.n.map((v,i)=>v+(b.n[i]-v)*t),uv:a.uv.map((v,i)=>v+(b.uv[i]-v)*t)}}
// Clip triangles at the narrow shoulder collars, preserving original UVs.
function clip(poly,axis,value,sign){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a.p[axis]-value)*sign,db=(b.p[axis]-value)*sign;if(da>=-1e-9)out.push(a);if((da>1e-9&&db< -1e-9)||(da< -1e-9&&db>1e-9))out.push(lerp(a,b,da/(da-db)));}return out;}
function triangles(poly){const out=[];for(let i=1;i<poly.length-1;i++)out.push([poly[0],poly[i],poly[i+1]]);return out;}
function components(tris){const parents=tris.map((_,i)=>i),seen=new Map(),root=i=>parents[i]===i?i:(parents[i]=root(parents[i]));for(let i=0;i<tris.length;i++)for(const v of tris[i]){const k=key(v);if(seen.has(k))parents[root(i)]=root(seen.get(k));else seen.set(k,i);}const groups=new Map();tris.forEach((t,i)=>{const k=root(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(t);});return [...groups.values()];}
function cap(polys,plane,sign){const edges=new Map();for(const tri of polys)for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3];if(Math.abs(a.p[2]-plane)>1e-7||Math.abs(b.p[2]-plane)>1e-7||a.p[1]<.28||b.p[1]<.28)continue;const ka=key(a),kb=key(b),k=[ka,kb].sort().join('|');if(edges.has(k))edges.delete(k);else edges.set(k,[a,b]);}
 const loops=[];const remaining=[...edges.values()];while(remaining.length){const [a,b]=remaining.pop(),loop=[a,b];let last=key(b);while(last!==key(a)){const i=remaining.findIndex(e=>e.some(v=>key(v)===last));if(i<0)throw Error('Open shoulder boundary '+JSON.stringify({plane,sign,start:key(a),last,loop:loop.map(v=>v.p),remaining:remaining.map(e=>e.map(v=>v.p))}));const e=remaining.splice(i,1)[0],next=key(e[0])===last?e[1]:e[0];loop.push(next);last=key(next);if(loop.length>1000)throw Error('Invalid boundary');}loop.pop();loops.push(loop);}
 const added=[];for(const loop of loops){const uv=loop.reduce((s,v)=>s.map((n,i)=>n+v.uv[i]/loop.length),[0,0]);const contour=loop.map(v=>new Vector2(v.p[0],v.p[1]));for(const ids of ShapeUtils.triangulateShape(contour,[])){let t=ids.map(i=>({p:[...loop[i].p],n:[0,0,sign],uv:[...uv]}));const a=t[0].p,b=t[1].p,c=t[2].p;if(((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))*sign<0)t.reverse();added.push(t);}}
 return {triangles:added,loops:loops.map(l=>({vertices:l.length,center:[0,1,2].map(i=>l.reduce((s,v)=>s+v.p[i]/l.length,0))}))};}
for(const name of process.argv.slice(2).length?process.argv.slice(2):['frog','crow']){
 if(!['frog','crow'].includes(name))throw Error('Unknown animal');
 const raw=await fs.readFile(path.join(dir,'raw',name+'.glb')),d=await io.readBinary(raw),r=d.getRoot(),before=stats(d),scene=r.listScenes()[0];
 if(r.listSkins().length||r.listAnimations().length)throw Error('Static source required');
 const source=r.listMeshes()[0].listPrimitives()[0];if(r.listMeshes().length!==1||r.listMeshes()[0].listPrimitives().length!==1)throw Error('Expected one primitive');
 const pos=source.getAttribute('POSITION'),normal=source.getAttribute('NORMAL'),uv=source.getAttribute('TEXCOORD_0'),idx=source.getIndices().getArray();
 // Studio nose +Z -> +X, positive uniform orientation. Original Y=0 retained.
 const verts=Array.from({length:pos.getCount()},(_,i)=>{const p=pos.getElement(i,[]),n=normal.getElement(i,[]);return {p:[p[2],p[1],-p[0]],n:[n[2],n[1],-n[0]],uv:uv.getElement(i,[])}});
 const tris=[];for(let i=0;i<idx.length;i+=3)tris.push([verts[idx[i]],verts[idx[i+1]],verts[idx[i+2]]]);
 const parts={body:[]},pivots={},caps={};
 if(name==='frog')parts.body=tris;
 else{
  const cut=.14;
  parts['wing-left']=[];parts['wing-right']=[];
  const outside={'wing-left':[],'wing-right':[]};
  for(let sourceIndex=0;sourceIndex<tris.length;sourceIndex++){const tri=tris[sourceIndex];
   for(const [part,sign] of [['wing-left',1],['wing-right',-1]])for(const fragment of triangles(clip(tri,2,cut*sign,sign))){fragment.sourceIndex=sourceIndex;outside[part].push(fragment);}
  }
  // Keep the entire connected wing, including low feather tips. Other outside
  // components (toes and belly feather relief) stay in the body.
  const wingSources=new Set();for(const part of ['wing-left','wing-right'])for(const component of components(outside[part])){
   const isWing=component.some(t=>t.some(v=>Math.abs(v.p[2])>.3&&v.p[1]>.28));
   if(isWing){parts[part].push(...component);for(const t of component)wingSources.add(t.sourceIndex);}
  }
  tris.forEach((tri,i)=>parts.body.push(...(wingSources.has(i)?triangles(clip(clip(tri,2,-cut,1),2,cut,-1)):[tri])));
  for(const [part,plane,normalSign] of [['body',cut,1],['body',-cut,-1],['wing-left',cut,-1],['wing-right',-cut,1]]){
   const c=cap(parts[part],plane,normalSign);parts[part].push(...c.triangles);caps[part+':'+plane]={triangles:c.triangles.length,loops:c.loops};if(part!=='body'){if(c.loops.length!==1)throw Error(part+': expected single shoulder loop');pivots[part]=c.loops[0].center;}
  }
 }
 const material=source.getMaterial();material.setName(name+'-paint').setRoughnessFactor(.78).setMetallicFactor(0).setDoubleSided(false);
 const buffer=r.listBuffers()[0];for(const node of [...scene.listChildren()])scene.removeChild(node);
 for(const [namePart,ts] of Object.entries(parts)){
  if(!ts.length)throw Error('Empty part '+namePart);const pivot=pivots[namePart]??[0,0,0],arrays={POSITION:[],NORMAL:[],TEXCOORD_0:[]};
  for(const tri of ts)for(const v of tri){arrays.POSITION.push(...v.p.map((x,i)=>x-pivot[i]));const l=Math.hypot(...v.n);arrays.NORMAL.push(...v.n.map(x=>x/l));arrays.TEXCOORD_0.push(...v.uv);}
  const prim=d.createPrimitive().setMaterial(material);for(const [semantic,array] of Object.entries(arrays))prim.setAttribute(semantic,d.createAccessor().setType(semantic==='TEXCOORD_0'?'VEC2':'VEC3').setArray(new Float32Array(array)).setBuffer(buffer));
  prim.setIndices(d.createAccessor().setType('SCALAR').setArray(new Uint32Array(ts.length*3).map((_,i)=>i)).setBuffer(buffer));
  const child=d.createNode(namePart+'-mesh').setMesh(d.createMesh(namePart+'-geometry').addPrimitive(prim));const parent=d.createNode(namePart).setTranslation(pivot).addChild(child);scene.addChild(parent);
 }
 await d.transform(prune(),weld());
 for(const t of r.listTextures())await compressTexture(t,{encoder:sharp,targetFormat:'webp',resize:[512,512],quality:90,effort:70});
 d.createExtension(EXTTextureWebP).setRequired(true);
 await fs.writeFile(path.join(dir,'raw',name+'-canonical.glb'),await io.writeBinary(d));
 await d.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));
 const bottom=getBounds(scene).min[1];for(const node of scene.listChildren()){if(node.getName()==='body'){const child=node.listChildren()[0],t=child.getTranslation();child.setTranslation([t[0],t[1]-bottom,t[2]]);}else{const t=node.getTranslation();node.setTranslation([t[0],t[1]-bottom,t[2]]);pivots[node.getName()]=node.getTranslation();}}
 const final=await io.writeBinary(d);await fs.writeFile(path.join(dir,'candidate',name+'.glb'),final);
 const finalDoc=await io.readBinary(final),after=stats(finalDoc),validation=await validator.validateBytes(final,{uri:name+'.glb'});
 const report={name,sourceSha256:sha(raw),candidateSha256:sha(final),bytes:final.length,sourceBytes:raw.length,yawDegrees:90,forward:'+X',up:'+Y',before,after,pivots,caps,validation:validation.issues};
 await fs.writeFile(path.join(dir,name+'-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({name,bytes:final.length,triangles:after.triangles,pivots,validation:validation.issues}));
 if(validation.issues.numErrors)throw Error('Validation failed');
}
