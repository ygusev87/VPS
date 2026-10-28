import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../../../../../..'),worker=path.resolve(here,'../model-worker');
const sha=b=>createHash('sha256').update(b).digest('hex'),eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
await MeshoptDecoder.ready;const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const oldBytes=await fs.readFile(path.join(worker,'originals/kitten.glb')),newBytes=await fs.readFile(path.join(repo,'public/models/kitten.glb'));
const a=(await io.readBinary(oldBytes)).getRoot(),b=(await io.readBinary(newBytes)).getRoot();
function geometry(r){return {nodes:r.listNodes().map(n=>({name:n.getName(),matrix:n.getWorldMatrix(),mesh:r.listMeshes().indexOf(n.getMesh())})),meshes:r.listMeshes().map(m=>m.listPrimitives().map(p=>({indices:Array.from(p.getIndices().getArray()),attrs:Object.fromEntries(p.listSemantics().map(s=>[s,{normalized:p.getAttribute(s).getNormalized(),type:p.getAttribute(s).getType(),data:Array.from(p.getAttribute(s).getArray())}]))}))),skins:r.listSkins().length,animations:r.listAnimations().length};}
const material=r=>r.listMaterials().map(m=>({alpha:m.getAlphaMode(),color:m.getBaseColorFactor(),metal:m.getMetallicFactor(),rough:m.getRoughnessFactor(),doubleSided:m.getDoubleSided(),emissive:m.getEmissiveFactor(),ormSHA:sha(m.getMetallicRoughnessTexture().getImage())}));
const tractorOld=await fs.readFile(path.join(worker,'originals/tractor.glb')),tractorPublic=await fs.readFile(path.join(repo,'public/models/tractor.glb'));
const exactDecodedGeometry=eq(geometry(a),geometry(b)),materialExceptBaseImageExact=eq(material(a),material(b)),tractorPublicUnchanged=sha(tractorOld)===sha(tractorPublic);
const report={pass:exactDecodedGeometry&&materialExceptBaseImageExact&&tractorPublicUnchanged,kitten:{originalSHA:sha(oldBytes),publicSHA:sha(newBytes),publicBytes:newBytes.length,exactDecodedGeometry,materialExceptBaseImageExact,baseImageChanged:sha(a.listMaterials()[0].getBaseColorTexture().getImage())!==sha(b.listMaterials()[0].getBaseColorTexture().getImage()),triangles:b.listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+p.getIndices().getCount()/3,0)},tractor:{publicSHA:sha(tractorPublic),publicUnchanged:tractorPublicUnchanged,bytes:tractorPublic.length,acceptedForWheelAnimation:false},limits:'Independent decode/hash checks; worker native screenshots reviewed separately. No repeat of worker section/collision calculations and no full farm/iPad acceptance.'};
await fs.writeFile(path.join(here,'audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
