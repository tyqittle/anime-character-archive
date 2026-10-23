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
