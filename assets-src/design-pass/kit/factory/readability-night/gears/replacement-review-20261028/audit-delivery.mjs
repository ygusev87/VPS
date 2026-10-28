import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const root=process.cwd();
const req=createRequire(root+'/package.json');
const {NodeIO}=await import(req.resolve('@gltf-transform/core'));
const {ALL_EXTENSIONS}=await import(req.resolve('@gltf-transform/extensions'));
const {MeshoptDecoder}=await import(req.resolve('meshoptimizer'));
const threeModule=await import(req.resolve('three'));
const T=threeModule.default??threeModule;
const validator=(await import(req.resolve('gltf-validator'))).default;
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const hash=x=>createHash('sha256').update(x).digest('hex');
function slice(poly,y,sign){let out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[1]-y)*sign,db=(b[1]-y)*sign;if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));}}return out;}
const summaries=[];
for(const [name,r] of [['small',.4],['medium',.6],['big',1]]){
 const file=`public/models/factory-gear-${name}.glb`,bytes=await fs.readFile(root+'/'+file),doc=await io.readBinary(bytes),rt=doc.getRoot();
 const pts=[],tris=[];
 for(const node of rt.listNodes()){if(!node.getMesh())continue;const mat=new T.Matrix4().fromArray(node.getWorldMatrix());for(const prim of node.getMesh().listPrimitives()){const a=prim.getAttribute('POSITION'),off=pts.length;for(let i=0;i<a.getCount();i++)pts.push(new T.Vector3(...a.getElement(i,[])).applyMatrix4(mat).toArray());const ix=prim.getIndices().getArray();for(let i=0;i<ix.length;i+=3)tris.push([ix[i]+off,ix[i+1]+off,ix[i+2]+off]);}}
 const bounds={min:[0,1,2].map(k=>Math.min(...pts.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...pts.map(p=>p[k])))};
 const slabs=[[-.099,-.069,.3*r-.001],[-.069,.069,r],[.069,.084,.7*r],[.084,.099,.3*r-.001]].map(([lo,hi,radius])=>({lo,hi,radius,maxRadius:0,count:0,violations:0}));let violations=[];
 for(let i=0;i<tris.length;i++){const t=tris[i].map(j=>pts[j]),lo=Math.min(...t.map(p=>p[1])),hi=Math.max(...t.map(p=>p[1]));if(lo<-.099-1e-7||hi>.099+1e-7)violations.push({i,type:'height'});
 if(hi-lo<1e-12){const allowed=Math.max(0,...slabs.filter(s=>lo>=s.lo-1e-12&&lo<=s.hi+1e-12).map(s=>s.radius));if(t.some(p=>Math.hypot(p[0],p[2])>allowed+1e-7))violations.push({i,type:'horizontal'});continue;}
 for(const s of slabs){if(hi<=s.lo||lo>=s.hi)continue;const poly=slice(slice(t,s.lo,1),s.hi,-1);if(poly.length<3)continue;const radius=Math.max(...poly.map(p=>Math.hypot(p[0],p[2])));s.count++;s.maxRadius=Math.max(s.maxRadius,radius);if(radius>s.radius+1e-7){s.violations++;violations.push({i,type:'radial',radius,allowed:s.radius});}}
 }
 const edgeMap=new Map();const k=p=>p.map(v=>Math.round(v/1e-6)).join(',');let capTriangles=0,wrongCapWinding=0,capCoversOrigin=0,capArea=0;
 for(const ix of tris){const t=ix.map(i=>pts[i]);for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3];if(a[1]>.0969&&b[1]>.0969){const key=[k(a),k(b)].sort().join('|');edgeMap.set(key,(edgeMap.get(key)||0)+1);}}
 if(name==='big'&&t.every(p=>p[1]>.0969)){capTriangles++;const a=new T.Vector3(...t[0]),b=new T.Vector3(...t[1]),c=new T.Vector3(...t[2]);const cr=b.sub(a).cross(c.sub(a));capArea+=cr.length()/2;if(cr.y<=0)wrongCapWinding++;const sign=(a,b)=>a[0]*b[2]-a[2]*b[0];const s=t.map((p,j)=>sign(p,t[(j+1)%3]));if(s.every(x=>x>=-1e-12)||s.every(x=>x<=1e-12))capCoversOrigin++;}}
 const v=(await validator.validateBytes(bytes,{uri:file})).issues;
 const meta={materials:rt.listMaterials().map(m=>({alphaMode:m.getAlphaMode(),doubleSided:m.getDoubleSided()})),textures:rt.listTextures().map(t=>({mime:t.getMimeType(),size:t.getSize()})),skins:rt.listSkins().length,animations:rt.listAnimations().length,extensions:rt.listExtensionsUsed().map(e=>e.extensionName)};
 const saved=JSON.parse(await fs.readFile(root+`/assets-src/design-pass/kit/factory/machines-3d/gears-cosmetic/factory-gear-${name}-report.json`,'utf8'));
 const result={name,file,sha256:hash(bytes),matchesWorkerSHA:hash(bytes)===saved.sha256,bytes:bytes.length,triangles:tris.length,bounds,radialMax:Math.max(...pts.map(p=>Math.hypot(p[0],p[2]))),slabs,violationCount:violations.length,examples:violations.slice(0,5),...meta,validation:{errors:v.numErrors,warnings:v.numWarnings,infos:v.numInfos},cap:name==='big'?{triangles:capTriangles,wrongWinding:wrongCapWinding,coversOriginTriangles:capCoversOrigin,area:capArea,edgesNearCap:edgeMap.size,edgesWithIncidenceOtherThanTwo:[...edgeMap.values()].filter(n=>n!==2).length,scope:'Only decoded cap region; not a global mesh watertightness assertion.'}:null};
 result.pass=result.matchesWorkerSHA&&bytes.length<=150000&&tris.length<=4000&&!violations.length&&meta.materials.length===1&&meta.materials[0].alphaMode==='OPAQUE'&&meta.textures.length===1&&meta.textures[0].mime==='image/webp'&&meta.textures[0].size.every(x=>x===512)&&meta.extensions.includes('EXT_meshopt_compression')&&meta.skins===0&&meta.animations===0&&v.numErrors===0&&v.numWarnings===0&&(!result.cap||(result.cap.triangles===100&&result.cap.wrongWinding===0&&result.cap.coversOriginTriangles===0&&result.cap.edgesWithIncidenceOtherThanTwo===0));
 summaries.push(result);
}
const out={createdAt:new Date().toISOString(),method:'Independent decoded world-space GLB triangle clipping in each constant-radius Y slab. Boundaries handled separately for horizontal faces. Entire Y rotation preserves radius; this proves union containment, not tooth meshing or full-scene collisions.',models:summaries,pass:summaries.every(s=>s.pass),bytes:summaries.reduce((n,s)=>n+s.bytes,0),triangles:summaries.reduce((n,s)=>n+s.triangles,0)};
const output=process.argv[2] ?? '/tmp/codex-gear-delivery-audit.json';
await fs.writeFile(output,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({output,pass:out.pass,bytes:out.bytes,triangles:out.triangles,models:out.models.map(m=>({name:m.name,pass:m.pass,violations:m.violationCount,cap:m.cap}))}));
if(!out.pass) process.exitCode=1;
