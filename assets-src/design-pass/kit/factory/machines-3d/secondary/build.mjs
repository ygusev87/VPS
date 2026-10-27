import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {compressTexture,getBounds,meshopt,prune,weld,simplify,simplifyPrimitive} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';
import * as T from 'three';
import sharp from 'sharp';
import validator from 'gltf-validator';
const {Brush,Evaluator,SUBTRACTION,INTERSECTION}=await import('/tmp/electro-factory-csg/node_modules/three-bvh-csg/src/index.js');
const dir=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(dir,'../../../../../..');
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const evaluator=new Evaluator();evaluator.useGroups=false;
const sha=b=>createHash('sha256').update(b).digest('hex');
function map(v,knots){for(let i=1;i<knots.length;i++)if(v<=knots[i][0]+1e-7){const a=knots[i-1],b=knots[i];return a[1]+(v-a[0])*(b[1]-a[1])/(b[0]-a[0]);}return knots.at(-1)[1];}
function toGeometry(p){const g=new T.BufferGeometry();for(const [s,n]of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const a=p.getAttribute(s);g.setAttribute(n,new T.BufferAttribute(Float32Array.from(a.getArray()),a.getElementSize()));}g.setIndex(new T.BufferAttribute(Uint32Array.from(p.getIndices().getArray()),1));return g;}
function cutter(geometry,position=[0,0,0],rotation=[0,0,0]){for(let i=0;i<geometry.attributes.uv.count;i++)geometry.attributes.uv.setXY(i,.02,.02);const b=new Brush(geometry);b.position.set(...position);b.rotation.set(...rotation);b.updateMatrixWorld();return b;}
function boolean(g,cut,op=SUBTRACTION){const a=new Brush(g);a.updateMatrixWorld();const b=evaluator.evaluate(a,cut,op).geometry;return b;}
function rebase(g,p){g.translate(-p[0],-p[1],-p[2]);return g;}
function joinGeometry(gs){const out=new T.BufferGeometry(),arrays={position:[],normal:[],uv:[]};for(const geometry of gs){const g=geometry.index?geometry.toNonIndexed():geometry;for(const key of Object.keys(arrays))arrays[key].push(...g.attributes[key].array);}for(const key of Object.keys(arrays))out.setAttribute(key,new T.Float32BufferAttribute(arrays[key],key==='uv'?2:3));return out;}
function profileWheel(){
 const profile=[[0,-.04],[.13,-.04],[.15,-.027],[.15,.012],[.13,.027],[.06,.025],[.045,.04],[0,.04]],wheel=new T.LatheGeometry(profile.map(v=>new T.Vector2(...v)),20).rotateX(Math.PI/2).toNonIndexed();
 const keep={position:[],normal:[],uv:[]};
 // Constant UV per face samples neutral steel from the original atlas. Interpolating
 // unrelated projected atlas islands caused streaks, so no new raster texture is made.
 for(let i=0;i<wheel.attributes.position.count;i+=3){const ps=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(wheel.attributes.position,i+k)),tri=new T.Triangle(...ps);if(tri.getArea()<1e-10)continue;const c=tri.getMidpoint(new T.Vector3()),rad=Math.hypot(c.x,c.y);let uv=[.75048828125,.18505859375];if(rad>.135)uv=[.6728515625,.01806640625];else if(rad>.115&&c.z>0)uv=[.46337890625,.3037109375];else if(rad<.06&&c.z>0)uv=[.25390625,.48681640625];for(let k=0;k<3;k++){keep.position.push(...ps[k].toArray());keep.normal.push(...new T.Vector3().fromBufferAttribute(wheel.attributes.normal,i+k).toArray());keep.uv.push(...uv);}}
 const out=new T.BufferGeometry();for(const key of Object.keys(keep))out.setAttribute(key,new T.Float32BufferAttribute(keep[key],key==='uv'?2:3));return out;
}
function completeCoilUpperHalf(g){const s=g.index?g.toNonIndexed():g,arrays={position:[],normal:[],uv:[]};for(let i=0;i<s.attributes.position.count;i+=3){if([0,1,2].every(k=>Math.abs(s.attributes.position.getY(i+k)-.56)<1e-5))continue;for(const mirror of [false,true])for(const k of mirror?[0,2,1]:[0,1,2]){const p=new T.Vector3().fromBufferAttribute(s.attributes.position,i+k),n=new T.Vector3().fromBufferAttribute(s.attributes.normal,i+k);if(mirror){p.y=1.12-p.y;n.y=-n.y;}arrays.position.push(...p.toArray());arrays.normal.push(...n.toArray());arrays.uv.push(s.attributes.uv.getX(i+k),s.attributes.uv.getY(i+k));}}const out=new T.BufferGeometry();for(const key of Object.keys(arrays))out.setAttribute(key,new T.Float32BufferAttribute(arrays[key],key==='uv'?2:3));return out;}
for(const name of process.argv.slice(2)){
 const source=path.join(repo,'assets-src/raw/factory-2026-10-27',name+'.glb'),raw=await fs.readFile(source),d=await io.readBinary(raw),r=d.getRoot(),sourceBounds=getBounds(r.listScenes()[0]),sourcePrimitive=r.listMeshes()[0].listPrimitives()[0],material=r.listMaterials()[0],buffer=r.listBuffers()[0];
 let g=toGeometry(sourcePrimitive);const sourceTriangles=g.index.count/3,details={};let pieces=[];
 if(name==='lever-box'){
  const zc=-.14081192389130592,xc=-.0028762631118297577;
  for(let i=0;i<g.attributes.position.count;i++){const a=g.attributes.position;const x=a.getX(i),y=a.getY(i),z=a.getZ(i);a.setXYZ(i,map(x,[[-.5,-.75],[xc,0],[.5,.75]]),y*.4/sourceBounds.max[1],map(z,[[sourceBounds.min[2],-.55],[zc-.085,-.4775],[zc+.085,-.2225],[sourceBounds.max[2],.55]]));}
  g.computeVertexNormals();g=boolean(g,cutter(new T.CylinderGeometry(.095,.095,1,24),[0,.2,-.35]));
  // Actual runtime stick is inclined towards +Z. Carve its complete Z-axis sweep,
  // with 0.013 radial allowance, rather than checking an unrelated upright stick.
  const cutAngles=Array.from({length:13},(_,i)=>-.55+i*1.1/12);
  for(const angle of cutAngles){const cut=cutter(new T.CylinderGeometry(.073,.073,.77,16),[0,0,0],[Math.PI/2-.5,0,0]);const local=new T.Matrix4().compose(new T.Vector3(0,.2,.3),cut.quaternion,new T.Vector3(1,1,1));const world=new T.Matrix4().makeTranslation(0,.35,-.35).multiply(new T.Matrix4().makeRotationZ(angle)).multiply(local);world.decompose(cut.position,cut.quaternion,cut.scale);cut.updateMatrixWorld();g=boolean(g,cut);}
  details.placement=[0,.16,0];details.fit={width:1.5};details.pivotPartLocal=[0,.51,-.35];details.bore={axisXZ:[0,-.35],radius:.095};details.stickSweep={angles:[-.55,.55],samples:13,clearanceRadius:.073,runtimeRadius:.06};pieces=[{name:'lever-box-body',g,pivot:[0,0,0]}];
 }else if(name==='shaft-motor'){
  for(let i=0;i<g.attributes.position.count;i++){const a=g.attributes.position;a.setXYZ(i,a.getX(i)*1.1,a.getY(i)*.25/sourceBounds.max[1],map(a.getZ(i),[[sourceBounds.min[2],-.45],[-.15,-.40],[.15,-.10],[sourceBounds.max[2],.45]]));}
  g.computeVertexNormals();g=boolean(g,cutter(new T.CylinderGeometry(.105,.105,1,32),[0,.2,-.25]));
  details.placement=[0,.16,-.1];details.fit={width:1.1};details.bore={axisXZ:[0,-.25],radius:.105,runtimeShaftRadius:.08,fullHeight:true};pieces=[{name:'shaft-motor-body',g,pivot:[0,0,0]}];
 }else if(name==='socket-board'){
  // Panel begins above short feet. Preserve a 1m panel height separately from feet.
  const footTop=.045,panelDepth=.149;
  for(let i=0;i<g.attributes.position.count;i++){const a=g.attributes.position;a.setXYZ(i,a.getX(i)*2.6,map(a.getY(i),[[0,0],[footTop,.10],[sourceBounds.max[1],1.10]]),a.getZ(i)*(.2/panelDepth));}
  g.computeVertexNormals();details.panelY=[.10,1.10];details.panelTargetSize=[2.6,1,.2];details.feetHeight=.1;details.placement=[0,.16,-.8];details.fit={width:2.6};pieces=[{name:'socket-board-body',g,pivot:[0,0,0]}];
 }else if(name==='rail-cart'){
  // Rebuild clean circular rims and hubs, retaining the original wheel appearance
  // using neutral steel samples from its existing atlas. This removes fused suspension fragments.
  const wheel=profileWheel();
  const coilCut=cutter(new T.CylinderGeometry(.325,.325,.58,40),[0,.56,0],[0,0,Math.PI/2]);
  // The upper half contains only steel coil. Complete the hidden lower half from
  // it so yellow cradle and floor fragments cannot travel with the load.
  const coil=completeCoilUpperHalf(boolean(g,cutter(new T.BoxGeometry(2,2,2),[0,1.56,0]),INTERSECTION));let chassis=boolean(g,coilCut);
  chassis=boolean(chassis,cutter(new T.BoxGeometry(2,2,2),[0,1.265,0]),INTERSECTION);
  for(const x of [-.32,.31])for(const z of [-.35,.35])chassis=boolean(chassis,cutter(new T.CylinderGeometry(.18,.18,.26,24),[x,.145,z],[Math.PI/2,0,0]));
  chassis.computeBoundingBox();const box=chassis.boundingBox,centre=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
  for(let i=0;i<chassis.attributes.position.count;i++){const a=chassis.attributes.position;a.setXYZ(i,(a.getX(i)-centre.x)*1.3/size.x,.545+(a.getY(i)-.56)*.8,map(a.getZ(i),[[box.min.z,-.5],[-.33,-.27],[.33,.27],[box.max.z,.5]]));}
  const coilScale=.255/(sourceBounds.max[1]-.56);
  for(let i=0;i<coil.attributes.position.count;i++){const a=coil.attributes.position;a.setXYZ(i,a.getX(i)*1.3,.54+(a.getY(i)-.56)*coilScale,a.getZ(i)*coilScale);}
  const axles=[];for(const x of [-.4,.4]){const axle=new T.CylinderGeometry(.03,.03,.70,12).rotateX(Math.PI/2).translate(x,.15,0);for(let i=0;i<axle.attributes.uv.count;i++)axle.attributes.uv.setXY(i,.3388671875,.0126953125);axles.push(axle);}
  const supports=[];for(const x of [-.3,.3]){const bar=new T.BoxGeometry(.08,.04,.55).translate(x,.265,0);for(let i=0;i<bar.attributes.uv.count;i++)bar.attributes.uv.setXY(i,.3388671875,.0126953125);supports.push(bar);}
  chassis=joinGeometry([chassis,...axles,...supports]);chassis.computeVertexNormals();coil.computeVertexNormals();
  pieces=[{name:'rail-cart-chassis',g:chassis,pivot:[0,0,0]},{name:'load-coil',g:rebase(coil,[0,.54,0]),pivot:[0,.54,0]}];
  for(const x of [-.4,.4])for(const z of [-.35,.35]){const w=wheel.clone();if(z<0){w.scale(1,1,-1);const ids=Array.from({length:w.attributes.position.count},(_,i)=>i);for(let i=0;i<ids.length;i+=3)[ids[i+1],ids[i+2]]=[ids[i+2],ids[i+1]];w.setIndex(ids);}pieces.push({name:`wheel-${x>0?'front':'rear'}-${z>0?'right':'left'}`,g:w,pivot:[x,.15,z]});}
  details.fit={width:1.3};details.cartModelOffsetY=.08;details.placementAtRest=[0,.24,0];details.wheels={radius:.15,width:.08,spinAxis:'localZ',centres:pieces.filter(p=>p.name.startsWith('wheel-')).map(p=>({name:p.name,position:p.pivot})),source:'Clean 20-segment radial wheel profile sampling neutral steel colors from the original atlas; four independent Z-axis pivot groups. No fused chassis triangles in wheel nodes.'};details.coil={node:'load-coil',pivot:[0,.54,0],visibility:'Toggle this node only; no duplicate baked coil remains in chassis.',source:'Original steel upper half, mirrored below its axis to exclude fused yellow cradle/floor.',supports:{barX:[-.3,.3],barTopY:.285,barWidthX:.08,barDepthZ:.55},runtimeBedReparent:'Use bed.attach(coil) with world transform preserved. Existing bed origin .72 is not the coil centre.'};details.railContact={runtimeRailTopY:.24,normalizedWheelBottomY:0,requiredCartModelOffsetY:.08};
 }else throw Error('Unsupported model '+name);
 for(const scene of r.listScenes())for(const child of scene.listChildren())scene.removeChild(child);for(const n of [...r.listNodes()])n.dispose();for(const m of [...r.listMeshes()])m.dispose();
 const scene=r.listScenes()[0];
 for(const piece of pieces){const p=d.createPrimitive().setMaterial(material);for(const [s,n]of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const attr=piece.g.attributes[n];p.setAttribute(s,d.createAccessor(piece.name+'-'+s).setType(attr.itemSize===2?'VEC2':'VEC3').setArray(Float32Array.from(attr.array)).setBuffer(buffer));}const indices=piece.g.index?.array||Array.from({length:piece.g.attributes.position.count},(_,i)=>i);p.setIndices(d.createAccessor(piece.name+'-indices').setType('SCALAR').setArray(Uint32Array.from(indices)).setBuffer(buffer));const mesh=d.createMesh(piece.name).addPrimitive(p);if(name==='rail-cart'){const parent=d.createNode(piece.name).setTranslation(piece.pivot),node=d.createNode(piece.name+'_geometry').setMesh(mesh);parent.addChild(node);scene.addChild(parent);}else{const node=d.createNode(piece.name).setMesh(mesh).setTranslation(piece.pivot);scene.addChild(node);}}
 material.setName(name+'-paint').setRoughnessFactor(.62).setMetallicFactor(.15).setDoubleSided(false);material.setExtension('KHR_materials_volume',null);material.setExtension('KHR_materials_transmission',null);
 await d.transform(prune());const triangles=()=>r.listMeshes().flatMap(m=>m.listPrimitives()).reduce((s,p)=>s+p.getIndices().getCount()/3,0),cutTriangles=triangles();
 if(name==='rail-cart')for(const mesh of r.listMeshes())for(const p of mesh.listPrimitives())p.setAttribute('NORMAL',null);
 if(cutTriangles>3950){await d.transform(weld());if(name==='rail-cart'){for(const mesh of r.listMeshes())if(!mesh.getName().startsWith('wheel-'))for(const p of mesh.listPrimitives())simplifyPrimitive(p,{simplifier:MeshoptSimplifier,ratio:3700/cutTriangles,error:.025});}else await d.transform(simplify({simplifier:MeshoptSimplifier,ratio:3900/cutTriangles,error:.001}));}
 if(name==='rail-cart')for(const mesh of r.listMeshes())for(const p of mesh.listPrimitives()){const gg=new T.BufferGeometry();gg.setAttribute('position',new T.BufferAttribute(p.getAttribute('POSITION').getArray(),3));gg.setIndex(new T.BufferAttribute(p.getIndices().getArray(),1));gg.computeVertexNormals();p.setAttribute('NORMAL',d.createAccessor(mesh.getName()+'-normal').setType('VEC3').setArray(gg.attributes.normal.array).setBuffer(buffer));}
 for(const t of r.listTextures())await compressTexture(t,{encoder:sharp,targetFormat:'webp',resize:[512,512],quality:90,effort:70});d.createExtension(EXTTextureWebP).setRequired(true);
 await d.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));const bytes=await io.writeBinary(d),check=await io.readBinary(bytes),validation=await validator.validateBytes(bytes,{uri:name+'.glb'}),rr=check.getRoot();
 await fs.mkdir(path.join(dir,'candidate'),{recursive:true});await fs.writeFile(path.join(dir,'candidate',name+'.glb'),bytes);
 const report={name,source:path.relative(repo,source),sourceSha256:sha(raw),sourceBytes:raw.length,sourceTriangles,sourceBounds,outputSha256:sha(bytes),bytes:bytes.length,cutTriangles,triangles:rr.listMeshes().flatMap(m=>m.listPrimitives()).reduce((s,p)=>s+p.getIndices().getCount()/3,0),materials:rr.listMaterials().length,textures:rr.listTextures().map(t=>({size:t.getSize(),mime:t.getMimeType()})),bounds:getBounds(rr.listScenes()[0]),nodes:rr.listNodes().map(n=>({name:n.getName(),translation:n.getTranslation(),rotation:n.getRotation(),scale:n.getScale(),bounds:getBounds(n)})),details,validation:validation.issues};
 await fs.writeFile(path.join(dir,name+'-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(report.triangles>4000||report.materials!==1||report.bytes>205000||validation.issues.numErrors)throw Error('Output does not pass budgets/validation');
}
