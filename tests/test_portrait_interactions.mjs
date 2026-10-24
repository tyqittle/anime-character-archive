import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {plan,isTap}=createRequire(import.meta.url)('../assets/js/shared/portrait-interactions.js');
const entry=(key,group=key,file='')=>({key,group,definition:{File:file}});
test('source hit regions resolve camel-case and motion filename aliases, with specific regions first',()=>{
 const p=plan({areas:['Body','Head'],entries:[entry('idle'),entry('head-1','tapHead'),entry('body-1','touch_body')]});
 assert.equal(p.mode,'source');
 assert.equal(p.resolve({hits:['Body','Head']}).entry.key,'head-1');
 assert.equal(p.resolve({hits:['Body']}).entry.key,'body-1');
 assert.equal(p.resolve({hits:[],point:{x:50,y:10},bounds:{x:0,y:0,width:100,height:100}}),null);
});
test('anonymous source motion groups are mapped by actual file names and variants remain reachable',()=>{
 const p=plan({areas:['TouchHead'],entries:[entry('@motion:0','','motions/TouchHead_01.motion3.json'),
  entry('@motion:1','','motions/TouchHead_02.motion3.json')]});
 assert.equal(p.resolve({hits:['TouchHead']}).entry.key,'@motion:0');
 assert.equal(p.resolve({hits:['TouchHead']}).entry.key,'@motion:1');
});
test('missing hit geometry uses labeled estimates only for supplied interaction clips',()=>{
 const p=plan({entries:[entry('idle'),entry('touch_head'),entry('touch_body'),entry('touch_special')]});
 const bounds={x:0,y:0,width:100,height:100};
 assert.equal(p.mode,'estimated');
 assert.equal(p.resolve({point:{x:50,y:10},bounds}).entry.key,'touch_head');
 assert.equal(p.resolve({point:{x:50,y:60},bounds}).entry.key,'touch_body');
 assert.equal(p.resolve({point:{x:50,y:90},bounds}).entry.key,'touch_body');
 assert.equal(p.resolve({point:{x:50,y:90,yDown:false},bounds}).entry.key,'touch_head');
 assert.equal(p.resolve({point:{x:150,y:60},bounds}),null);
});
test('a stand-only export never pretends to contain body interactions or selects attack clips',()=>{
 for(const entries of [[entry('stand','','motions/Mgirl01_stand.motion3.json')],[entry('idle'),entry('attack')]]){
  const p=plan({entries});assert.equal(p.mode,'none');
  assert.equal(p.resolve({point:{x:50,y:50},bounds:{x:0,y:0,width:100,height:100}}),null);
 }
});
test('source region aliases also support Chinese and Japanese interaction labels',()=>{
 const p=plan({areas:['頭','身体'],entries:[entry('h','','motions/頭_タッチ.motion3.json'),
  entry('b','','motions/身体触摸.motion3.json')]});
 assert.equal(p.resolve({hits:['頭']}).entry.key,'h');
 assert.equal(p.resolve({hits:['身体']}).entry.key,'b');
});
test('dragging out and back, canceled generations and pinch gestures cannot become taps',()=>{
 const start={id:1,x:10,y:10,generation:2},end={pointerId:1,clientX:10,clientY:10};
 assert.equal(isTap(start,end,{generation:2}),true);
 assert.equal(isTap({...start,moved:true},end),false);
 assert.equal(isTap({...start,multiple:true},end),false);
 assert.equal(isTap(start,end,{generation:3}),false);
 assert.equal(isTap(start,{...end,pointerId:2}),false);
});
