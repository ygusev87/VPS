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
const areas={wide:[[-54,-37],[54,37]],yard:[[-24,-9],[30,12]],garden:[[-26,15],[36,35]],field:[[21,16],[35,34]],north:[[-51,-31],[36,-8]]};
function occlusion(){
  g.stage.scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),camera=g.stage.camera,targets=[];
  for(const t of g.world.terminals()){const p=t.attachPoint(new THREE.Vector3());for(const [dx,dz] of [[0,0],[.12,0],[-.12,0],[0,.12],[0,-.12]])targets.push({id:t.id,type:'terminal',p:p.clone().add(new THREE.Vector3(dx,0,dz))});}
  for(const [i,p] of map.needs.flatMap(n=>[n.spot,...n.more.map(s=>s.spot)]).entries())for(let j=0;j<12;j++)targets.push({id:i,type:'working-circle',p:p.clone().setY(.035).add(new THREE.Vector3(Math.cos(j/12*2*Math.PI)*1.2,0,Math.sin(j/12*2*Math.PI)*1.2))});
  const hits=[];for(const t of targets){const direction=t.p.clone().sub(camera.position),distance=direction.length();ray.set(camera.position,direction.normalize());ray.near=0;ray.far=distance-.025;if(ray.intersectObject(added,true).length)hits.push({id:t.id,type:t.type});}
  return{sampledTargets:targets.length,terminalCount:[...g.world.terminals()].length,workingCircles:map.needs.flatMap(n=>[n.spot,...n.more.map(s=>s.spot)]).length,addedOcclusions:hits};
}
window.densityQA={
  ready:true,
  async show(selected,area){mode=selected;before.visible=mode==='before';after.visible=mode==='after';const pts=areas[area].map(v);for(let i=0;i<3;i++){map.hooks.focus(pts);map.hooks.focus(pts,true);await paint();}g.stage.render();return this.report(area);},
  report(area){return{source,mode,area,viewport:[innerWidth,innerHeight],quality:g.stage.quality,budget,keep:keep.map(p=>[p.x,p.z]),occlusion:occlusion(),errors,contextLost:g.stage.renderer.getContext().isContextLost(),sculptedAdditions:proposal.added.length};}
};
