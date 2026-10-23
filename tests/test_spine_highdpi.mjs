// Regression: legacy Spine 3.8 used CSS-size canvas buffers on every frame.
// These tests use the same shared runtime patch that plays Arknights illust rigs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../assets/js/spine/spine-runtime.js',import.meta.url),'utf8');
function setup({dpr=2,maxSize=8192,width=600,height=400}={}){
 const calls={viewport:[],draws:0,updates:0,nativeZoom:0};
 const gl={
  MAX_RENDERBUFFER_SIZE:34024,
  getParameter(param){assert.equal(param,this.MAX_RENDERBUFFER_SIZE);return maxSize},
  viewport(...args){calls.viewport.push(args)}
 };
 function SceneRenderer(){}
 SceneRenderer.prototype.begin=function(){calls.draws++};
 SceneRenderer.prototype.resize=function(){throw Error('unpatched legacy resize used')};
 const canvas={clientWidth:width,clientHeight:height,width:300,height:150};
 const camera={
  zoom:1,viewportWidth:width,viewportHeight:height,
  setViewport(w,h){this.viewportWidth=w;this.viewportHeight=h},
  update(){calls.updates++}
 };
 const renderer=new SceneRenderer();
 Object.assign(renderer,{canvas,context:{gl},camera});
 const context=vm.createContext({
  window:{devicePixelRatio:dpr,spine:{webgl:{SceneRenderer,ResizeMode:{Stretch:0,Expand:1,Fit:2}}}},
  player:null,applySharpSpineCamera(){calls.nativeZoom++}
 });
 vm.runInContext(code,context);
 vm.runInContext('patchSpine38HighDPI()',context);
 return {context,renderer,canvas,camera,calls,gl};
}
test('Spine 3.8 backs a 600×400 stage with 1200×800 physical pixels at DPR 2',()=>{
 const {renderer,canvas,camera,calls}=setup();
 renderer.resize(1);
 assert.equal(canvas.width,1200);
 assert.equal(canvas.height,800);
 assert.equal(camera.viewportWidth,1200);
 assert.equal(camera.viewportHeight,800);
 assert.deepEqual(calls.viewport.at(-1),[0,0,1200,800]);
 assert.equal(calls.updates,1);
 renderer.resize(1);
 assert.equal(canvas.width,1200);
 assert.equal(canvas.height,800);
});
test('resize responds to display DPR changes without multiplying CSS layout',()=>{
 const {context,renderer,canvas,camera}=setup();
 renderer.resize(1);
 context.window.devicePixelRatio=1.25;
 renderer.resize(1);
 assert.equal(canvas.width,750);
 assert.equal(canvas.height,500);
 assert.equal(canvas.clientWidth,600);
 assert.equal(camera.viewportWidth,750);
});
test('legacy renderer caps GPU surface sizes and pixel count',()=>{
 const {renderer,canvas}=setup({dpr:3,maxSize:1024,width:1600,height:1000});
 renderer.resize(1);
 assert.ok(canvas.width<=1024);
 assert.ok(canvas.height<=1024);
 assert.ok(canvas.width*canvas.height<=12000000);
 const {renderer:large,canvas:largeCanvas}=setup({dpr:2,width:5000,height:3000});
 large.resize(1);
 assert.ok(largeCanvas.width*largeCanvas.height<=12000000+10000);
});
test('native camera is used for zoom and pan only on the active renderer',()=>{
 const {context,renderer,calls}=setup();
 renderer.begin();
 assert.equal(calls.nativeZoom,0);
 context.player={sceneRenderer:renderer,_archiveNativeView:true};
 renderer.begin();
 assert.equal(calls.nativeZoom,1);
 assert.equal(calls.draws,2);
 vm.runInContext('patchSpine38HighDPI()',context);
 renderer.begin();
 assert.equal(calls.nativeZoom,2);
 assert.equal(calls.draws,3);
 context.player={sceneRenderer:{},_archiveNativeView:true};
 renderer.begin();
 assert.equal(calls.nativeZoom,2);
});
