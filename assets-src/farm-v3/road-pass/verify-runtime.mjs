import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import assert from 'node:assert/strict';
const dir=path.dirname(fileURLToPath(import.meta.url));
const reports=[];
for(const variant of ['baseline','candidate']){
 const source=await fs.readFile(path.join(dir,variant,'farm-decor.ts'),'utf8');
 const module=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
 const data=JSON.parse(await fs.readFile(path.join(dir,variant,'decor-layout.json'),'utf8'));
 assert.deepEqual(Object.keys(module).sort(),Object.keys(data).sort());
 for(const key of Object.keys(data))assert.deepEqual(module[key],data[key],variant+' '+key);
 reports.push({variant,exports:Object.keys(module).sort(),paths:module.PATHS.length,instances:module.DECOR.reduce((s,g)=>s+g.items.length,0),status:'pass'});
}
console.log(JSON.stringify(reports));
