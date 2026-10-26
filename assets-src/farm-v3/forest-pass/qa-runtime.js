import * as THREE from 'three';
import {DECOR,FENCES} from '/src/farm-decor.ts';
import {dressing} from '/src/decor.ts';
const base=await fetch('/baseline-layout.json').then(r=>r.json());
const proposal=await fetch('/candidate-audit.json').then(r=>r.json());
const herd=new Set(['cow','horse','sheep','goat','kid','pig','hen','chick','rooster','rabbit','duck','goose']);
const v=([x,z])=>new THREE.Vector3(x,0,z);
const paint=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
const source=await fetch('/source.json').then(r=>r.json());
const errors=[];addEventListener('error',e=>errors.push(e.message));
addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
while(!window.__game)await new Promise(r=>setTimeout(r,100));
const g=window.__game;await g.startMap('farm',true);g.voice.stop();
const map=g.map;map.update=()=>{};map.picked=true;
const keep=[...map.needs.flatMap(n=>[n.spot,...n.more.map(s=>s.spot)]),...[...map.critters.values()].filter(c=>!c.roams||c.name==='tractor').map(c=>c.home),...g.world.parts.map(p=>p.root.position),v([-30,-6.5]),...map.life.toySpots];
const author=await fetch('/baseline-authoring.json').then(r=>r.json());
const loop=Array.from({length:25},(_,i)=>v([29+Math.cos(i/24*2*Math.PI)*4.2,26.5+Math.sin(i/24*2*Math.PI)*6]));
const lines=[author.travel[0].map(v),[v([-23,-8]),v([-8,-8])],[v([30,12]),v([30,20.5])],loop];
const candidates=map.scenery.children.filter(o=>{let ok=o.isGroup&&o.children.length>20&&o.children.every(c=>c.isGroup);o.traverse(m=>{if(m.isMesh&&!m.isInstancedMesh)ok=false;});return ok;});
if(candidates.length!==1)throw Error('Cannot uniquely identify actual dressing group: '+candidates.length);
const after=candidates[0];
const before=dressing(base.DECOR.filter(d=>!herd.has(d.model)),FENCES,keep,lines).group;
map.scenery.add(before);before.visible=false;
const newGroups=DECOR.map((d,i)=>({...d,items:d.items.slice(base.DECOR[i].items.length)})).filter(d=>d.items.length);
const added=dressing(newGroups,[],keep,lines).group;map.scenery.add(added);added.visible=false;
const stats=group=>{let batches=0,instances=0,triangles=0;group.traverse(m=>{if(m.isInstancedMesh){batches++;instances+=m.count;triangles+=m.count*(m.geometry.index?.count??m.geometry.attributes.position.count)/3;}});return{batches,instances,triangles};};
const budget={before:stats(before),after:stats(after),additions:stats(added)};
let mode='after';
const areas={wide:[[-54,-37],[54,37]],northwest:[[-54,-37],[-19,-24]],north:[[-20,-37],[24,-24]],northeast:[[23,-37],[54,-21]],west:[[-54,-26],[-38,14]],east:[[43,-25],[54,23]]};
const taskAreas=[];
for(const [i,n] of map.needs.entries()){
  const task=author.tasks.find(t=>Math.hypot(t.workingPatch.center[0]-n.spot.x,t.workingPatch.center[1]-n.spot.z)<.5);
  const id='task-'+(task?.id??i),points=[...(n.focus??[n.critter.home,n.spot]),...n.more.map(s=>s.spot),...(task?[v(task.pole)]:[])];
  const xs=points.map(p=>p.x),zs=points.map(p=>p.z);
  areas[id]=[[Math.min(...xs)-2,Math.min(...zs)-2],[Math.max(...xs)+2,Math.max(...zs)+2]];
  taskAreas.push({id,ask:n.ask,critter:n.critter.name,spot:[n.spot.x,n.spot.z],nearestNewTree:Math.min(...proposal.added.filter(o=>o.model.startsWith('tree')).map(o=>Math.hypot(o.p[0]-n.spot.x,o.p[1]-n.spot.z)))});
}
function renderCost(){
  const info=g.stage.renderer.info,old=info.autoReset,samples=[];info.autoReset=false;
  try{for(let i=0;i<12;i++){info.reset();g.stage.render();samples.push({...info.render});}}finally{info.autoReset=old;}
  return{method:'12 synchronous complete Stage.render frames, info.autoReset=false with info.reset before each. Includes composer and shadow passes when scheduled; no timing/FPS claim.',samples,minTriangles:Math.min(...samples.map(s=>s.triangles)),maxTriangles:Math.max(...samples.map(s=>s.triangles)),maxCalls:Math.max(...samples.map(s=>s.calls))};
}

function occlusion(){
  g.stage.scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),camera=g.stage.camera,targets=[];
  for(const t of g.world.terminals()){const p=t.attachPoint(new THREE.Vector3());for(const [dx,dz] of [[0,0],[.12,0],[-.12,0],[0,.12],[0,-.12]])targets.push({id:t.id,type:'terminal',p:p.clone().add(new THREE.Vector3(dx,0,dz))});}
  for(const [i,slot] of map.needs.flatMap(n=>[n,...n.more]).entries()){
    const positions=slot.ring.geometry.attributes.position;
    for(let j=0;j<positions.count;j++)targets.push({id:i,type:'actual-working-outline',p:new THREE.Vector3().fromBufferAttribute(positions,j).applyMatrix4(slot.ring.matrixWorld)});
    targets.push({id:i,type:'working-center',p:slot.spot.clone().setY(.035)});
  }
  for(const t of author.tasks){const [x,z]=t.workingPatch.center,[w,d]=t.workingPatch.size;for(let j=0;j<=8;j++){const a=j/8;for(const [xx,zz] of [[x-w/2+w*a,z-d/2],[x-w/2+w*a,z+d/2],[x-w/2,z-d/2+d*a],[x+w/2,z-d/2+d*a]])targets.push({id:t.id,type:'author-working-pad',p:new THREE.Vector3(xx,.035,zz)});}}

  const hits=[];for(const t of targets){const direction=t.p.clone().sub(camera.position),distance=direction.length();ray.set(camera.position,direction.normalize());ray.near=0;ray.far=distance-.025;if(ray.intersectObject(added,true).length)hits.push({id:t.id,type:t.type});}
  return{sampledTargets:targets.length,terminalCount:[...g.world.terminals()].length,actualOutlineVertices:targets.filter(t=>t.type==='actual-working-outline').length,authorPadSamples:targets.filter(t=>t.type==='author-working-pad').length,workingCircles:map.needs.flatMap(n=>[n.spot,...n.more.map(s=>s.spot)]).length,addedOcclusions:hits};
}
window.forestQA={
  ready:true,areas:Object.keys(areas),
  async audit(){const reports=[];for(const area of Object.keys(areas))reports.push(await this.show('after',area));return reports;},
  async show(selected,area){mode=selected;before.visible=mode==='before';after.visible=mode==='after';const bounds=area==='north'&&innerWidth<600?[[-4,-36],[11,-29]]:areas[area];const pts=bounds.map(v);for(let i=0;i<3;i++){map.hooks.focus(pts);map.hooks.focus(pts,true);await paint();}g.stage.render();return this.report(area);},
  report(area){return{source,mode,area,viewport:[innerWidth,innerHeight],quality:g.stage.quality,budget,keep:keep.map(p=>[p.x,p.z]),occlusion:occlusion(),errors,contextLost:g.stage.renderer.getContext().isContextLost(),sculptedAdditions:proposal.added.length,taskAreas,renderCost:renderCost()};}
};
