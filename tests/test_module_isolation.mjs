// Inject failures at module boundaries; these are behavior regressions, not source mirrors.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function context(extra={}){
 const timers=new Map();let serial=0;
 const cx=vm.createContext({console:{warn(){},error(){}},URL,URLSearchParams,AbortController,
  location:{origin:'https://example.test',search:''},
  setTimeout(fn){const id=++serial;timers.set(id,fn);return id},clearTimeout(id){timers.delete(id)},...extra});
 cx.window=cx;cx.timers=timers;return cx;
}
function cacheContext(dbAction){
 const nodes=new Map(),messages=[],$=id=>{
  if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,options:[],replaceChildren(...options){this.options=options}});
  return nodes.get(id);
 };
 const cx=context({$,dbAction,status:(...args)=>messages.push(args),Option:class{constructor(text,value){this.text=text;this.value=value}}});
 const script=read('assets/js/spine/catalog.js'),start=script.indexOf('// Listing saved packs'),end=script.indexOf('function stopWatchdog',start);
 vm.runInContext(script.slice(start,end),cx);
 return {cx,$,messages};
}
test('cache failure stays in the cache controls and cannot replace playback/desktop status',async()=>{
 const {cx,$,messages}=cacheContext(async()=>{throw Error('IndexedDB unavailable')});
 await cx.refreshSaved();
 assert.deepEqual(messages,[]);assert.equal($('savedPacks').disabled,true);assert.equal($('deleteSaved').disabled,true);
 assert.match($('savedPacks').title,/IndexedDB unavailable/);
});
test('an obsolete cache listing cannot overwrite a newer listing',async()=>{
 const first=deferred(),second=deferred();let call=0;
 const {cx,$}=cacheContext(()=>++call===1?first.promise:second.promise);
 const old=cx.refreshSaved(),current=cx.refreshSaved();second.resolve(['new-pack']);await current;
 first.resolve(['old-pack']);await old;
 assert.equal($('savedPacks').options[1].value,'new-pack');
});
test('voice UI failure cannot interrupt renderer disposal or keep the old Cubism iframe alive',()=>{
 let disposed=0,removed=0;
 const cx=context({player:{dispose(){disposed++}},azurlaneFrame:{remove(){removed++}},
  selectedVoiceChanged(){throw Error('voice UI failed')},pausedInBackground:{},rendererFrameStats:{},
  viewZoom:2,viewOffsetX:9,viewOffsetY:10,azurlaneReady:true,azurlanePending:{},azurlanePlayingId:'old',
  ArchiveTheaterUI:{setZoom(){}},setViewerToolsEnabled(){},$(){return {replaceChildren(){}}},
  document:{createElement:()=>({})}});
 vm.runInContext(read('assets/js/spine/spine-runtime.js'),cx);
 assert.doesNotThrow(()=>cx.clearPlayer());assert.equal(disposed,1);assert.equal(removed,1);assert.equal(cx.player,null);assert.equal(cx.azurlaneFrame,null);
});
test('an audio observer exception cannot abort playback or leak its setup timer',async()=>{
 const clips=[];let notices=0;
 class Audio{constructor(){clips.push(this)}play(){this.started=true;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}}
 const cx=context({Audio});vm.runInContext(read('assets/js/shared/voice-playback.js'),cx);
 const player=cx.ArchiveVoice.create(()=>{notices++;throw Error('observer failed')});
 assert.equal(await player.play(['https://example.test/voice.ogg']),true);
 assert.equal(clips[0].started,true);assert.equal(cx.timers.size,0);assert.equal(notices,2);
 player.stop();assert.equal(clips[0].paused,true);
 const asyncObserver=cx.ArchiveVoice.create(async()=>{throw Error('async observer failed')});
 assert.equal(await asyncObserver.play(['https://example.test/voice.ogg']),true);await flush();
 assert.equal(cx.timers.size,0);asyncObserver.stop();
});
function cubismContext(){
 const attempts=[],messages=[];
 const cx=context({desktopMode:false,targetFPS:60,currentGeneration:0,currentId:'',readyId:'',loadStartedAt:0,
  zoom:1,offsetX:0,offsetY:0,model:null,portraitLocalBounds:null,portraitGeometryBounds:null,performance:{now:()=>0},warn:{hidden:false},
  document:{hidden:false},message(){},fit(){},queueLive2DPortraitFit(){},validLive2DIdentity:()=>true,modelUrlFor:(_name,url)=>url,
  graphicsReport:()=>({}),notify:kind=>messages.push({kind,id:cx.currentId}),
  app:{screen:{width:800,height:600},stage:{addChild(){},removeChild(){}},ticker:{stop(){},start(){}}},
  ArchiveAssets:{variants:url=>[url]},ArchiveVoice:{create:()=>({stop(){},setVolume(){}}),volume:x=>x},
  ArchiveCubismMotions:{install:()=>({entries:[],initialKey:'',dispose(){}})},
  ArchivePortraitInteractions:{plan:()=>({mode:'none',sourceAreas:[],mappedAreas:[],description:'none'})},
  PIXI:{live2d:{MotionPriority:{},Live2DModel:{fromSync(url,options){
   const handlers=new Map(),candidate={x:0,y:0,once(){},on(name,fn){handlers.set(name,fn)},destroy(){this.destroyed=(this.destroyed||0)+1},internalModel:{motionManager:{}}};
   attempts.push({url,options,candidate,handlers});return candidate;
  }}}}
 });
 vm.runInContext(read('assets/js/live2d/model-loader.js'),cx);
 return {cx,attempts,messages};
}
test('replacing a stalled Cubism load settles and destroys the old candidate without waiting for timeout',async()=>{
 const {cx,attempts,messages}=cubismContext();let oldSettled=false;
 const old=cx.load('old','a-old','https://example.test/old').then(()=>oldSettled=true);await flush();
 const current=cx.load('new','b-new','https://example.test/new');await flush();
 assert.equal(oldSettled,true);assert.equal(attempts[0].candidate.destroyed,1);assert.equal(cx.timers.size,1);
 attempts[1].options.onLoad();await current;attempts[0].options.onLoad();await old;await flush();
 assert.equal(cx.model,attempts[1].candidate);assert.equal(cx.readyId,'b-new');assert.equal(cx.timers.size,0);
 assert.equal(messages.filter(x=>x.kind==='playing').length,1);
});
test('queued pointer events from a retired Cubism model cannot drag the next model',async()=>{
 const {cx,attempts}=cubismContext();
 const old=cx.load('old','a-old','https://example.test/old');attempts[0].options.onLoad();await old;
 const current=cx.load('new','b-new','https://example.test/new');attempts[1].options.onLoad();await current;
 attempts[0].handlers.get('pointerdown')({data:{global:{x:10,y:10}}});
 attempts[0].handlers.get('pointermove')({data:{global:{x:40,y:60}}});
 assert.equal(cx.model.dragging,undefined);assert.equal(cx.model.x,0);assert.equal(cx.offsetX,0);
});
test('desktop host transport failure cannot throw into the renderer',()=>{
 const cx=context({location:{origin:'https://example.test',search:'?desktop=1&transport=webview2&id=demo&game=test'},
  chosen:()=>({id:'demo',gameId:'test'}),viewZoom:1,viewOffsetX:0,viewOffsetY:0,innerWidth:800,innerHeight:600,
  document:{head:{append(){}},createElement:()=>({})},addEventListener(){},
  chrome:{webview:{postMessage(){throw Error('host disposed')},addEventListener(){}}}});
 cx.parent=cx;vm.runInContext(read('assets/js/spine/desktop-webview-bridge.js'),cx);
 assert.doesNotThrow(()=>cx.ArchiveDesktopBridge.loading());
 assert.doesNotThrow(()=>cx.ArchiveDesktopBridge.capabilities({interaction:'none'}));
});
