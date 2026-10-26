// Read-only verification of the isolated candidate, preservation contract, and captured real-runtime QA.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../../..');
const read=async p=>JSON.parse(await fs.readFile(path.join(dir,p),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const equal=(a,b,label)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),label);
const baseline=await read('baseline/decor-layout.json'),author=await read('baseline/decor-authoring.json'),manifest=await read('baseline/manifest.json');
const layout=await read('candidate/decor-layout.json'),candidateAuthor=await read('candidate/decor-authoring.json'),added=await read('additions.json'),audit=await read('candidate-audit.json');
const source=await fs.readFile(path.join(dir,'candidate/farm-decor.ts'),'utf8'),runtime=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const allowed=new Set(['tree-oak-lite','tree-pine-lite','bush-lite']);
for(const k of Object.keys(layout))equal(runtime[k],layout[k],'TS/layout drift '+k);
for(const k of Object.keys(baseline).filter(k=>k!=='DECOR'))equal(layout[k],baseline[k],'Protected export changed '+k);
assert.equal(layout.DECOR.length,baseline.DECOR.length);
let oldCount=0,newCount=0;
for(const [i,g] of baseline.DECOR.entries()){
 const next=layout.DECOR[i];equal({...g,items:undefined},{...next,items:undefined},'Group metadata changed');equal(next.items.slice(0,g.items.length),g.items,'Existing placement changed '+g.model);
 const extra=next.items.slice(g.items.length);if(extra.length)assert(allowed.has(g.model),'Unapproved addition '+g.model);
 equal(added.groups.find(x=>x.model===g.model&&JSON.stringify(x.fit)===JSON.stringify(g.fit))?.items??[],extra,'Append-only payload mismatch '+g.model);
 assert(candidateAuthor.groups.some(a=>JSON.stringify(a.fit)===JSON.stringify(next.fit)&&a.model===next.model&&JSON.stringify(a.items)===JSON.stringify(next.items)),'Authoring drift '+g.model);
 oldCount+=g.items.length;newCount+=extra.length;
}
assert.equal(oldCount,645);assert.equal(newCount,33);assert.equal(audit.additionalTriangles,20352);assert.equal(audit.added.length,newCount);
for(const k of Object.keys(author).filter(k=>k!=='groups'))equal(candidateAuthor[k],author[k],'Authoring anchor changed '+k);
for(const g of author.groups.filter(g=>g.category==='future-toy'))assert(candidateAuthor.groups.some(a=>JSON.stringify(a)===JSON.stringify(g)),'Future slot changed');
for(const a of audit.added){assert(a.p[1]<21,'New tall/front-rim decor');assert(a.p.every(Number.isFinite)&&a.p[3]>0);assert(Object.values(a.gaps).every(v=>Number.isFinite(v)&&v>=0),'Footprint clearance failed '+a.id);}
for(const [model,hash] of Object.entries(audit.modelHashes)){
 const n='public/models/'+model+'.glb',b=manifest.overrides.includes(n)?await fs.readFile(path.join(dir,'baseline/overrides',n)):execFileSync('git',['show',manifest.revision+':'+n],{cwd:root,maxBuffer:20*1024*1024});assert.equal(sha(b),hash,'Frozen model drift '+model);
}
const allViews=[];
for(const width of [1180,390]){
 const reports=await read('qa/audit-'+width+'.json');assert.equal(reports.length,23);assert.equal(new Set(reports.map(r=>r.area)).size,23);
 const tasks=reports.filter(r=>r.area.startsWith('task'));assert.equal(tasks.length,17);
 assert.equal(new Set(tasks.flatMap(r=>r.taskAreas.map(t=>t.ask))).size,17);
 for(const r of reports){assert.equal(r.viewport[0],width);assert.equal(r.occlusion.sampledTargets,1840);assert.equal(r.occlusion.actualOutlineVertices,1050);assert.equal(r.occlusion.authorPadSamples,612);assert.equal(r.occlusion.addedOcclusions.length,0,r.area);assert.equal(r.errors.length,0);assert.equal(r.contextLost,false);assert.equal(r.budget.additions.instances,33);assert.equal(r.budget.additions.triangles,20352);assert.equal(r.budget.after.instances-r.budget.before.instances,33);assert.equal(r.budget.after.batches,r.budget.before.batches);assert.equal(r.source.candidateDecorSha256,sha(source),'Stale browser data');if(r.area.startsWith('task')){assert(r.cameraContract.startsWith('Exact StoryMap.view'));assert.equal(r.camera.type,'PerspectiveCamera');}
  await fs.access(path.join(dir,'qa',`after-${r.area}-${width}.jpg`));allViews.push({width,area:r.area,rays:r.occlusion.sampledTargets,exactGameplayCamera:r.area.startsWith('task')});
 }
}
const states=r=>[...new Set(r.renderCost.samples.map(x=>x.triangles))].sort((a,b)=>a-b);
const before=await read('qa/before-budget-1180.json'),after=await read('qa/after-budget-1180.json');const old=states(before),next=states(after);
assert.equal(old.length,4);assert.equal(next.length,4);assert(next[1]<2600000,'Scene+shadow cap exceeded');
assert.equal(before.source.candidateDecorSha256,sha(source));assert.equal(after.source.candidateDecorSha256,sha(source));
equal([...new Set(before.renderCost.samples.map(x=>x.calls))].sort(),[...new Set(after.renderCost.samples.map(x=>x.calls))].sort(),'Draw-call count grew');
const snapshot=await read('snapshot.json');assert.equal(snapshot.candidateDecorSha256,sha(source));
let snapshotVerified=false;
try{const snapSource=await fs.readFile(path.join(dir,'.snapshot/src/farm-decor.ts'));assert.equal(sha(snapSource),sha(source));for(const [n,h] of Object.entries(manifest.runtimeHashes).filter(([n])=>n!=='src/farm-decor.ts'))assert.equal(sha(await fs.readFile(path.join(dir,'.snapshot',n))),h,'Snapshot drift '+n);snapshotVerified=true;}catch(e){if(e.code!=='ENOENT')throw e;}
const liveDrift=[];for(const [n,h] of Object.entries(manifest.runtimeHashes)){const b=await fs.readFile(path.join(root,n)).catch(()=>null);if(!b||sha(b)!==h)liveDrift.push(n);}
const sourceCommit='869bd6c';const equivalenceMismatches=[];
for(const [n,h] of Object.entries(manifest.runtimeHashes)){const b=execFileSync('git',['show',sourceCommit+':'+n],{cwd:root,maxBuffer:20*1024*1024});if(sha(b)!==h)equivalenceMismatches.push(n);}
assert.equal(equivalenceMismatches.length,0,'Snapshot differs from integrated shore/hay baseline');
const logs=await read('qa/browser-logs.json');
const summary={status:'pass',preservedInstances:oldCount,totalInstances:oldCount+newCount,addedInstances:newCount,additionalGeometryTriangles:audit.additionalTriangles,unchangedDatasets:Object.keys(baseline).filter(k=>k!=='DECOR'),candidateSourceSha256:sha(source),snapshotVerified,baselineEquivalentToIntegratedCommit:execFileSync('git',['rev-parse',sourceCommit],{cwd:root,encoding:'utf8'}).trim(),liveRuntimeDrift:liveDrift,views:allViews,rays:allViews.reduce((s,v)=>s+v.rays,0),budget:{sceneAndShadowsBefore:old[1],sceneAndShadowsAfter:next[1],sceneAndShadowsCap:2600000,remaining:2600000-next[1],fullFrameBefore:old[3],fullFrameAfter:next[3],fullFrameDelta:next[3]-old[3],statesBefore:old,statesAfter:next},console:{entries:logs.length,logs,pageErrorArraysEmpty:true,note:'Two identical MutationObserver.observe errors without URL across page loads. Not caught by scene window handlers; origin unconfirmed. No WebGL loss or failed assertions.'},canopyCoverage:audit.canopyCoverage,scope:'Isolated candidate only. Apply additions onto current authoring; do not overwrite unrelated runtime/layout work. No iPad/FPS/robot claim.'};
await fs.writeFile(path.join(dir,'verification.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({...summary,views:undefined,console:{entries:logs.length},canopyCoverage:undefined},null,2));
