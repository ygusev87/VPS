/** Full opaque house-c geometry, uniformly fitted like runtime model(). */
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import * as T from 'three';
import validator from 'gltf-validator';
const dir=path.dirname(fileURLToPath(import.meta.url)),file=path.join(dir,'../../../public/models/house-c.glb');
const decor=await fs.readFile(path.join(dir,'../../../src/city-decor.ts'),'utf8');
assert(decor.includes("{ model: 'house-c', fit: { width: 5, rotateY: -Math.PI / 2 }, items: [[-20, -30, 0, 1], [6, 32, 0, 1], [50, 32.2, 0, 1]] }"), 'Unexpected house-c placements or fit');
await MeshoptDecoder.ready;const bytes=await fs.readFile(file),doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(file),root=doc.getRoot();
assert.equal(root.listSkins().length+root.listAnimations().length,0);
const points=[],parts=[];let triangles=0;
for(const n of root.listNodes())if(n.getMesh()){
 const m=new T.Matrix4().makeRotationY(-Math.PI/2).multiply(new T.Matrix4().fromArray(n.getWorldMatrix()));assert(m.determinant()>0);
 for(const p of n.getMesh().listPrimitives()){const pos=p.getAttribute('POSITION'),v=[];for(let i=0;i<pos.getCount();i++)v.push(new T.Vector3(...pos.getElement(i,[])).applyMatrix4(m));points.push(...v);parts.push({v,indices:p.getIndices()});triangles+=(p.getIndices()?.getCount()??pos.getCount())/3;}
}
const rawBox=new T.Box3().setFromPoints(points),center=rawBox.getCenter(new T.Vector3()),scale=5/rawBox.getSize(new T.Vector3()).x,meshes=[];
for(const p of parts){const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(p.v.flatMap(v=>[(v.x-center.x)*scale,(v.y-rawBox.min.y)*scale,(v.z-center.z)*scale]),3));if(p.indices)g.setIndex([...p.indices.getArray()]);const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld(true);meshes.push(mesh);}
const box=new T.Box3();meshes.forEach(m=>box.union(new T.Box3().setFromObject(m)));const size=box.getSize(new T.Vector3()),round=n=>Math.round(n*10000)/10000;
const roadRects=[[-23,-15,23,-9],[-23,9,23,15],[-23,-15,-17,15],[17,-15,23,15],[-3,-37.5,3,-12],[-3,12,3,37.5],[-55,-3,-20,3],[20,-3,55,3],[-55,25,55,29],[-35,-11,-31,0],[-47,-11,-31,-7]];
const gap=(b,r)=>Math.hypot(Math.max(b.min.x-r[2],0,r[0]-b.max.x),Math.max(b.min.z-r[3],0,r[1]-b.max.z));
const instances=[[-20,-30,0,1],[6,32,0,1],[50,32.2,0,1]].map(([x,z,yaw,s])=>{const b=box.clone().applyMatrix4(new T.Matrix4().makeTranslation(x,0,z).multiply(new T.Matrix4().makeRotationY(yaw)).multiply(new T.Matrix4().makeScale(s,s,s))),roadClearances=roadRects.map(r=>round(gap(b,r))),boardClearance=round(Math.min(b.min.x+55,55-b.max.x,b.min.z+37.5,37.5-b.max.z));assert(Math.min(...roadClearances)>0);assert(boardClearance>0);return{center:[x,z],yaw,scale:s,worldBox:{min:b.min.toArray().map(round),max:b.max.toArray().map(round)},roadClearances,boardClearance};});
const southRoadClearance=round(instances[1].worldBox.min[0]-3);assert(southRoadClearance>0);
const ray=new T.Raycaster(),roofProbes=[];for(const xf of [-.3,-.15,0,.15,.3])for(const zf of [-.3,-.15,0,.15,.3]){ray.set(new T.Vector3(size.x*xf,20,size.z*zf),new T.Vector3(0,-1,0));const h=ray.intersectObjects(meshes,false)[0];roofProbes.push({xz:[size.x*xf,size.z*zf].map(round),y:h?round(h.point.y):null});}assert(roofProbes.every(p=>p.y!==null&&p.y>size.y*.5));
const materials=root.listMaterials().map(m=>({alphaMode:m.getAlphaMode(),extensions:m.listExtensions().map(e=>e.extensionName)}));assert.equal(materials.length,1);assert(materials.every(m=>m.alphaMode==='OPAQUE'&&!m.extensions.includes('KHR_materials_transmission')));assert(triangles<=7000);assert(bytes.length<200000);
const validation=await validator.validateBytes(bytes,{uri:'house-c.glb'});assert.equal(validation.issues.numErrors+validation.issues.numWarnings,0);
// Full fitted corner-tree canopy: the house cannot intersect it or push it off the board.
assert(decor.includes('[53.8, 35, 0, 1]'));
const treeDoc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(path.join(dir,'../../../public/models/tree-oak-lite.glb'));
const treeRaw=new T.Box3();for(const n of treeDoc.getRoot().listNodes())if(n.getMesh())for(const p of n.getMesh().listPrimitives()){const a=p.getAttribute('POSITION'),m=new T.Matrix4().fromArray(n.getWorldMatrix());for(let i=0;i<a.getCount();i++)treeRaw.expandByPoint(new T.Vector3(...a.getElement(i,[])).applyMatrix4(m));}
const ts=treeRaw.getSize(new T.Vector3()).multiplyScalar(3/treeRaw.getSize(new T.Vector3()).y),treeBox=new T.Box3(new T.Vector3(53.8-ts.x/2,0,35-ts.z/2),new T.Vector3(53.8+ts.x/2,3,35+ts.z/2));
const treeHouseGap=round(gap(treeBox,[instances[2].worldBox.min[0],instances[2].worldBox.min[2],instances[2].worldBox.max[0],instances[2].worldBox.max[2]])),treeBoardGap=round(Math.min(55-treeBox.max.x,37.5-treeBox.max.z));assert(treeHouseGap>0);assert(treeBoardGap>0);
const cornerTree={previousCenter:[52,35],center:[53.8,35],fittedSize:ts.toArray().map(round),houseGap:treeHouseGap,boardGap:treeBoardGap};
const report={file:'public/models/house-c.glb',bytes:bytes.length,triangles,materials,fittedSize:size.toArray().map(round),uniformScale:scale,cornerTree,instances,southRoadClearance,roadRects,roofProbes,limitations:['Bounding boxes include all eaves and chimney. Road rectangles conservative, no traffic animation envelope.','Roof sampling and visual inspection do not prove manifold topology.','Actual tasks/poles/critters reviewed separately in game-review.html.','No iPad/FPS/PWA result.']};
await fs.writeFile(path.join(dir,'measurements.json'),JSON.stringify(report,null,2)+'\n');await fs.writeFile(path.join(dir,'validation.json'),JSON.stringify(validation,null,2)+'\n');console.log(JSON.stringify({bytes:bytes.length,triangles,size:report.fittedSize,roadGapMin:Math.min(...instances.flatMap(i=>i.roadClearances)),boardGapMin:Math.min(...instances.map(i=>i.boardClearance)),southRoadClearance,errors:validation.issues.numErrors,warnings:validation.issues.numWarnings}));
