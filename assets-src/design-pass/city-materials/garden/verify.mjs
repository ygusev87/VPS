import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../../../..');
const data=await import(root+'/src/city-decor.ts'),candidate=JSON.parse(await fs.readFile(dir+'/candidate.json')),base=JSON.parse(await fs.readFile(dir+'/baseline.json')),audit=JSON.parse(await fs.readFile(dir+'/audit.json'));
assert.deepEqual(data.DECOR,candidate.DECOR);
assert.deepEqual(data.DECOR.slice(0,base.DECOR.length),base.DECOR);
for(const k of ['FENCES','PATHS','SOIL','MEADOW','PONDS'])assert.deepEqual(data[k],base[k]);
const snap=JSON.parse(await fs.readFile(dir+'/snapshot.json'));
// Formatting the final TS did not change the rendered numerical payload.
const rendered=await import(snap.snapshot+'/src/city-decor.ts');
assert.deepEqual(rendered.DECOR,data.DECOR);assert.deepEqual(rendered.SOIL,data.SOIL);
const finalSha=createHash('sha256').update(await fs.readFile(root+'/src/city-decor.ts')).digest('hex');
const scans=[];for(const width of [1180,390,1024]){const r=JSON.parse(await fs.readFile(dir+'/qa/scan-final-'+width+'.json'));assert.equal(r.results.length,14);assert.equal(r.addedOcclusions,0);assert.equal(r.contextLost,false);assert.equal(r.errors.length,0);assert(r.acceptance.every(x=>x.planned===x.drawn));scans.push({viewport:r.viewport,tasks:r.results.length,rays:r.results.reduce((n,x)=>n+x.sampledTargets,0),newOcclusions:0});}
assert.equal(audit.added.length,273);
for(const [file,sha]of Object.entries(snap.gameHashes)){const hash=createHash('sha256').update(await fs.readFile(root+'/'+file)).digest('hex');assert.equal(hash,sha,'Runtime changed since QA: '+file);}
const result={status:'pass',finalDecorSha256:finalSha,renderedDecorSha256:snap.candidateSha256,numericalPayloadMatches:true,preservedBaselineGroups:base.DECOR.length,preservedTerrainArrays:5,added:audit.groups,scans,limitations:['Perspective geometry tests of new planting, not every historic occlusion or user camera.','Desktop IAB q1; physical iPad/FPS/q2/PWA not tested.','Screenshot wrapper is1280x720:390x844 and1024x768 lower UI extends below captured area; JSON checks use full iframe size.']};
await fs.writeFile(dir+'/verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
