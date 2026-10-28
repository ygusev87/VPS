import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as T from 'three';
export const dir=path.dirname(fileURLToPath(import.meta.url));
export const sha=b=>createHash('sha256').update(b).digest('hex');
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
export const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
export const bytes=await fs.readFile(path.join(dir,'originals/tractor.glb'));
if(sha(bytes)!=='c5011b89177f9830e62a96bd7a71ddd0cdaadd0edc7931fdca1660e4e61d4802')throw Error('Source changed');
export const doc=await io.readBinary(bytes),root=doc.getRoot(),sourceNode=root.listNodes().find(n=>n.getMesh()),prim=sourceNode.getMesh().listPrimitives()[0];
export const matrix=new T.Matrix4().fromArray(sourceNode.getWorldMatrix()),inverse=matrix.clone().invert();
export const attr={};for(const s of prim.listSemantics())attr[s]=prim.getAttribute(s);
export const vertices=[];for(let i=0;i<attr.POSITION.getCount();i++)vertices.push({p:new T.Vector3(...attr.POSITION.getElement(i,[])).applyMatrix4(matrix).toArray(),n:attr.NORMAL.getElement(i,[]),uv:attr.TEXCOORD_0.getElement(i,[]),original:i});
export const triangles=[];const indices=prim.getIndices().getArray();for(let i=0;i<indices.length;i+=3)triangles.push({v:[vertices[indices[i]],vertices[indices[i+1]],vertices[indices[i+2]]],source:i/3});
export const key=p=>p.map(v=>Math.round(v*1e7)).join(',');
export function edgeMap(tris){const edges=new Map();for(let i=0;i<tris.length;i++)for(let j=0;j<3;j++){const a=key(tris[i].v[j].p),b=key(tris[i].v[(j+1)%3].p);if(a===b)continue;const k=[a,b].sort().join('|');if(!edges.has(k))edges.set(k,[]);edges.get(k).push({face:i,a,b,va:tris[i].v[j],vb:tris[i].v[(j+1)%3]});}return edges;}
export function topology(tris){const edges=edgeMap(tris);return {triangles:tris.length,edges:edges.size,openEdges:[...edges.values()].filter(e=>e.length===1).length,nonManifoldEdges:[...edges.values()].filter(e=>e.length>2).length,sameDirectionEdges:[...edges.values()].filter(e=>e.length===2&&e[0].a===e[1].a).length,degenerate:tris.filter(t=>new Set(t.v.map(v=>key(v.p))).size!==3).length};}
// Reuse previously reviewed semantic labels, then the same topology island cleanup.
const previous=JSON.parse(await fs.readFile(path.join(dir,'semantic-labels.json'),'utf8'));
if(previous.sourceSha256!==sha(bytes))throw Error('Semantic source hash mismatch');
if(previous.labels.length!==triangles.length)throw Error('Label/source mismatch');
export const labels=previous.labels.slice(),edges=edgeMap(triangles),adj=triangles.map(()=>new Set());
for(const es of edges.values())for(const a of es)for(const b of es)if(a.face!==b.face)adj[a.face].add(b.face);
export function components(label){const seen=new Set(),out=[];for(let i=0;i<labels.length;i++){if(labels[i]!==label||seen.has(i))continue;const stack=[i],group=[];while(stack.length){const j=stack.pop();if(seen.has(j)||labels[j]!==label)continue;seen.add(j);group.push(j);for(const k of adj[j])stack.push(k);}out.push(group);}return out.sort((a,b)=>b.length-a.length);}
for(const c of components('body').slice(1)){const neighbours=new Set(c.flatMap(i=>[...adj[i]]).map(i=>labels[i]).filter(l=>l!=='body'));if(neighbours.size===1)for(const i of c)labels[i]=[...neighbours][0];}
