import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { Vector3 } from 'three';
const root=process.cwd();
const out=path.join(root,'assets-src/design-pass/kit/city/street-life');
const source=fs.readFileSync('src/city.ts','utf8');
const decorSource=fs.readFileSync('src/city-decor.ts','utf8');
const excerpt=source.slice(source.indexOf('const W ='),source.indexOf('/** What each one says'));
const names=[...excerpt.matchAll(/const (\w+)\s*=/g)].map(m=>m[1]);
const v=(x,z)=>new Vector3(x,0,z);
const c=new Function('v',excerpt+`\nreturn {${names.join(',')}};`)(v);
const decorNames=[...decorSource.matchAll(/export const (\w+)/g)].map(m=>m[1]);
const dec=new Function(stripTypeScriptTypes(decorSource.replace(/export const/g,'const'))+`\nreturn {${decorNames.join(',')}};`)();
const planBody=source.slice(source.indexOf('function cityPlan()'),source.indexOf('/** White dashes'));
const plan=new Function('v','SOIL','PATHS','MEADOW',stripTypeScriptTypes(excerpt+'\n'+planBody)+'\nreturn cityPlan();')(v,dec.SOIL,dec.PATHS,dec.MEADOW);
const layout=JSON.parse(fs.readFileSync(path.join(out,'layout-proposal.json'),'utf8'));
// Conservative superset of named point anchors. Also add computed non-roaming critter homes.
const keep=Object.entries(c).filter(([,p])=>p instanceof Vector3).map(([name,p])=>({name,x:p.x,z:p.z}));
const add=(name,p,dx,dz)=>keep.push({name,x:p.x+dx,z:p.z+dz});
add('pigeon',c.FOUNTAIN,-2.2,3.2);add('pigeon2',c.FOUNTAIN,-3.4,2.4);
add('child',c.FERRIS_SPOT,-4.5,4.5);add('child2',c.FERRIS_SPOT,-3,5.5);
add('child6',c.MUSIC_SPOT,2.5,-1.5);add('child7',c.MUSIC_SPOT,4,-2);
add('firefighter',c.ENGINE_SPOT,3,-1);add('cat',c.BURNING,-1,0);
for(let i=0;i<3;i++)add(`schoolChild${i}`,c.SCHOOL_DOOR,-2+i*1.6,4);
const paths=['RACCOON_PATH','KITTEN_WAY','WASH_WAY','PARK_WAY','BOAT_WAY'].map(name=>({name,points:c[name].map(p=>[p.x,p.z])}));
paths.push({name:'schoolLaser',points:[c.LASER_SPOT,c.MIRROR_SPOT,c.SCHOOL_SENSOR].map(p=>[p.x,p.z])});
const seg=(x,z,[ax,az],[bx,bz])=>{const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-ax-dx*t,z-az-dz*t)};
const round=x=>Math.round(x*1000)/1000;
const reports=layout.items.map(p=>{
 const [x,z]=p.position,[w,h,d]=p.xyz,r=1.6+w/2;
 const nearest=keep.map(k=>({...k,distance:Math.hypot(x-k.x,z-k.z)})).sort((a,b)=>a.distance-b.distance)[0];
 const nearestLine=paths.map(l=>({name:l.name,distance:Math.min(...l.points.slice(1).map((b,i)=>seg(x,z,l.points[i],b)))})).sort((a,b)=>a.distance-b.distance)[0];
 // All streets in this map are axis-aligned; calculate AABB gaps to lane rectangles.
 const bounds=[x-w/2,z-d/2,x+w/2,z+d/2];
 const roadGaps=plan.lanes.flatMap(l=>l.pts.slice(1).map((b,i)=>{const a=l.pts[i];const rb=[Math.min(a[0],b[0])-l.w/2,Math.min(a[1],b[1])-l.w/2,Math.max(a[0],b[0])+l.w/2,Math.max(a[1],b[1])+l.w/2];return Math.hypot(Math.max(rb[0]-bounds[2],bounds[0]-rb[2],0),Math.max(rb[1]-bounds[3],bounds[1]-rb[3],0))}));
 const overlaps=[];
 for(const g of dec.DECOR.filter(g=>g.model!==p.id))for(const [gx,gz,yaw,scale]of g.items){const size=(g.fit.width??g.fit.height??1)*scale;const inside=gx>p.pad[0]-size/2&&gx<p.pad[2]+size/2&&gz>p.pad[1]-size/2&&gz<p.pad[3]+size/2;if(inside)overlaps.push({model:g.model,x:gx,z:gz,estimatedSize:round(size)});}
 return {id:p.id,position:p.position,proposedBounds:bounds,filterRadius:r,nearestPoint:{name:nearest.name,distance:round(nearest.distance),margin:round(nearest.distance-r)},nearestProtectedLine:{name:nearestLine.name,distance:round(nearestLine.distance),margin:round(nearestLine.distance-r)},roadFootprintGap:round(Math.min(...roadGaps)),passesAnchorAndLinePreflight:nearest.distance>r&&nearestLine.distance>r&&Math.min(...roadGaps)>0,existingDecorNearPad:overlaps};
});
const report={generatedAt:new Date().toISOString(),status:reports.every(x=>x.passesAnchorAndLinePreflight)?'preflight-pass-integration-pending':'revise-candidates',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),checks:['current source named anchors plus computed non-roaming critter homes','same 1.6 + width/2 keep/line rule, with conservative extra anchors','axis-aligned full proposed footprint gap to current road lanes','nearby DECOR footprint estimates for manual relocation'],limitations:['proposed model dimensions, not measured GLB bounds','not actual instantiated world.parts capture; future placements may change keep list','existing decor bounds are conservative square estimates','no rendered occlusion, gameplay route or physical iPad check','paved courts need Claude integration before placement is accepted'],items:reports};
fs.writeFileSync(path.join(out,'layout-preflight.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(out,'layout-inputs.json'),JSON.stringify({plan:{lanes:plan.lanes,field:plan.field,width:plan.width,depth:plan.depth},keep,paths,buildings:dec.DECOR.filter(g=>(g.fit.width??0)>4),layout},null,2)+'\n');
console.log(JSON.stringify(report,null,2));
