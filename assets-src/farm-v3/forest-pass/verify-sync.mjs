// Read-only integration checks: accepted placement prefixes, authoritative arrays, and live QA evidence.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const equal=(a,b,message)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),message); // yaw -0 and +0 are equivalent
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../../..');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const base=await read(path.join(dir,'baseline/decor-layout.json'));
const candidateMode=process.argv.includes('--candidate'),dataDir=candidateMode?path.join(dir,'candidate'):path.join(root,'assets-src/farm-v3');
const layout=await read(path.join(dataDir,'decor-layout.json'));
const author=await read(path.join(dataDir,'decor-authoring.json'));
const baselineAuthor=await read(path.join(dir,'baseline/decor-authoring.json'));
const candidate=await read(path.join(dir,'candidate/decor-layout.json'));
const source=await fs.readFile(candidateMode?path.join(dir,'candidate/farm-decor.ts'):path.join(root,'src/farm-decor.ts'),'utf8');
const runtime=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
equal(layout,candidate,'Applied data differs from reviewed candidate');
for(const key of Object.keys(layout))equal(runtime[key],layout[key],key+' source/layout drift');
for(const key of Object.keys(base).filter(k=>k!=='DECOR'))equal(layout[key],base[key],key+' changed outside scope');
assert.equal(layout.DECOR.length,base.DECOR.length);
for(let i=0;i<base.DECOR.length;i++){
  const a=base.DECOR[i],b=layout.DECOR[i];assert.equal(a.model,b.model);equal(a.fit,b.fit);
  equal(b.items.slice(0,a.items.length),a.items,'Existing positions changed: '+a.model);
  if(!['tree-pine-lite','tree-oak-lite','bush-lite'].includes(a.model))equal(a,b,'Out-of-scope group changed');
  assert(author.groups.some(g=>g.model===b.model&&JSON.stringify(g.fit)===JSON.stringify(b.fit)&&JSON.stringify(g.items)===JSON.stringify(b.items)),'Authoring mismatch '+b.model);
}
for(const key of Object.keys(baselineAuthor).filter(k=>k!=='groups'))equal(author[key],baselineAuthor[key],'Authoring anchor changed '+key);
for(const g of baselineAuthor.groups.filter(g=>g.category==='future-toy'))assert(author.groups.some(a=>JSON.stringify(a)===JSON.stringify(g)),'Future slot changed');
const audit=await read(path.join(dir,'candidate-audit.json'));
assert.equal(audit.added.length,30);assert.equal(audit.additionalTriangles,19335);
for(const a of audit.added){assert(a.p[1]<10,'Front rim addition');assert(Object.values(a.gaps).every(v=>Number.isFinite(v)&&v>=0),'Clearance failed '+a.id);}
for(const [model,hash] of Object.entries(audit.modelHashes))assert.equal(createHash('sha256').update(await fs.readFile(path.join(root,'public/models',model+'.glb'))).digest('hex'),hash,'GLB changed '+model);
const allViews=[];
for(const width of [1180,390]){
  const views=await read(path.join(dir,'audit-'+width+'.json'));assert.equal(views.length,23);
  for(const r of views){assert.equal(r.viewport[0],width);assert.equal(r.occlusion.addedOcclusions.length,0,r.area);assert.equal(r.occlusion.sampledTargets,1840);assert.equal(r.occlusion.actualOutlineVertices,1050);assert.equal(r.contextLost,false);assert.equal(r.errors.length,0);allViews.push({width,area:r.area,rays:r.occlusion.sampledTargets});}
}
const beforeBudget=await read(path.join(dir,'before-budget-1180.json')),afterBudget=await read(path.join(dir,'after-budget-1180.json'));
const states=r=>[...new Set(r.renderCost.samples.map(s=>s.triangles))].sort((a,b)=>a-b);
const oldStates=states(beforeBudget),newStates=states(afterBudget);assert.equal(newStates.length,4);
assert(newStates[1]<=2600000,'Agreed scene+shadows cap exceeded');
assert(newStates[3]-oldStates[3]<=350000,'Full-render growth exceeded');
const qa=[];
for(const name of (await fs.readdir(dir)).filter(n=>/^(before|after)-.*\.json$/.test(n))){
  const r=await read(path.join(dir,name));assert.equal(r.contextLost,false,name);assert.equal(r.occlusion.addedOcclusions.length,0,name);assert.equal(r.budget.additions.instances,30,name);qa.push({file:name,viewport:r.viewport,area:r.area,targets:r.occlusion.sampledTargets});
}
assert(qa.some(q=>q.viewport[0]===1180)&&qa.some(q=>q.viewport[0]===390));
const snapshot=await read(path.join(dir,'snapshot.json'));
let capturedPayload='temporary snapshot no longer present';
const capturedSource=await fs.readFile(path.join(snapshot.snapshot,'src/farm-decor.ts'),'utf8').catch(()=>null);
if(capturedSource){const captured=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(capturedSource)).toString('base64'));for(const key of Object.keys(layout))equal(captured[key],layout[key],'Captured runtime payload differs: '+key);capturedPayload='matches applied data; source formatting only differs';}
const report={status:'pass',mode:candidateMode?'candidate':'applied',rays:allViews.reduce((s,r)=>s+r.rays,0),auditViews:allViews,budget:{sceneAndShadowsBefore:oldStates[1],sceneAndShadowsAfter:newStates[1],completeFrameBefore:oldStates[3],completeFrameAfter:newStates[3],completeFrameDelta:newStates[3]-oldStates[3],cap:2600000,capDefinition:'Scene+shadows per Claude m0323; full AO frame reported separately'},sourceSha256:createHash('sha256').update(source).digest('hex'),layoutSha256:createHash('sha256').update(JSON.stringify(layout)).digest('hex'),capturedPayload,preservedExistingInstances:base.DECOR.reduce((s,g)=>s+g.items.length,0),activeInstances:layout.DECOR.reduce((s,g)=>s+g.items.length,0),unchangedDatasets:Object.keys(base).filter(k=>k!=='DECOR'),qa,scope:'Data equivalence and saved real-runtime QA evidence; geometric gaps are in candidate-audit.json. No iPad/FPS claim.'};
await fs.writeFile(path.join(dir,candidateMode?'candidate-sync-validation.json':'sync-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,mode:report.mode,rays:report.rays,preserved:report.preservedExistingInstances,active:report.activeInstances,sourceSha256:report.sourceSha256,budget:report.budget},null,2));
