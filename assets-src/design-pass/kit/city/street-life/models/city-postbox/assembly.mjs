import * as T from 'three';
const mesh=(g,c)=>new T.Mesh(g,new T.MeshStandardMaterial({color:c,roughness:.6}));
export function createAssembly(kind){const root=new T.Group(),parts={};if(kind==='city-postbox'){
 const flag=new T.Group(),stick=mesh(new T.BoxGeometry(.04,.4,.04),'#d8483c'),cloth=mesh(new T.BoxGeometry(.03,.14,.2),'#d8483c');stick.position.y=.2;cloth.position.set(0,.34,.1);flag.add(stick,cloth);flag.position.set(.24,.95,.1);const letter=mesh(new T.BoxGeometry(.34,.02,.24),'#ffffff');letter.visible=false;root.add(flag,letter);Object.assign(parts,{flag,letter});
}else{
 const lid=new T.Group(),top=mesh(new T.CylinderGeometry(.42,.42,.06,16),'#4a6a8a');top.position.z=.4;lid.add(top);lid.position.set(0,.92,-.4);
 const cat=new T.Group(),head=mesh(new T.SphereGeometry(.2,14,10),'#f2a24a'),ears=[-.11,.11].map(x=>{const e=mesh(new T.ConeGeometry(.07,.14,6),'#f2a24a');e.position.set(x,.18,0);return e}),bone=mesh(new T.BoxGeometry(.3,.03,.05),'#ffffff');bone.position.set(0,-.08,.2);cat.add(head,...ears,bone);cat.userData.y0=.7;cat.position.y=.7;cat.visible=false;root.add(lid,cat);Object.assign(parts,{lid,cat});
}return{root,parts,kind};}
export function setTime(assembly,k){const P=assembly.parts;if(assembly.kind==='city-postbox'){
 P.flag.rotation.z=-Math.min(1,k/.2)*Math.PI/2;const f=Math.max(0,k-.2);P.letter.visible=f>0&&f<2.4;P.letter.position.set(.35+f*1.2,1.05+f*1.4,Math.sin(f*5)*.4);P.letter.rotation.set(Math.sin(f*7)*.6,f*2,Math.sin(f*4)*.5);if(k>3)P.flag.rotation.z=0;
}else{
 const up=k<.25?k/.25:k<1.8?1:Math.max(0,1-(k-1.8)/.3);P.lid.rotation.x=-up*1.9;P.cat.visible=up>.05;P.cat.position.y=.7+up*.45;P.cat.rotation.y=k>.3&&k<1.7?Math.sin(k*5)*.7:0;
}assembly.root.updateMatrixWorld(true);}
