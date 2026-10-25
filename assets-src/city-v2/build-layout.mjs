/** Extract fixed city anchors without executing game code. This is a planning report, not gameplay data. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(root, 'src/city.ts'), 'utf8');
const values = {};
// Deliberately small arithmetic/data grammar: no execution, imports or arbitrary calls.
function expression(input) {
  const compact=input.replace(/\s+/g,'');
  const tokens=compact.match(/\d+(?:\.\d+)?|[A-Za-z_]\w*|[{}\[\](),.:+*/-]/g) ?? [];
  if(tokens.join('')!==compact) throw Error('Unsupported token: '+input);
  let i=0;
  const take=(t)=>{if(tokens[i++]!==t) throw Error('Expected '+t+' in '+input);};
  function atom() {
    let t=tokens[i++], value;
    if(t==='-') return -atom();
    if(t==='(') {value=calc();take(')');}
    else if(t==='[') {value=[];if(tokens[i]!==']') {do {value.push(calc());if(tokens[i]!==',') break;i++;} while(tokens[i]!==']');}take(']');}
    else if(t==='{') {value={};if(tokens[i]!=='}') {do {const key=tokens[i++];take(':');value[key]=calc();if(tokens[i]!==',') break;i++;} while(tokens[i]!=='}');}take('}');}
    else if(t==='v') {take('(');const x=calc();take(',');const z=calc();take(')');value=[x,z];}
    else if(/^\d/.test(t??'')) value=Number(t);
    else if(Object.hasOwn(values,t)) value=values[t];
    else throw Error('Unknown identifier '+t);
    while(tokens[i]==='.') {i++; const key=tokens[i++]; value=Array.isArray(value)&&['x','z'].includes(key)?value[key==='x'?0:1]:value[key];if(value===undefined)throw Error('Unknown property '+key);}
    return value;
  }
  const prec={'+':1,'-':1,'*':2,'/':2};
  function calc(min=0) {let a=atom();while((prec[tokens[i]]??-1)>=min) {const op=tokens[i++],b=calc(prec[op]+1);a=op==='+'?a+b:op==='-'?a-b:op==='*'?a*b:a/b;}return a;}
  const result=calc();if(i!==tokens.length)throw Error('Trailing expression '+input);return result;
}
const block=source.slice(source.indexOf('const W ='),source.indexOf('const CITY_VOICES')).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
for(const m of block.matchAll(/const (\w+) = ([^;]+);/g)) values[m[1]]=expression(m[2]);
const decorSource=fs.readFileSync(path.join(root,'src/city-decor.ts'),'utf8');
const soilMatch=decorSource.match(/export const SOIL[^=]*=\s*([^;]+);/);
const pathsMatch=decorSource.match(/export const PATHS[\s\S]*?=\s*(\[[\s\S]*?\]);/);
if(!soilMatch||!pathsMatch)throw Error('Missing terrain exports');
const park=expression(soilMatch[1])[0];
const extraPaths=expression(pathsMatch[1]);
const definitions=[
 ['traffic','Перекрёсток','day',['LIGHT_SPOT'],['LIGHT_POLE']],
 ['tram','Трамвай','day',['TRAM_SWITCH'],['SUB_POLE']],
 ['bakery','Пекарня','day',['OVEN_SPOT','BELT_SPOT'],['BAKERY_POLE']],
 ['parking','Парковка','day',['BARRIER_SPOT','PARK_BUTTON'],['PARK_POLE']],
 ['ferris','Колесо от ветряка','day',['FERRIS_SPOT','WIND_SPOT'],[]],
 ['wash','Автомойка','day',['WASH_SPOT','WASH_PUMP'],['WASH_POLE']],
 ['grandma','Лифт с корзиной','day',['LIFT_SPOT','LIFT_BUTTON'],['HOUSE_POLE']],
 ['crane','Стройка','day',['CRANE_SPOT','CRANE_SWITCH'],['CRANE_POLE']],
 ['bridge','Разводной мост','day',['BRIDGE_SPOT','BRIDGE_BUTTON'],['BRIDGE_POLE']],
 ['kitten','Дорожка котёнка','evening',['LAMPS'],['KITTEN_POLE']],
 ['club','Клуб','evening',['NEON_SPOT','CLUB_SENSOR','MUSIC_SPOT'],['CLUB_POLE']],
 ['fire','Пожар и спасение','evening',['ENGINE_SPOT','LADDER_SPOT','HYDRANT_SPOT'],['STATION_POLE','FIRE_POLE']],
 ['raccoon','Енот и сигнализация','night',['DOMINO_SPOT','ALARM_SPOT'],['SHOP_POLE']],
 ['school','Школьный звонок','morning',['LASER_SPOT','MIRROR_SPOT','SCHOOL_SENSOR','SCHOOL_BELL'],['SCHOOL_POLE']],
];
const expand=(names)=>names.flatMap(name=> {
 const val=values[name]; if (!val) throw Error('Missing anchor '+name);
 return typeof val[0]==='number' ? [{anchor:name,center:val}] : val.map((center,i)=>({anchor:`${name}[${i}]`,center}));
});
const tasks=definitions.map(([id,title,phase,patches,poles],i)=>({number:i+1,id,title,phase,patches:expand(patches).map(p=>({...p,size:[4,4],meaning:'nominal protected placement envelope; existing linked slots may overlap'})),poles:expand(poles)}));
const r=values.RING,w=values.ROAD;
const lanes=[
 {id:'ring',points:[[-r.x,-r.z],[r.x,-r.z],[r.x,r.z],[-r.x,r.z],[-r.x,-r.z]],width:w},
 {id:'north',points:[[0,-r.z],[0,-values.D/2]],width:w},
 {id:'south',points:[[0,r.z],[0,values.D/2]],width:w},
 {id:'west',points:[[-r.x,0],[-values.W/2,0]],width:w},
 {id:'east',points:[[r.x,0],[values.W/2,0]],width:w},
 {id:'tram',points:[[-values.W/2,values.TRAM_Z],[values.W/2,values.TRAM_Z]],width:4},
 ...extraPaths.map((p,i)=>({id:'decor-path-'+i,...p})),
];
const file={
 status:'proposal for art direction; anchors copied from current source, no gameplay changes',
 source:{path:'src/city.ts',sha256:crypto.createHash('sha256').update(source).digest('hex'),decorSha256:crypto.createHash('sha256').update(decorSource).digest('hex'),referenceCommit:'3166f41',extractor:'assets-src/city-v2/build-layout.mjs'},
 coordinates:'x right/east, z down/south; metres are game world units; concept PNG is illustrative, not a measured plan',
 bounds:{width:values.W,depth:values.D,x:[-values.W/2,values.W/2],z:[-values.D/2,values.D/2]},
 park:{...park,locked:true,source:'src/city-decor.ts SOIL[0]'},
 lanes,canal:values.CANAL,harbor:values.HARBOR,
 anchors:Object.fromEntries(Object.entries(values).filter(([k])=>k!=='Math')),
 tasks,
 protectedRoutes:['PARK_WAY','WASH_WAY','BOAT_WAY','KITTEN_WAY','RACCOON_PATH'].map(name=>({name,points:values[name],rule:'reserve moving body width plus margin; final envelope checked against actual models'})).concat([{name:'SCHOOL_BEAM',points:[values.LASER_SPOT,values.MIRROR_SPOT,values.SCHOOL_SENSOR],rule:'keep all new decoration outside beam corridor'}]),
 artZones:[
 {id:'north-street',area:[-52,-36,32,-24],intent:'Townhouse fronts, bakery and school; open forecourts face south, short tree/planter groups behind and between buildings.'},
 {id:'west-courts',area:[-52,-16,-25,24],intent:'Parking north of west road; wash south of it; crane further south. Separate forecourts; no row houses in vehicle corridors.'},
 {id:'park',area:[-16.5,-8.5,16.5,8.5],intent:'Frame the perimeter with low planters; fountain, Ferris wheel, turbine and kitten path remain open. No dense canopy over devices.'},
 {id:'east-bank',area:[40,-36,54,22],intent:'Toy shop, club and rescue house; a clear raccoon alley behind shops, open bridge landing and fire forecourt.'},
 {id:'south-street',area:[-54,29.5,54,36.5],intent:'Compact residential clusters beside tram, excluding substation/switch and center-road corridor.'},
 ],
 reuse:['bakery','baker','grandma','tram','car','kitten','tree-oak-lite','tree-pine-lite','bush-lite','flower-cluster-lite','rock-cluster'],
 needsBeforeDecorCommit:['Fit new facade dimensions to locked device courts; do not infer collision boxes from concept PNG.','Check HOUSES/source bounds and ground bake against every placement.','Keep south facades within z37.5 and clear of tram width4.','Never suppress a stand-in or request a missing model until its GLB is delivered.'],
 discrepanciesToKeepExplicit:['Grandma concept still shows two full floors plus attic; final house reference must have three explicit floors and balcony y1.95.','Concept depicts scenic details/finished devices and nearby figures not yet present as GLBs.','Concept has aspirational planting density; use lite repeated assets, measured budgets and task clearances for implementation.'],
};
const needBlock=source.slice(source.indexOf('private buildNeeds()'),source.indexOf('private on('));
if (tasks.length!==14 || (needBlock.match(/add\(\{/g)??[]).length!==tasks.length) throw Error('Task count changed; review mapping');
let checked=0;
for (const t of tasks) for (const p of [...t.patches,...t.poles]) {
 const [x,z]=p.center; if (!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>values.W/2||Math.abs(z)>values.D/2) throw Error('Out of bounds '+p.anchor); checked++;
}
if (values.MIRROR_SPOT[0]-values.LASER_SPOT[0]!==7 || values.MIRROR_SPOT[1]!==values.LASER_SPOT[1] || values.SCHOOL_SENSOR[0]!==values.MIRROR_SPOT[0] || values.SCHOOL_SENSOR[1]-values.MIRROR_SPOT[1]!==5.5) throw Error('School geometry drift');
file.checks={taskCount:14,inBoundsTaskAnchorsAndPoles:checked,schoolBeamGeometry:'7 by 5.5, exact source values',imageIsCoordinateAuthority:false,buildingCollisionCheck:'pending actual final decoration/model footprints'};
fs.writeFileSync(path.join(root,'assets-src/city-v2/layout-proposal.json'),JSON.stringify(file,null,2)+'\n');
console.log(JSON.stringify(file.checks));
