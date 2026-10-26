// Verify the narrow merge contract and captured native-browser evidence.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../../..');
const read=async p=>JSON.parse(await fs.readFile(path.join(dir,p),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const equal=(a,b,label)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),label);
const baseline=await read('baseline/decor-layout.json'),author=await read('baseline/decor-authoring.json'),manifest=await read('baseline/manifest.json');
const layout=await read('candidate/decor-layout.json'),candidateAuthor=await read('candidate/decor-authoring.json'),added=await read('additions.json'),replacement=await read('field-wheat-replacement.json'),audit=await read('candidate-audit.json');
const source=await fs.readFile(path.join(dir,'candidate/farm-decor.ts'),'utf8'),runtime=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
for(const k of Object.keys(layout))equal(runtime[k],layout[k],'TS/layout drift '+k);
for(const k of Object.keys(baseline).filter(k=>k!=='DECOR'))equal(layout[k],baseline[k],'Protected export changed '+k);
assert.equal(layout.DECOR.length,baseline.DECOR.length);
let preserved=0,plantCount=0;
for(const [i,g] of baseline.DECOR.entries()){
 const next=layout.DECOR[i];equal({...g,items:undefined},{...next,items:undefined},'Group metadata changed');
 if(i===audit.replacedFieldGroup){assert.equal(g.model,'crop-wheat');assert.equal(g.fit.width,1.4);equal(g.items,replacement.before,'Replacement before mismatch');equal(next.items,replacement.after,'Replacement after mismatch');}
 else{equal(next.items.slice(0,g.items.length),g.items,'Existing placement changed '+g.model);const extra=next.items.slice(g.items.length);if(extra.length)assert(['bush-lite','flower-cluster'].includes(g.model),'Unapproved addition '+g.model);equal(added.groups.find(x=>x.model===g.model&&JSON.stringify(x.fit)===JSON.stringify(g.fit))?.items??[],extra,'Append payload mismatch');preserved+=g.items.length;plantCount+=extra.length;}
 assert(candidateAuthor.groups.some(a=>JSON.stringify(a.fit)===JSON.stringify(next.fit)&&a.model===next.model&&JSON.stringify(a.items)===JSON.stringify(next.items)),'Authoring drift '+g.model);
}
assert.equal(preserved,668);assert.equal(replacement.before.length,18);assert.equal(replacement.after.length,26);
assert.equal(plantCount,audit.plantAdditionCount);assert.equal(audit.added.length,plantCount+replacement.after.length);
assert.equal(layout.DECOR.reduce((n,g)=>n+g.items.length,0),audit.instancesAfter);
for(const k of Object.keys(author).filter(k=>k!=='groups'))equal(candidateAuthor[k],author[k],'Authoring anchor changed '+k);
for(const g of author.groups.filter(g=>g.category==='future-toy'))assert(candidateAuthor.groups.some(a=>JSON.stringify(a)===JSON.stringify(g)),'Future slot changed');
for(const a of audit.added){assert(a.p.every(Number.isFinite)&&a.p[3]>0);assert(Object.values(a.gaps).every(v=>Number.isFinite(v)&&v>=0),'Footprint clearance failed '+a.id);if(a.gi!==audit.replacedFieldGroup)assert(a.height<=.5,'Interior plant too tall');}
const fullCandidate=new Map(audit.added.map(x=>[x.id,x]));assert.equal(fullCandidate.size,audit.added.length);
const allViews=[];
for(const width of [1180,1024,390]){
 const reports=await read('qa/audit-'+width+'.json');assert.equal(reports.length,24);assert.equal(new Set(reports.map(r=>r.area)).size,24);
 const tasks=reports.filter(r=>r.area.startsWith('task'));assert.equal(tasks.length,17);assert.equal(new Set(tasks.flatMap(r=>r.taskAreas.map(t=>t.ask))).size,17);
 for(const r of reports){assert.equal(r.viewport[0],width);assert.equal(r.occlusion.sampledTargets,2209);assert.equal(r.occlusion.animalUpperBodySamples,369);assert.equal(r.occlusion.actualOutlineVertices,1050);assert.equal(r.occlusion.authorPadSamples,612);assert.equal(r.occlusion.addedOcclusions.length,0,r.area);assert.equal(r.errors.length,0);assert.equal(r.contextLost,false);assert.equal(r.budget.additions.instances,r.expectedAddedPrimitiveInstances);assert.equal(r.budget.additions.instances,audit.added.length);assert.equal(r.budget.after.instances-r.budget.before.instances,audit.instancesAfter-audit.instancesBefore);assert.equal(r.budget.after.triangles-r.budget.before.triangles,audit.additionalTriangles);assert.equal(r.budget.after.batches,r.budget.before.batches);assert.equal(r.source.candidateDecorSha256,sha(source),'Stale browser data');if(r.area.startsWith('task')){assert(r.cameraContract.startsWith('Exact StoryMap.view'));assert.equal(r.camera.type,'PerspectiveCamera');}
  await fs.access(path.join(dir,'qa',`after-${r.area}-${width}.jpg`));allViews.push({width,area:r.area,rays:r.occlusion.sampledTargets,exactGameplayCamera:r.area.startsWith('task')});
 }
 for(const area of reports.filter(r=>!r.area.startsWith('task')).map(r=>r.area))await fs.access(path.join(dir,'qa',`before-${area}-${width}.jpg`));
}
const states=r=>[...new Set(r.renderCost.samples.map(x=>x.triangles))].sort((a,b)=>a-b);
const before=await read('qa/before-budget-1180.json'),after=await read('qa/after-budget-1180.json'),old=states(before),next=states(after);
assert.equal(old.length,4);assert.equal(next.length,4);assert(next[1]<2600000,'Scene+shadow cap exceeded');
assert.equal(before.source.candidateDecorSha256,sha(source));assert.equal(after.source.candidateDecorSha256,sha(source));
equal([...new Set(before.renderCost.samples.map(x=>x.calls))].sort(),[...new Set(after.renderCost.samples.map(x=>x.calls))].sort(),'Draw-call count grew');
const snapshot=await read('snapshot.json'),adaptation=await read('checker-adaptation.json');assert.equal(snapshot.candidateDecorSha256,sha(source));
let snapshotVerified=false;
try{assert.equal(sha(await fs.readFile(path.join(dir,'.snapshot/src/farm-decor.ts'))),sha(source));for(const [n,h] of Object.entries(manifest.runtimeHashes).filter(([n])=>n!=='src/farm-decor.ts'))assert.equal(sha(await fs.readFile(path.join(dir,'.snapshot',n))),n==='scripts/check-farm-decor.mjs'?adaptation.adaptedSha256:h,'Snapshot drift '+n);snapshotVerified=true;}catch(e){if(e.code!=='ENOENT')throw e;}
const liveDrift=[];for(const [n,h] of Object.entries(manifest.runtimeHashes)){const b=await fs.readFile(path.join(root,n)).catch(()=>null);if(!b||sha(b)!==h)liveDrift.push(n);}
const screenshotManifest=await read('qa/screenshot-manifest.json');assert.equal(screenshotManifest.screenshots.length,95);
for(const image of screenshotManifest.screenshots){assert(image.completeGameViewport);assert.equal(image.candidateDecorSha256,sha(source));assert.equal(sha(await fs.readFile(path.join(dir,'qa',image.file))),image.sha256);const capture=await read('qa/'+image.file.replace(/\.jpg$/,'.json'));assert.equal(capture.source.candidateDecorSha256,sha(source));assert.equal(capture.occlusion.addedOcclusions.length,0);assert.equal(capture.contextLost,false);assert.equal(capture.errors.length,0);}
const logs=await read('qa/browser-logs.json');
const summary={status:'pass',sourceRevision:manifest.revision,preservedNonFieldInstances:preserved,originalFieldInstances:replacement.before.length,replacementFieldInstances:replacement.after.length,addedLowPlants:plantCount,totalInstances:audit.instancesAfter,netAddedInstances:audit.instancesAfter-audit.instancesBefore,additionalGeometryTriangles:audit.additionalTriangles,unchangedDatasets:Object.keys(baseline).filter(k=>k!=='DECOR'),candidateSourceSha256:sha(source),snapshotVerified,runtimeHashCount:Object.keys(manifest.runtimeHashes).length,checkerAdaptation:adaptation,liveRuntimeDrift:liveDrift,views:allViews,rays:allViews.reduce((s,v)=>s+v.rays,0),completeNativeScreenshots:screenshotManifest.screenshots.length,dressing:after.budget,budget:{sceneAndShadowsBefore:old[1],sceneAndShadowsAfter:next[1],sceneAndShadowsDelta:next[1]-old[1],sceneAndShadowsCap:2600000,remaining:2600000-next[1],fullFrameBefore:old[3],fullFrameAfter:next[3],fullFrameDelta:next[3]-old[3],statesBefore:old,statesAfter:next},console:{entries:logs.length,logs,pageErrorArraysEmpty:true},wheat:{before:replacement.before.length,after:replacement.after.length,rows:new Set(replacement.after.map(p=>p[1])).size,scale:audit.wheat.selected.scale,beforeFootprintArea:audit.wheat.beforeFootprintArea,afterFootprintArea:audit.wheat.afterFootprintArea,centerFeasibility:audit.wheat.centerFeasibility},scope:'Isolated candidate only. Append additions and explicitly replace the field-wheat items. Preserve current roads and all unrelated shared work. No iPad/FPS/robot claim.'};
await fs.writeFile(path.join(dir,'verification.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({...summary,views:undefined,console:{entries:logs.length}},null,2));
