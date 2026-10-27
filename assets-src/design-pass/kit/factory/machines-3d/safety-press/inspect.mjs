import {NodeIO} from '@gltf-transform/core';
import * as T from 'three';
const d=await new NodeIO().read('assets-src/raw/factory-2026-10-27/safety-press.glb');
const p=d.getRoot().listMeshes()[0].listPrimitives()[0],pos=p.getAttribute('POSITION'),ind=p.getIndices().getArray();
const tris=[];for(let i=0;i<ind.length;i+=3)tris.push(new T.Triangle(...[0,1,2].map(k=>new T.Vector3(...pos.getElement(ind[i+k],[])))));
function hits(x,z){const ray=new T.Ray(new T.Vector3(x,2,z),new T.Vector3(0,-1,0));return tris.flatMap(t=>{const q=ray.intersectTriangle(t.a,t.b,t.c,false,new T.Vector3());return q?[q.y]:[]}).sort((a,b)=>a-b);}
console.log(JSON.stringify({rays:[[-.35,0],[0,0],[0,.05],[0,-.05],[.35,0],[0,.1],[0,-.1]].map(([x,z])=>({x,z,y:hits(x,z)})),bins:Array.from({length:20},(_,i)=>{const ys=[];for(let j=0;j<pos.getCount();j++){const v=pos.getElement(j,[]);if(v[1]>=i*.05&&v[1]<(i+1)*.05)ys.push(v[0]);}return{i,y:i*.05,count:ys.length,minX:Math.min(...ys),maxX:Math.max(...ys)}})},null,2));
