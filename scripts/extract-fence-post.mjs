#!/usr/bin/env node
/** Extract and close the end post from the generated fence, without another generation. */
import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {prune} from '@gltf-transform/functions';
import {ShapeUtils,Vector2} from 'three';
const [input,output,planeText='.36']=process.argv.slice(2),plane=Number(planeText);
if(!input||!output||input===output||!Number.isFinite(plane))throw Error('Usage: extract-fence-post.mjs INPUT OUTPUT [z-plane]');
const io=new NodeIO(),doc=await io.read(input),root=doc.getRoot();
if(root.listSkins().length||root.listAnimations().length)throw Error('Static source required.');
const eps=1e-7,key=p=>p.map(x=>Math.round(x*1e5)).join(',');
let caps=0;
for(const m of root.listMeshes())for(const prim of m.listPrimitives()){
 const pa=prim.getAttribute('POSITION'),na=prim.getAttribute('NORMAL'),uv=prim.getAttribute('TEXCOORD_0');
 const ids=prim.getIndices()?.getArray()??Array.from({length:pa.getCount()},(_,i)=>i),P=[],N=[],U=[],segments=[];
 const vertex=i=>({p:pa.getElement(i,[]),n:na.getElement(i,[]),u:uv.getElement(i,[])});
 const lerp=(a,b,t)=>({p:a.p.map((x,i)=>x+(b.p[i]-x)*t),n:a.n.map((x,i)=>x+(b.n[i]-x)*t),u:a.u.map((x,i)=>x+(b.u[i]-x)*t)});
 const emit=(a,b,c)=>{for(const v of[a,b,c]){P.push(...v.p);const l=Math.hypot(...v.n);N.push(...v.n.map(x=>x/l));U.push(...v.u);}};
 for(let i=0;i<ids.length;i+=3){
  const tri=[vertex(ids[i]),vertex(ids[i+1]),vertex(ids[i+2])],poly=[],cuts=[];
  for(let j=0;j<3;j++){
   const a=tri[j],b=tri[(j+1)%3],ia=a.p[2]>=plane-eps,ib=b.p[2]>=plane-eps;
   if(ia)poly.push(a);
   if(ia!==ib){const v=lerp(a,b,(plane-a.p[2])/(b.p[2]-a.p[2]));v.p[2]=plane;poly.push(v);cuts.push(v);}
  }
  for(let j=1;j<poly.length-1;j++)emit(poly[0],poly[j],poly[j+1]);
  if(cuts.length===2&&key(cuts[0].p)!==key(cuts[1].p))segments.push(cuts);
 }
 const verts=new Map(),edges=new Map();
 for(const[a,b]of segments){const ka=key(a.p),kb=key(b.p);verts.set(ka,a);verts.set(kb,b);if(!edges.has(ka))edges.set(ka,new Set());if(!edges.has(kb))edges.set(kb,new Set());edges.get(ka).add(kb);edges.get(kb).add(ka);}
 if([...edges.values()].some(s=>s.size!==2))throw Error('Cut boundary is not a collection of closed loops.');
 const unseen=new Set(edges.keys());
 while(unseen.size){
  const start=unseen.values().next().value,loop=[];let curr=start,previous=null;
  do{loop.push(verts.get(curr));unseen.delete(curr);const next=[...edges.get(curr)].find(k=>k!==previous);previous=curr;curr=next;if(loop.length>edges.size)throw Error('Boundary traversal failed.');}while(curr!==start);
  const points=loop.map(v=>new Vector2(v.p[0],v.p[1])),faces=ShapeUtils.triangulateShape(points,[]);
  for(let[a,b,c]of faces){const ab=points[b].clone().sub(points[a]),ac=points[c].clone().sub(points[a]);if(ab.x*ac.y-ab.y*ac.x>0)[b,c]=[c,b];emit(...[a,b,c].map(i=>({p:loop[i].p,n:[0,0,-1],u:loop[0].u})));}caps++;
 }
 const buffer=pa.getBuffer();
 prim.setAttribute('POSITION',doc.createAccessor().setType('VEC3').setBuffer(buffer).setArray(new Float32Array(P)));
 prim.setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setBuffer(buffer).setArray(new Float32Array(N)));
 prim.setAttribute('TEXCOORD_0',doc.createAccessor().setType('VEC2').setBuffer(buffer).setArray(new Float32Array(U)));
 prim.setIndices(doc.createAccessor().setType('SCALAR').setBuffer(buffer).setArray(Uint16Array.from({length:P.length/3},(_,i)=>i)));
 console.log(JSON.stringify({triangles:P.length/9,closedCutLoops:caps,plane}));
}
await doc.transform(prune());await io.write(output,doc);
