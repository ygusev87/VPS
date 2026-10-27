// Read-only model inspection; writes only this main-owned acceptance report.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {getBounds} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import sharp from 'sharp';
const base='assets-src/design-pass/kit/city/street-life';
const names=process.argv.slice(2);
if(!names.length)throw Error('Pass only new READY model IDs; accepted models are not rechecked automatically');
const allowed=new Set(['city-fruit-stall','city-bike-rack','city-playground','city-flower-planter','city-poster-column','city-drinking-fountain','city-street-bin','city-postbox']);
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const items=[];
for(const name of names){
 if(!allowed.has(name))throw Error('Outside active batch: '+name);
 const publicPath=`public/models/${name}.glb`,bytes=await fs.readFile(publicPath);
 const doc=await io.readBinary(bytes),root=doc.getRoot(),bounds=getBounds(root.listScenes()[0]);
 const sha256=createHash('sha256').update(bytes).digest('hex');
 const worker=JSON.parse(await fs.readFile(`${base}/models/${name}/report.json`,'utf8'));
 const triangles=root.listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0);
 const textures=await Promise.all(root.listTextures().map(async t=>{const m=await sharp(t.getImage()).metadata();return {mime:t.getMimeType(),width:m.width,height:m.height,format:m.format}}));
 const materials=root.listMaterials().map(m=>({alpha:m.getAlphaMode(),doubleSided:m.getDoubleSided()}));
 const extensions=root.listExtensionsUsed().map(e=>e.extensionName);
 const size=bounds.max.map((v,i)=>v-bounds.min[i]);
 const qa=JSON.parse(await fs.readFile(`${base}/models/${name}/qa.json`,'utf8'));
 const contacts=JSON.parse(await fs.readFile(`${base}/models/${name}/contacts.json`,'utf8'));
 const passed=sha256===worker.sha256&&bytes.length===worker.bytes&&triangles===worker.triangles&&triangles<=4000&&materials.length===1&&materials[0].alpha==='OPAQUE'&&textures.length===1&&textures[0].width===512&&textures[0].height===512&&textures[0].mime==='image/webp'&&extensions.includes('EXT_meshopt_compression')&&root.listSkins().length===0&&root.listAnimations().length===0&&Math.abs(bounds.min[1])<.001&&Math.abs(bounds.min[0]+bounds.max[0])<.001&&Math.abs(bounds.min[2]+bounds.max[2])<.001&&size.every((v,i)=>v<=worker.contract.targetXYZ[i]+.002)&&bytes.length<=150000;
 items.push({name,publicPath,sha256,bytes:bytes.length,triangles,materials,textures,extensions,bounds,size,skins:root.listSkins().length,animations:root.listAnimations().length,passed,workerEvidence:{qaChecks:qa.checks.length,qaConsole:qa.logs,contactPass:contacts.pass??contacts.pass_,floorSnap:worker.contract.floorSnap,contactAuditIndependentlyRepeated:false}});
}
const result={createdAt:new Date().toISOString(),status:items.every(i=>i.passed)?'PASS':'FAIL',method:'Main independently decoded committed public GLBs with Meshopt, calculated transformed bounds/counts and decoded embedded WebP dimensions; matched worker SHA/bytes. Contact analysis and original browser capture belong to worker.',totalBytes:items.reduce((n,i)=>n+i.bytes,0),totalTriangles:items.reduce((n,i)=>n+i.triangles,0),items};
let previous={items:[]};try{previous=JSON.parse(await fs.readFile(`${base}/remaining-props-main-audit.json`,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const retained=previous.items.filter(i=>!names.includes(i.name));
result.items=[...retained,...items];result.totalBytes=result.items.reduce((n,i)=>n+i.bytes,0);result.totalTriangles=result.items.reduce((n,i)=>n+i.triangles,0);
await fs.writeFile(`${base}/remaining-props-main-audit.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,totalBytes:result.totalBytes,totalTriangles:result.totalTriangles,items:items.map(({name,passed,size})=>({name,passed,size}))},null,2));
if(result.status!=='PASS')process.exitCode=1;
