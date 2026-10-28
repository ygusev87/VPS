// Read-only control-flow reproduction against the real Voice source.
// Audio decoding, playback, network and clock are stubs; this is not an audible browser test.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const source=readFileSync('src/voice.ts','utf8');
const code=stripTypeScriptTypes(source.replace(/export /g,'').replace(/import\.meta\.env/g,"({DEV:false,BASE_URL:'/'})"))+'\nthis.VoiceForReview=Voice;';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function scenario(action){
 let now=10000,serial=0;const timers=new Map(),events=[];
 const sandbox={performance:{now:()=>now},fetch:async()=>({ok:false}),window:{},console,setTimeout:(fn,ms=0)=>{const id=++serial;timers.set(id,{fn,at:now+ms});return id},clearTimeout:id=>timers.delete(id)};
 vm.createContext(sandbox);vm.runInContext(code,sandbox);
 const v=new sandbox.VoiceForReview();await flush();
 v.sounds.set('squeak',{takes:['sfx:test-mouse'],intro:[],cue:true});
 v.decode=async()=>({duration:.49});v.play=()=>{};
 // Observe calls to the real words() entry point without needing a sound device.
 const originalWords=v.words.bind(v);v.words=id=>{events.push({id,at:now});return originalWords(id)};
 v.say('squeak',0);await flush();now=10100;
 if(action==='new-hint')v.say('connect',0);else v.stop();
 await flush();
 while(timers.size){const [id,t]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];timers.delete(id);now=t.at;t.fn();await flush();}
 return {action,events,lateSqueak:events.some(e=>e.id==='squeak'&&e.at>10100)};
}
console.log(JSON.stringify({sourceSHA:createHash('sha256').update(source).digest('hex'),scenarios:await Promise.all(['new-hint','stop'].map(scenario))},null,2));
