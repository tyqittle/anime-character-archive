import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
const {plan,install}=createRequire(import.meta.url)('../assets/js/shared/cubism-motion-policy.js');
const file=name=>({File:'motions/'+name+'.motion3.json'});
test('all motions in named and unnamed groups are selectable, preserving existing keys and deduplicating files',()=>{
 const p=plan({Idle:[file('idle1'),file('idle2')],TapBody:[file('tap'),file('tap2')],'':[file('stand'),file('stand'),file('wave')]});
 assert.equal(p.entries.length,6);
 assert.ok(p.byKey.has('Idle')&&p.byKey.has('@motion:Idle:1')&&p.byKey.has('TapBody')&&p.byKey.has('@motion:2'));
 assert.equal(p.byKey.get('@motion:2').index,2);
 assert.equal(p.initial.group,'Idle');
 assert.deepEqual(plan({}).entries,[]);
});
test('real unnamed source ordering picks stand instead of a one-shot emotion',()=>{
 const p=plan({'':[file('Mgirl02_yihuo'),file('Mgirl02_stand_c'),file('Mgirl02_stand')]});
 assert.equal(p.initial.key,'@motion:2');
});
test('Unity .anim exports prefer the real standby over empty expression and effect clips',()=>{
 const p=plan({'':[file('Idle_Expression.anim'),file('EF_Idle.anim'),file('Idle.anim'),file('Idle_Action.anim')]});
 assert.equal(p.initial.key,'@motion:2');
});
function manager(){
 const m=new EventEmitter();
 m.definitions={'':[file('Mgirl02_yihuo'),file('Mgirl02_stand')]};
 m.groups={idle:'Idle'};m.motionGroups={'':[]};m.requests=[];
 m.createMotion=data=>({source:data.Meta.Loop,setIsLoop(loop){this.loop=loop},_motionData:{loop:data.Meta.Loop}});
 m.startMotion=async function(group,index,priority){this.requests.push({group,index,priority});this.emit('motionStart',group,index);return true};
 return m;
}
test('source loop flags reach the runtime and one-shot clips remain one-shot',async()=>{
 const m=manager(),original=m.createMotion,defs=m.definitions;
 const events=[],c=install({manager:m,onChange:key=>events.push(key)});
 assert.equal(m.createMotion({Meta:{Loop:true}},'',{}).loop,true);
 assert.equal(m.createMotion({Meta:{Loop:false}},'',{}).loop,false);
 assert.equal(m.definitions[m.groups.idle][0].File,'motions/Mgirl02_stand.motion3.json');
 await c.start();await c.play('@motion:0');await c.play('@motion:1');
 assert.deepEqual(m.requests.map(x=>x.priority),[1,3,3],'user selection must interrupt even another NORMAL-priority loop');
 m.emit('motionStart',m.groups.idle,0);assert.equal(events.at(-1),'@motion:1');
 c.dispose();c.dispose();
 assert.equal(m.createMotion,original);assert.equal(m.definitions,defs);assert.equal(m.groups.idle,'Idle');
 assert.equal(await c.play('@motion:0'),false);assert.equal(m.listenerCount('motionStart'),0);
});
test('zero-duration loop declarations cannot enter the native infinite time-wrap loop',()=>{
 const m=manager(),c=install({manager:m});
 assert.equal(m.createMotion({Meta:{Loop:true,Duration:0}},'',{}).loop,false);
 assert.equal(m.createMotion({Meta:{Loop:true,Duration:1}},'',{}).loop,true);
 assert.equal(m.createMotion({Meta:{Loop:false,Duration:0}},'',{}).loop,false);
 c.dispose();
});
test('late failures from replaced requests and disposed sessions do not overwrite current playback',async()=>{
 const m=manager(),waiting=[],errors=[];
 m.startMotion=()=>new Promise((resolve,reject)=>waiting.push({resolve,reject}));
 const c=install({manager:m,onError:e=>errors.push(e)});
 const old=c.play('@motion:0'),fresh=c.play('@motion:1');
 waiting[1].resolve(true);assert.equal(await fresh,true);
 waiting[0].reject(Error('old request'));assert.equal(await old,false);assert.deepEqual(errors,[]);
 const last=c.play('@motion:0');c.dispose();waiting[2].reject(Error('retired'));assert.equal(await last,false);assert.deepEqual(errors,[]);
});

test('timed-out motion requests settle and release the native reservation',async()=>{
 const m=manager(),errors=[];let stopped=0;
 m.startMotion=()=>new Promise(()=>{});m.stopAllMotions=()=>stopped++;
 const c=install({manager:m,timeoutMs:5,onError:e=>errors.push(e)});
 assert.equal(await c.play('@motion:0'),false);
 assert.equal(stopped,1);assert.equal(errors.length,1);assert.match(errors[0],/超时/);
 c.dispose();
});
test('disposing a pending session settles without waiting for its motion download',async()=>{
 const m=manager();m.startMotion=()=>new Promise(()=>{});
 const c=install({manager:m}),request=c.play('@motion:0');
 c.dispose();assert.equal(await request,false);
});

test('equal motion files with distinct audio or fades stay separate selectable source actions',()=>{
 const p=plan({Tap:[{File:'tap.motion3.json',Sound:'first.wav'},{File:'tap.motion3.json',Sound:'second.wav'},{File:'tap.motion3.json',FadeInTime:.5}]});
 assert.equal(p.entries.length,3);assert.equal(p.entries[1].key,'@motion:Tap:1');
});

test('one-shot preview overrides runtime looping only for that playback, then restores source flags',async()=>{
 const m=manager(),clip={loop:true,isLoop(){return this.loop},setIsLoop(v){this.loop=v}};
 m.loadMotion=async()=>clip;
 const c=install({manager:m});
 assert.equal(await c.play('@motion:0',3,{mode:'once',restart:true}),true);
 assert.equal(clip.loop,false);
 m.emit('motionFinish');assert.equal(clip.loop,true);
 await c.play('@motion:0',3,{mode:'loop',restart:true});assert.equal(clip.loop,true);
 c.dispose();
});

test('explicit replay restarts the same native action and waits for the actual clip to load',async()=>{
 const m=manager();let stops=0;
 m.state={currentGroup:'',currentIndex:0};m.stopAllMotions=()=>{stops++;m.state={}};
 const c=install({manager:m});
 assert.equal(await c.play('@motion:0',3,{mode:'once',restart:true}),true);
 assert.equal(stops,1);assert.equal(m.requests.length,1);
 c.dispose();
});

test('late successful clip loads cannot start an obsolete user selection',async()=>{
 const m=manager(),waiting=[];
 m.loadMotion=()=>new Promise(resolve=>waiting.push(resolve));
 const c=install({manager:m});
 const old=c.play('@motion:0',3,{mode:'once'}),fresh=c.play('@motion:1',3,{mode:'once'});
 assert.equal(waiting.length,2);
 waiting[1]({setIsLoop(){},isLoop:()=>true});assert.equal(await fresh,true);
 waiting[0]({setIsLoop(){},isLoop:()=>true});assert.equal(await old,false);
 assert.deepEqual(m.requests.map(x=>x.index),[1]);c.dispose();
});

test('a clip loaded after the request timeout cannot start playback late',async()=>{
 const m=manager(),errors=[];let resolve;
 m.loadMotion=()=>new Promise(done=>{resolve=done});m.stopAllMotions=()=>{};
 const c=install({manager:m,timeoutMs:5,onError:x=>errors.push(x)});
 assert.equal(await c.play('@motion:0',3,{mode:'once'}),false);
 resolve({isLoop:()=>true,setIsLoop(){}});await new Promise(done=>setTimeout(done,0));
 assert.equal(m.requests.length,0);assert.equal(errors.length,1);c.dispose();
});

test('explicit looping cannot enable zero-duration clips',async()=>{
 const m=manager(),clip={loop:false,isLoop(){return this.loop},setIsLoop(v){this.loop=v},getLoopDuration:()=>0};
 m.loadMotion=async()=>clip;const c=install({manager:m});
 await c.play('@motion:0',3,{mode:'loop'});assert.equal(clip.loop,false);c.dispose();
});

test('an old action ending while a new start waits for audio cannot restore the new clip loop',async()=>{
 const m=manager(),clip={loop:true,isLoop(){return this.loop},setIsLoop(v){this.loop=v}};let finishStart;
 m.loadMotion=async()=>clip;
 m.startMotion=(group,index)=>new Promise(resolve=>{finishStart=()=>{m.emit('motionStart',group,index);resolve(true)}});
 const c=install({manager:m}),request=c.play('@motion:0',3,{mode:'once'});
 await Promise.resolve();await Promise.resolve();m.emit('motionFinish');
 assert.equal(clip.loop,false);finishStart();assert.equal(await request,true);
 m.emit('motionFinish');assert.equal(clip.loop,true);c.dispose();
});
