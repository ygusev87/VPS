import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
const dir=path.dirname(fileURLToPath(import.meta.url));
const read=async name=>JSON.parse(await fs.readFile(path.join(dir,name),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const spec=await read('snapshot.json');
for(const [name,hash] of Object.entries(spec.sha256))assert.equal(sha(await fs.readFile(path.join(dir,'.snapshot',name))),hash,'Runtime changed '+name);
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const geometry={};for(const name of ['frog','crow']){const bytes=await fs.readFile(path.join(dir,'.snapshot/public/models',name+'.glb'));assert.equal(sha(bytes),spec.models[name]);const doc=await io.readBinary(bytes);geometry[name]=doc.getRoot().listNodes().flatMap(n=>(n.getMesh()?.listPrimitives()??[]).map(p=>({node:n.getName(),mesh:n.getMesh().getName(),triangles:(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3})));}
assert.equal(geometry.frog.reduce((n,m)=>n+m.triangles,0),2808);assert.equal(geometry.crow.length,3);assert.deepEqual(geometry.crow.map(x=>x.triangles).sort((a,b)=>a-b),[528,616,3862]);
const f=await read('qa/frog-cycle.json'),c=await read('qa/crow-cycle.json'),samples=[...c.landing,...c.fleeing];
assert.equal(f.samples.length,480);assert(f.facingMinimum>1-1e-12);assert(f.minimumVisibleY>=0);assert.deepEqual(f.returnDelta,[0,0,0]);assert.equal(f.after.visible,true);assert.equal(f.after.t,-1);
assert.equal(c.landing.length,336);assert.equal(c.fleeing.length,276);
const pivotDrift=Math.max(...samples.flatMap(s=>s.wings.map((w,i)=>Math.hypot(...w.pivotInSculpt.map((v,j)=>v-c.settled.wings[i].pivotInSculpt[j])))));
const mirrorError=Math.max(...samples.map(s=>Math.abs(s.wings[0].rotation[0]+s.wings[1].rotation[0])));
assert(pivotDrift<=1e-6);assert(mirrorError<=1e-6);
const wingRanges=[0,1].map(i=>[Math.min(...samples.map(s=>s.wings[i].rotation[0])),Math.max(...samples.map(s=>s.wings[i].rotation[0]))]);
assert(wingRanges[0][0]<-1.19&&wingRanges[0][1]>.79);
for(const s of samples){assert.equal(s.wings.length,2);assert.equal(s.bodyMeshes.length,1);assert.equal(s.bodyMeshes[0].triangles,3862);assert.equal(s.wings.reduce((n,w)=>n+w.meshes.reduce((m,x)=>m+x.triangles,0),0),1144);}
const images=[];
// Native IAB screenshots are JPEG bytes; preserve them without re-encoding.
function jpegSize(bytes){
 assert.equal(bytes.readUInt16BE(0),0xffd8);
 let at=2;
 while(at<bytes.length){
  assert.equal(bytes[at++],0xff);
  while(bytes[at]===0xff)at++;
  const marker=bytes[at++];
  if(marker===0xd9||marker===0xda)break;
  if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
  const length=bytes.readUInt16BE(at);
  assert(length>=2&&at+length<=bytes.length);
  if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return [bytes.readUInt16BE(at+5),bytes.readUInt16BE(at+3)];
  at+=length;
 }
 throw new Error('JPEG size missing');
}
async function capture(name,width){
 const report=await read('qa/'+name+'.json'),bytes=await fs.readFile(path.join(dir,'qa',name+'.jpg'));
 assert.equal(report.revision,spec.revision);assert.equal(report.contextLost,false);assert.equal(report.errors.length,0);assert.equal(report.quality,2);assert.equal(report.viewport[0],width);
 const size=jpegSize(bytes);assert(size[0]>=report.frameRect.right&&size[1]>=report.frameRect.bottom,'Cropped game '+name);
 images.push({name,width,size,format:'jpeg',sha256:sha(bytes),completeGameViewport:true});return report;
}
for(const width of [1180,390]){
 const rest=await capture('frog-rest-'+width,width),apex=await capture('frog-apex-'+width,width),back=await capture('frog-return-'+width,width);
 assert.equal(rest.t,-1);assert.equal(apex.t,.35);assert.deepEqual(apex.position,[-1.25,1.2,0]);assert.deepEqual(back.world,rest.world);assert.deepEqual(back.position,[0,0,0]);assert.equal(back.visible,true);
 for(const phase of ['folded','up','down']){const r=await capture('crow-'+phase+'-'+width,width);assert.equal(r.visible,true);assert.equal(r.wings.length,2);if(phase==='up')assert(Math.abs(r.wings[0].rotation[0]+1.2)<1e-5);if(phase==='down')assert(Math.abs(r.wings[0].rotation[0]-.8)<1e-5);}
}
for(const phase of ['up','down'])for(const view of ['front','rear']){const r=await capture(`crow-${phase}-shoulders-${view}`,1180);assert.equal(r.shoulderView,view);assert.equal(r.closeup,true);}
const ui={};for(const animal of ['frog','crow']){const r=await capture(animal+'-ui-tap-390',390);assert.equal(r.kind,'ui-tap-result');assert.deepEqual(r.events.map(e=>e.type),['pointerdown','pointerup']);assert(r.events.every(e=>e.isTrusted&&e.pointerType==='mouse'));if(animal==='frog'){assert.equal(r.before.t,-1);assert.equal(r.after.t,0);}else{assert.equal(r.before.act,'sneak');assert.equal(r.after.act,'flee');}ui[animal]={before:animal==='frog'?r.before.t:r.before.act,after:animal==='frog'?r.after.t:r.after.act,events:r.events,method:'Real mouse pointer events on the game canvas at 390×844 through unchanged Input/StoryMap raycast. No physical-touchscreen claim.'};}
const feather=await read('qa/feather-identity.json');assert.equal(feather.sameObjectAsPestFeather,true);assert.equal(feather.parentIsScenery,true);assert.equal(feather.insideCrowRoot,false);assert.equal(feather.insideSculpt,false);assert.equal(feather.geometry.type,'ConeGeometry');assert.equal(feather.geometry.parameters.radius,.06);assert.equal(feather.geometry.parameters.height,.4);assert.equal(feather.geometry.parameters.radialSegments,6);assert.equal(feather.source.sha256,spec.sha256['src/pest.ts']);
const harness=await fs.readFile(path.join(dir,'review.html'),'utf8');assert(!/new THREE\.(?:Mesh|\w*Geometry)\s*\(/.test(harness),'QA must not introduce visible geometry');
const logs=await read('qa/browser-logs.json');assert(!logs.some(l=>/context.*lost|Error creating WebGL/i.test(l.message)));
const history=await read('qa/harness-history.json');assert.equal(sha(harness),history.finalHarnessSha256);
const summary={status:'pass-with-console-note',revision:spec.revision,verifiedSnapshotFiles:Object.keys(spec.sha256).length,models:spec.models,geometry,views:{standard:12,shoulders:4,ui:2,total:images.length,images},frog:{steps:480,facingMinimum:f.facingMinimum,minimumVisibleY:f.minimumVisibleY,returnDelta:f.returnDelta,apex:[-1.25,1.2,0]},crow:{landingSteps:336,fleeSteps:276,pivotDriftAt1e6Precision:pivotDrift,mirrorError,wingRanges,fold:c.settled.wings.map(w=>w.rotation),visualFinding:'Four close views cover both wing extremes from front/rear: shoulder surfaces remain joined, no background-visible hole or detached pivot observed. Exactly body + left wing + right wing in GLB; tail belongs to body.'},ui,feather:{geometry:feather.geometry,parentIsScenery:feather.parentIsScenery,insideSculpt:feather.insideSculpt,source:feather.source,meaning:feather.meaning},console:{entries:logs.length,logs,windowErrors:0,contextLoss:false,note:'One MutationObserver.observe TypeError without a source URL was captured. Origin unconfirmed; it is not attributed to the game or dismissed as an IAB bug.'},harness:history,limits:'Controlled landing beside a real wire; automatic choose and peck/zapped not tested. Browser mouse clicks, not physical touchscreen. No iPad, PWA, FPS or thermal stability claim.'};
await fs.writeFile(path.join(dir,'verification.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({...summary,views:{...summary.views,images:undefined},ui:undefined,console:{entries:logs.length,note:summary.console.note}},null,2));
