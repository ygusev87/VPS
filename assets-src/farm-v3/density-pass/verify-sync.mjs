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
const layout=await read(path.join(root,'assets-src/farm-v3/decor-layout.json'));
const author=await read(path.join(root,'assets-src/farm-v3/decor-authoring.json'));
const baselineAuthor=await read(path.join(dir,'baseline/decor-authoring.json'));
const candidate=await read(path.join(dir,'candidate/decor-layout.json'));
const source=await fs.readFile(path.join(root,'src/farm-decor.ts'),'utf8');
const runtime=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
equal(layout,candidate,'Applied data differs from reviewed candidate');
for(const key of Object.keys(layout))equal(runtime[key],layout[key],key+' source/layout drift');
for(const key of Object.keys(base).filter(k=>k!=='DECOR'))equal(layout[key],base[key],key+' changed outside scope');
assert.equal(layout.DECOR.length,base.DECOR.length);
for(let i=0;i<base.DECOR.length;i++){
  const a=base.DECOR[i],b=layout.DECOR[i];assert.equal(a.model,b.model);equal(a.fit,b.fit);
  equal(b.items.slice(0,a.items.length),a.items,'Existing positions changed: '+a.model);
  if(!['bush-lite','flower-cluster'].includes(a.model)&&!(a.model==='crop-wheat'&&a.fit.width===1.4))equal(a,b,'Out-of-scope group changed');
  assert(author.groups.some(g=>g.model===b.model&&JSON.stringify(g.fit)===JSON.stringify(b.fit)&&JSON.stringify(g.items)===JSON.stringify(b.items)),'Authoring mismatch '+b.model);
}
for(const key of Object.keys(baselineAuthor).filter(k=>k!=='groups'))equal(author[key],baselineAuthor[key],'Authoring anchor changed '+key);
for(const g of baselineAuthor.groups.filter(g=>g.category==='future-toy'))assert(author.groups.some(a=>JSON.stringify(a)===JSON.stringify(g)),'Future slot changed');
const qa=[];
for(const name of (await fs.readdir(dir)).filter(n=>/^(before|after)-.*\.json$/.test(n))){
  const r=await read(path.join(dir,name));assert.equal(r.contextLost,false,name);assert.equal(r.occlusion.addedOcclusions.length,0,name);assert.equal(r.budget.additions.instances,307,name);qa.push({file:name,viewport:r.viewport,area:r.area,targets:r.occlusion.sampledTargets});
}
assert(qa.some(q=>q.viewport[0]===1180)&&qa.some(q=>q.viewport[0]===390));
const snapshot=await read(path.join(dir,'snapshot.json'));
let capturedPayload='temporary snapshot no longer present';
const capturedSource=await fs.readFile(path.join(snapshot.snapshot,'src/farm-decor.ts'),'utf8').catch(()=>null);
if(capturedSource){const captured=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(capturedSource)).toString('base64'));for(const key of Object.keys(layout))equal(captured[key],layout[key],'Captured runtime payload differs: '+key);capturedPayload='matches applied data; source formatting only differs';}
const report={status:'pass',sourceSha256:createHash('sha256').update(source).digest('hex'),layoutSha256:createHash('sha256').update(JSON.stringify(layout)).digest('hex'),capturedPayload,preservedExistingInstances:base.DECOR.reduce((s,g)=>s+g.items.length,0),activeInstances:layout.DECOR.reduce((s,g)=>s+g.items.length,0),unchangedDatasets:Object.keys(base).filter(k=>k!=='DECOR'),qa,scope:'Data equivalence and saved real-runtime QA evidence; geometric gaps are in candidate-audit.json. No iPad/FPS claim.'};
await fs.writeFile(path.join(dir,'sync-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
