import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../assets/js/spine/theater-ui.js',import.meta.url),'utf8');
function setup(){
 const nodes=new Map(),listeners={};
 function get(id){
  if(!nodes.has(id)){
   const classes=new Set();
   nodes.set(id,{textContent:'',value:'',options:[],disabled:false,hidden:true,attrs:{},
    classList:{toggle(key,on){on?classes.add(key):classes.delete(key)},contains(key){return classes.has(key)}},
    replaceChildren(...children){this.options=children},
    addEventListener(key,fn,opts){listeners[id+':'+key]={fn,opts}},
    setAttribute(key,value){this.attrs[key]=value}});
  }
  return nodes.get(id);
 }
 const window={};
 const context=vm.createContext({window,document:{getElementById:get,
  body:get('body'),dispatchEvent(event){(listeners['events']||=[]).push(event)},
  addEventListener(type,fn){listeners['document:'+type]={fn}}},
  CustomEvent:class CustomEvent{constructor(type,options){this.type=type;this.detail=options.detail}},
  Option:class Option{constructor(text,value){this.text=text;this.value=value}}});
 vm.runInContext(source,context);
 return {ui:window.ArchiveTheaterUI,get,listeners,document:context.document};
}
test('theater toolbar owns view status, animation options and zoom labels',()=>{
 const {ui,get}=setup();
 ui.setHeading('Alice','Spine');
 assert.equal(get('title').textContent,'Alice');
 assert.equal(get('stageContext').textContent,'Spine');
 ui.setAnimations([{value:'idle',label:'待机'},{value:'tap',label:'点击'}],{selected:'tap'});
 assert.equal(get('animationPicker').disabled,false);
 assert.equal(get('animationPicker').options[1].text,'点击');
 assert.equal(get('animationPicker').value,'tap');
 ui.setToolsEnabled(false);
 assert.equal(get('zoomIn').disabled,true);
 assert.equal(get('animationPicker').disabled,true);
 ui.setStatus('正在加载资源');
 assert.equal(get('loadNotice').hidden,false);
 ui.setStatus('正在播放：Alice');
 assert.equal(get('loadNotice').hidden,true);
 ui.setStatus('加载失败',true);
 assert.equal(get('status').classList.contains('error'),true);
 ui.setZoom(1.25);
 assert.equal(get('zoomValue').textContent,'125%');
});

test('fullscreen includes catalog and settings in the same fullscreen root',async()=>{
 const {ui,get,listeners,document}=setup(),shell=get('shell');
 get('stage').closest=()=>shell;
 shell.requestFullscreen=async()=>{document.fullscreenElement=shell;listeners['document:fullscreenchange'].fn()};
 ui.bind({});await listeners['fullscreenStage:click'].fn();
 assert.equal(document.fullscreenElement,shell);
 assert.equal(get('stageQuickFullscreen').attrs['aria-pressed'],'true');
 assert.equal(listeners.events.at(-1).detail.active,true);
});

test('fullscreen denial falls back to page immersion and Escape restores normal view',async()=>{
 const {ui,get,listeners}=setup(),shell=get('shell');let reported=false;
 get('stage').closest=()=>shell;
 shell.requestFullscreen=async()=>{throw Error('Permissions policy denied fullscreen')};
 ui.bind({fullscreenError(){reported=true}});await listeners['fullscreenStage:click'].fn();
 assert.equal(get('body').classList.contains('theater-immersive'),true);
 assert.equal(get('stageQuickFullscreen').attrs['aria-pressed'],'true');
 assert.equal(reported,false,'Fullscreen permission must not mark animation playback failed');
 listeners['document:keydown'].fn({key:'Escape'});
 assert.equal(get('body').classList.contains('theater-immersive'),false);
 assert.equal(listeners.events.at(-1).detail.active,false);
});
test('UI binds toolbar commands but not character pointer interactions',()=>{
 const {ui,get,listeners}=setup(),called=[];
 ui.bind({
  wheel:()=>called.push('wheel'),zoomIn:()=>called.push('in'),
  zoomOut:()=>called.push('out'),reset:()=>called.push('reset'),
  animation:name=>called.push(name),retry:()=>called.push('retry'),
  fullscreenError:error=>called.push(error.message)
 });
 listeners['player:wheel'].fn({});
 listeners['zoomIn:click'].fn({});
 listeners['animationPicker:change'].fn({target:{value:'touch'}});
 listeners['retryCharacter:click'].fn({});
 assert.equal(listeners['player:wheel'].opts.passive,false);
 assert.equal(listeners['player:wheel'].opts.capture,true);
 assert.equal(listeners['player:pointerdown'],undefined);
 assert.deepEqual(called,['wheel','in','touch','retry']);
 listeners['document:fullscreenchange'].fn();
 assert.equal(get('fullscreenStage').attrs['aria-label'],'全屏观看');
});
