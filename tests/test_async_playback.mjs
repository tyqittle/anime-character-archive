// Deterministic regressions for async playback; no external CDN/network required.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
function context(extra={}){
 let serial=0;const timers=new Map();
 const ctx=vm.createContext({console,AbortController,URL,URLSearchParams,TextDecoder,Uint8Array,
  location:{origin:'https://archive.example',search:''},
  setTimeout(fn){const id=++serial;timers.set(id,fn);return id},
  clearTimeout(id){timers.delete(id)},...extra});
 ctx.window=ctx;ctx.timers=timers;return ctx;
}
const run=(ctx,p)=>{if(p==='assets/js/spine/spine-assets.js')vm.runInContext(source('assets/js/shared/asset-sources.js'),ctx);return vm.runInContext(source(p),ctx,{filename:p})};
test('download timeout remains active throughout response body and external abort',async()=>{
 const ctx=context();
 ctx.fetch=async(_url,{signal})=>({ok:true,blob:()=>new Promise((_resolve,reject)=>{
  signal.addEventListener('abort',()=>reject(Error('body aborted')),{once:true});
 })});
 run(ctx,'assets/js/spine/spine-assets.js');
 const request=ctx.downloadBlob('https://example.test/model');
 await flush();
 assert.equal(ctx.timers.size,1);
 [...ctx.timers.values()][0]();
 await assert.rejects(request,/body aborted/);
 assert.equal(ctx.timers.size,0);
 const controller=new AbortController();
 const external=ctx.downloadBlob('https://example.test/model',24000,controller.signal);
 await flush();controller.abort();
 await assert.rejects(external,{name:'AbortError'});
 assert.equal(ctx.timers.size,0);
});
test('IndexedDB writes resolve only after commit and reject late transaction aborts',async()=>{
 const ctx=context();let request,transaction,closed=0;
 const db={close(){closed++},transaction(){return transaction={objectStore:()=>({put:()=>request={}})}}};
 ctx.indexedDB={open(){const open={result:db};queueMicrotask(()=>open.onsuccess());return open}};
 vm.runInContext("const cacheDB='regression';"+source('assets/js/spine/catalog.js').split('function openDB()')[1].split('// Listing saved packs')[0].replace(/^/,'function openDB()'),ctx);
 let settled=false;
 const write=ctx.dbAction('readwrite',s=>s.put({id:'demo'})).then(()=>settled=true);
 await flush();request.result='demo';request.onsuccess();await flush();
 assert.equal(settled,false);transaction.oncomplete();await write;
 assert.equal(closed,1);
 const failed=ctx.dbAction('readwrite',s=>s.put({id:'demo'}));
 await flush();request.onsuccess();transaction.error=Error('quota exceeded');transaction.onabort();
 await assert.rejects(failed,/quota exceeded/);assert.equal(closed,2);
});
test('blocked IndexedDB opening fails promptly and closes a late connection',async()=>{
 const ctx=context();let open,closed=0;
 ctx.indexedDB={open(){return open={result:{close(){closed++}}}}};
 vm.runInContext("const cacheDB='test';function openDB()"+source('assets/js/spine/catalog.js').split('function openDB()')[1].split('async function dbAction')[0],ctx);
 const p=ctx.openDB();open.onblocked();await assert.rejects(p,/./);
 open.onsuccess();assert.equal(closed,1);assert.equal(ctx.timers.size,0);
});
test('Live2D fit uses logical screen size at DPR 2',()=>{
 const ctx=context({location:{origin:'https://example.test'},document:{getElementById:()=>({})},navigator:{}});
 run(ctx,'assets/js/live2d/state-and-viewport.js');
 vm.runInContext("app={screen:{width:800,height:600},renderer:{width:1600,height:1200}};model={scale:{set(v){this.value=v}},position:{set(x,y){this.x=x;this.y=y}},getLocalBounds:()=>({x:0,y:0,width:400,height:600})};fit();",ctx);
 assert.equal(vm.runInContext('model.scale.value',ctx),.88);
 assert.equal(vm.runInContext('model.position.x',ctx),224);
 assert.equal(vm.runInContext('model.position.y',ctx),36);
});
test('shared audio starts synchronously in the click and cancellation settles pending play',async()=>{
 const waiting=deferred(),instances=[];
 class Audio {constructor(){instances.push(this)}play(){this.called=true;return waiting.promise}pause(){this.paused=true}load(){}removeAttribute(){this.src=''}}
 const ctx=context({Audio});run(ctx,'assets/js/shared/voice-playback.js');
 const player=ctx.ArchiveVoice.create();
 const result=player.play(['https://example.test/a.ogg']);
 assert.equal(instances[0].called,true);assert.equal(ctx.timers.size,1);
 player.stop();assert.equal(await result,false);assert.equal(instances[0].paused,true);
 assert.equal(ctx.timers.size,0);
 waiting.resolve();await flush();
});
test('shared audio retries unavailable exact-skin clips and ignores stale callbacks',async()=>{
 const instances=[],states=[];
 class Audio {constructor(){instances.push(this)}play(){return instances.length===1?Promise.reject(Error('404')):Promise.resolve()}pause(){}load(){}removeAttribute(){this.src=''}}
 const ctx=context({Audio});run(ctx,'assets/js/shared/voice-playback.js');
 const player=ctx.ArchiveVoice.create(s=>states.push(s));
 const urls=ctx.ArchiveVoice.skinURLs('123456');
 assert.ok(urls.every(x=>x.includes('/123456/')));
 assert.equal(await player.play(urls),true);assert.equal(instances.length,2);
 assert.equal(states.at(-1),'playing');assert.equal(ctx.timers.size,0);
 player.setVolume(NaN);assert.equal(instances[1].volume,.8);
 const ended=instances[1].onended;player.stop();ended();
 assert.equal(states.at(-1),'playing');
});
test('browser autoplay rejection is reported without retrying every file',async()=>{
 let calls=0;const states=[];
 class Audio {play(){calls++;return Promise.reject(Object.assign(Error('gesture'),{name:'NotAllowedError'}))}pause(){}load(){}removeAttribute(){}}
 const ctx=context({Audio});run(ctx,'assets/js/shared/voice-playback.js');
 const p=ctx.ArchiveVoice.create(s=>states.push(s));
 assert.equal(await p.play(['a','b']),false);assert.equal(calls,1);
 assert.equal(states.at(-1),'blocked');assert.equal(ctx.timers.size,0);
});
function rendererContext(){
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{value:id==='version'?'4.1':'',textContent:'',replaceChildren(){},style:{},classList:{add(){}},addEventListener(){}});return elements.get(id)};
 const ctx=context({$,loadedVersion:'4.1',runtimeQueue:Promise.resolve(),runtimeCache:new Map(),
  runtimeCss:null,player:null,currentAttempt:0,pendingRenderCancel:null,watchdog:null,
  pausedInBackground:null,rendererFrameStats:{},azurlaneFrame:null,
  setViewerToolsEnabled(){},selectedVoiceChanged(){},recordSpineFrame(){},applySharpSpineCamera(){},
  status(){},updateGPUStatus(){},spineGraphicsStatus(){},resetViewerTransform(){},connectCanvasGestures(){},
  viewZoom:1,viewOffsetX:0,viewOffsetY:0,document:{hidden:false,createElement:()=>({})},
  Option:class {constructor(text,value){this.text=text;this.value=value}}});
 ctx.stopWatchdog=()=>{ctx.clearTimeout(ctx.watchdog);ctx.watchdog=null};
 ctx.spine={SpinePlayer:class {constructor(_target,config){ctx.config=config;this.skeleton={data:{skins:[],animations:[]}};this.disposed=false}dispose(){this.disposed=true}}};
 run(ctx,'assets/js/spine/spine-runtime.js');return ctx;
}
test('Spine playback waits for renderer success and rejects render failures',async()=>{
 const ctx=rendererContext();let settled=false;
 const show=ctx.show({skeleton:'demo.skel',atlas:'demo.atlas'},'demo').then(v=>{settled=true;return v});
 await flush();assert.equal(settled,false);
 ctx.config.success(ctx.player);assert.equal(await show,true);assert.equal(ctx.timers.size,0);
 const failed=ctx.show({skeleton:'bad.skel'},'bad');await flush();
 const old=ctx.player;ctx.config.error(old,'invalid skeleton');
 await assert.rejects(failed,/invalid skeleton/);assert.equal(old.disposed,true);assert.equal(ctx.player,null);
 assert.equal(ctx.timers.size,0);
});
test('obsolete runtime registration cannot dispose the active player',async()=>{
 const ctx=rendererContext();const player={dispose(){throw Error('must not dispose')}};
 ctx.player=player;await ctx.ensureRuntime('3.8',()=>false);assert.equal(ctx.player,player);
});
test('cancelling a pending Spine renderer settles its load promise',async()=>{
 const ctx=rendererContext();run(ctx,'assets/js/spine/spine-assets.js');
 const p=ctx.show({skeleton:'demo.skel'},'demo');await flush();
 const stale=ctx.player;ctx.cancelCharacterDownload();
 assert.equal(await p,false);ctx.config.success(stale);assert.equal(stale.disposed,true);
 assert.equal(ctx.timers.size,0);
});
test('local cache selection ignores reads completed after another selection',async()=>{
 const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{value:'demo',addEventListener(){}});return elements.get(id)};
 const read=deferred();let played=0;
 const ctx=context({$,sequence:0,cancelCharacterDownload(){ctx.sequence++},dbAction:()=>read.promise,
  status(){},playPack(){played++}});
 run(ctx,'assets/js/spine/local-tools.js');
 ctx.playPack=()=>{played++};
 const p=$('savedPacks').onchange();ctx.sequence++;read.resolve({id:'demo'});
 await p;assert.equal(played,0);
});
test('all browser script groups parse together without duplicate global declarations',()=>{
 for(const html of ['characters.html','spine.html','azurlane-stage.html']){
  const scripts=[...source(html).matchAll(/<script defer src="\.\/([^"?]+)\?v=[^"]+"><\/script>/g)].map(x=>x[1]);
  assert.ok(scripts.length>0);new vm.Script(scripts.map(source).join('\n'),{filename:html});
 }
});

test('a failed atlas cancels the sibling skeleton transfer',async()=>{
 let aborted=false;
 const ctx=context({status(){}});
 ctx.fetch=async(url,{signal})=>{
  if(url.endsWith('.atlas'))return {ok:false,status:404};
  return {ok:true,blob:()=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('cancelled'))},{once:true}))};
 };
 run(ctx,'assets/js/spine/spine-assets.js');
 await assert.rejects(ctx.downloadPack({id:'demo',gameId:'nikke',base:'https://example.test/demo'},'github'),/404/);
 assert.equal(aborted,true);assert.equal(ctx.timers.size,0);
});
test('local JSON packs detect actual version and normalize base64 text for both runtimes',async()=>{
 const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,{value:'4.2',addEventListener(){}});return elements.get(id)};
 let shown;
 const ctx=context({$,allCharacters:[],atob,setVersion(){},show(options){shown=options}});
 run(ctx,'assets/js/spine/local-tools.js');
 ctx.toDataUri=async file=>'data:application/octet-stream;base64,'+Buffer.from(await file.text()).toString('base64');
 const skeleton={name:'demo.json',text:async()=>JSON.stringify({skeleton:{spine:'3.8.99'}})};
 const atlas={name:'demo.atlas.txt',text:async()=>'\uFEFFtexture.png\nsize: 10,10\n'};
 const texture={name:'texture.png',text:async()=>''};
 const pack=await ctx.preparePack([skeleton,atlas,texture]);
 assert.equal(pack.version,'3.8');assert.equal(pack.headerChecked,true);
 ctx.playPack(pack);assert.ok(shown.rawDataURIs['demo.json'].includes(';charset=utf-8,'));
 assert.equal(JSON.parse(decodeURIComponent(shown.rawDataURIs['demo.json'].split(',').slice(1).join(','))).skeleton.spine,'3.8.99');
 pack.version='4.1';ctx.playPack(pack);
 assert.equal(JSON.parse(shown.rawDataURIs['demo.json'].split(',').slice(1).join(',')).skeleton.spine,'3.8.99');
 assert.ok(shown.rawDataURIs['demo.atlas.txt'].endsWith('texture.png\nsize: 10,10\n'));
});

test('skin selection counts active bones instead of invisible common attachments',async()=>{
 const ctx=rendererContext(),p=ctx.show({skeleton:'forms.json'},'forms');await flush();
 const common={name:'default'},form={name:'form',bones:[{}]},instance=ctx.player;
 const sk={skin:common,data:{skins:[common,form],animations:[]},
  slots:Array.from({length:8},()=>({attachment:{},bone:{active:false}})),
  setSkin(skin){this.skin=skin;for(const slot of this.slots)slot.bone.active=skin===form},
  setSlotsToSetupPose(){},updateWorldTransform(){}};
 instance.skeleton=sk;instance.config={};ctx.config.success(instance);
 assert.equal(await p,true);assert.equal(sk.skin.name,'form');assert.equal(instance.config.skin,'form');
});


test('asset failover preserves exact repository revision and path',async()=>{
 const calls=[],ctx=context({fetch:async(url)=>{calls.push(url);return {ok:calls.length>1,status:503,blob:async()=>({verified:true})}}});
 run(ctx,'assets/js/shared/asset-sources.js');
 const value=await ctx.ArchiveAssets.blob('https://cdn.jsdelivr.net/gh/owner/repo@abc123/models/a.skel');
 assert.equal(value.verified,true);
 assert.deepEqual(calls,['https://raw.githubusercontent.com/owner/repo/abc123/models/a.skel','https://cdn.jsdelivr.net/gh/owner/repo@abc123/models/a.skel']);
 assert.equal(ctx.timers.size,0);
});

test('download cache is invalidated when the source revision changes',()=>{
 const ctx=context();run(ctx,'assets/js/spine/spine-assets.js');
 const character={base:'https://example.test/ref1/model',skeletonFormat:'skel'};
 const pack={headerChecked:true,sourceFingerprint:ctx.sourceFingerprint(character)};
 assert.equal(ctx.isCachedPackFor(character,pack),true);
 assert.equal(ctx.isCachedPackFor({...character,base:'https://example.test/ref2/model'},pack),false);
 assert.equal(ctx.isCachedPackFor(character,{headerChecked:true}),false);
});
test('model deadline clears a stalled stage and discards a late cache read',async()=>{
 const read=deferred(),messages=[],elements=new Map();let cleared=0,played=0;
 const ctx=context({pendingRenderCancel:null,currentAttempt:0,stopWatchdog(){},clearPlayer(){cleared++},
  $:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id)},
  status:(message)=>messages.push(message),recentSpinePack:()=>null,dbAction:()=>read.promise,
  playPack:()=>{played++}});
 run(ctx,'assets/js/spine/spine-assets.js');run(ctx,'assets/js/spine/playback.js');
 const request=ctx.playCharacter({id:'demo',name:'Demo',gameId:'nikke',base:'https://example.test/model'});
 assert.equal(ctx.timers.size,1);
 [...ctx.timers.values()][0]();
 assert.ok(messages.at(-1).includes('55'));
 read.resolve({headerChecked:true});await request;
 assert.equal(played,0);assert.equal(cleared,2);assert.equal(ctx.timers.size,0);
});

test('Cubism setup errors use onError and immediately retry the same model provider',async()=>{
 const calls=[],destroyed=[],events=[];
 const ctx=context({desktopMode:false,targetFPS:60,currentGeneration:0,currentId:'',readyId:'',loadStartedAt:0,
  zoom:1,offsetX:0,offsetY:0,model:null,portraitLocalBounds:null,performance:{now:()=>0},warn:{hidden:false},queueMicrotask,
  document:{hidden:false},message(){},fit(){},queueLive2DPortraitFit(){},verifyName:()=>true,modelUrlFor:()=> 'raw',
  graphicsReport:()=>({}),notify:(kind,data)=>events.push({kind,data}),
  app:{screen:{width:800,height:600},stage:{addChild(){}},ticker:{stop(){},start(){},addOnce(){}}},
  ArchiveAssets:{variants:()=>['https://raw.example/model','https://cdn.example/model']},
  ArchiveVoice:{create:()=>({stop(){},setVolume(){}})},
  PIXI:{live2d:{MotionPriority:{},Live2DModel:{fromSync(url,options){
   calls.push(url);
   const result={once(){},on(){},destroy(){destroyed.push(url)},internalModel:{motionManager:{definitions:{}}}};
   queueMicrotask(()=>calls.length===1?options.onError(Error('unsupported MOC version')):options.onLoad());
   return result;
  }}}}
 });
 // The loader relies on the shared source/identity service. Exercise the
 // real validator without bootstrapping the whole iframe in this isolated test.
 const viewportSource=source('assets/js/live2d/state-and-viewport.js');
 const validatorStart=viewportSource.indexOf('function verifyName(');
 const validatorEnd=viewportSource.indexOf('function fit(',validatorStart);
 assert.ok(validatorStart>=0&&validatorEnd>validatorStart);
 vm.runInContext(viewportSource.slice(validatorStart,validatorEnd),ctx);
 run(ctx,'assets/js/live2d/model-loader.js');
 await ctx.load('demo','al-demo','raw');
 assert.equal(calls.length,2);
 assert.deepEqual(destroyed,['https://raw.example/model']);
 assert.ok(events.some(e=>e.kind==='playing'));
 assert.equal(ctx.timers.size,0);
});

test('Cubism accepts single-character source basenames without weakening source validation',()=>{
 const ctx=context({document:{getElementById:()=>({})},navigator:{}});
 run(ctx,'assets/js/live2d/state-and-viewport.js');
 assert.equal(ctx.verifyName('1'),true);
 assert.equal(ctx.verifyName(''),false);
 assert.equal(ctx.verifyName('..'),false);
 assert.equal(ctx.verifyName('../1'),false);
 assert.equal(ctx.verifyName('1/other'),false);
 const url='https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model@7e446cbd95ec352cdb0f73c079e4d075d7d528ac/%E5%B0%91%E5%A5%B3%E5%89%8D%E7%BA%BF%20girls%20Frontline/live2dnew/air_attack/1/1.model3.json';
 assert.equal(ctx.modelUrlFor('1',url,'gf-demo'),url);
 assert.equal(ctx.modelUrlFor('1',url.replace('Eikanya/Live2d-model','other/repository'),'gf-demo'),'');
});
