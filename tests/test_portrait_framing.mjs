import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const framing=require('../assets/js/shared/portrait-framing.js');
test('visible bounds ignore transparent export padding and isolated particles',()=>{
 const width=100,height=80,pixels=new Uint8ClampedArray(width*height*4);
 const fill=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)pixels.set([200,140,80,255],(j*width+i)*4)};
 fill(50,20,30,50);fill(44,35,4,8);fill(1,1,1,1);
 assert.deepEqual(framing.visibleBounds({pixels,width,height}),{x:44,y:20,width:36,height:50});
 assert.equal(framing.visibleBounds({pixels:new Uint8Array(8),width,height}),null);
});
test('opaque Spine backgrounds are excluded while foreground scene pixels remain',()=>{
 const pixels=new Uint8Array(40*40*4);
 for(let i=0;i<pixels.length;i+=4)pixels.set([20,34,56,255],i);
 assert.equal(framing.visibleBounds({pixels,width:40,height:40,background:[20,34,56]}),null);
 for(let y=10;y<30;y++)for(let x=5;x<20;x++)pixels.set([220,180,120,255],(y*40+x)*4);
 assert.deepEqual(framing.visibleBounds({pixels,width:40,height:40,background:[20,34,56]}),{x:5,y:10,width:15,height:20});
});
test('off-origin portraits fit and center at any canvas aspect and DPR',()=>{
 const bounds={x:3000,y:-9000,width:200,height:600};
 for(const [width,height] of [[800,900],[350,650],[1500,700]]){
  const frame=framing.cameraFrame({bounds,width,height});
  assert.equal(frame.x,3100);assert.equal(frame.y,-8700);
  assert.ok(bounds.width/frame.worldWidth<=.900001);
  assert.ok(bounds.height/frame.worldHeight<=.880001);
  const recovered=framing.pixelsToWorld({x:0,y:0,width,height},width,height,frame);
  assert.ok(Math.abs(recovered.x-(frame.x-frame.worldWidth/2))<1e-8);
  assert.ok(Math.abs(recovered.y-(frame.y-frame.worldHeight/2))<1e-8);
 }
 assert.equal(framing.cameraFrame({bounds:{x:0,y:0,width:Infinity,height:2},width:800,height:900}),null);
});
test('zoom halves the world extent and CSS-pixel pan has the correct orientation',()=>{
 const input={bounds:{x:20,y:50,width:200,height:400},width:800,height:900};
 const base=framing.cameraFrame(input),zoomed=framing.cameraFrame({...input,zoom:2,offsetX:80,offsetY:45});
 assert.equal(zoomed.worldWidth,base.worldWidth/2);
 assert.equal(zoomed.x,base.x-zoomed.worldWidth/10);
 assert.equal(zoomed.y,base.y+zoomed.worldHeight/20);
});
function controls(){
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{listeners:{},addEventListener(kind,fn){this.listeners[kind]=fn},textContent:''});return elements.get(id)};
 const cx=vm.createContext({$,document:{addEventListener(){}},URLSearchParams,location:{search:''},
  window:{},ArchivePortraitFraming:framing,player:null,azurlaneFrame:null,
  viewZoom:1,viewOffsetX:0,viewOffsetY:0,status(){},console});
 vm.runInContext(fs.readFileSync(new URL('../assets/js/spine/viewer-controls.js',import.meta.url),'utf8'),cx);
 return {cx,$};
}
test('changing animation preserves user zoom, pan, and session camera without rescanning 100 poses',()=>{
 const {cx,$}=controls();let scans=0;
 const camera={zoom:1,viewportWidth:1600,viewportHeight:1800,position:{x:0,y:0}};
 const p={_archiveNativeView:true,sceneRenderer:{camera},canvas:{clientWidth:800,clientHeight:900,width:1600},
  currentViewport:{x:300,y:500,width:200,height:600},
  calculateAnimationViewport(){scans++;return {x:-9999,y:0,width:50000,height:10000}},
  setAnimation(){this.currentViewport=this.calculateAnimationViewport()},play(){}};
 cx.player=p;cx.viewZoom=2;cx.viewOffsetX=40;cx.viewOffsetY=-30;
 cx.initializeSpinePortrait(p);cx.applySharpSpineCamera(p);
 const before={zoom:camera.zoom,x:camera.position.x,y:camera.position.y};
 $('animationPicker').listeners.change({target:{value:'attack'}});
 cx.applySharpSpineCamera(p);
 assert.equal(scans,0);
 assert.equal(cx.viewZoom,2);assert.equal(cx.viewOffsetX,40);assert.equal(cx.viewOffsetY,-30);
 assert.deepEqual({zoom:camera.zoom,x:camera.position.x,y:camera.position.y},before);
 cx.applySharpSpineCamera(p);
 assert.equal(camera.zoom,before.zoom,'repeated camera callbacks must not compound zoom');
});
