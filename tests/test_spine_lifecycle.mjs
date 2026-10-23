import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../assets/js/spine/spine-runtime.js',import.meta.url),'utf8');
function setup(){
 const calls={draws:0,freed:0,lost:0,removed:0,frames:0,time:0},pending=[];
 function SpinePlayer(){}
 SpinePlayer.prototype.drawFrame=function(next=true){calls.draws++;if(next&&!this.stopRequestAnimationFrame)pending.push(()=>this.drawFrame())};
 SpinePlayer.prototype.stopRendering=function(){this.stopRequestAnimationFrame=true};
 const document={hidden:false};
 const cx=vm.createContext({window:{spine:{SpinePlayer}},document,console,clearTimeout,
  requestAnimationFrame:cb=>pending.push(cb),recordSpineFrame(){calls.frames++}});
 vm.runInContext(code,cx);cx.patchSpine38Lifecycle();cx.patchSpine38Lifecycle();
 const p=new SpinePlayer();Object.assign(p,{
  config:{success(){throw Error('stale callback')},error(){throw Error('stale error')}},
  time:{update(){calls.time++}},
  assetManager:{dispose(){calls.freed++}},sceneRenderer:{dispose(){calls.freed++}},
  context:{gl:{getExtension(){return {loseContext(){calls.lost++}}}}},
  dom:{remove(){calls.removed++}}
 });
 return {p,calls,pending,document};
}
test('retiring legacy sessions stops already queued draws and releases GPU assets exactly once',()=>{
 const x=setup();x.p.drawFrame();assert.equal(x.calls.draws,1);
 x.p.dispose();x.p.dispose();x.pending.shift()();
 assert.equal(x.calls.draws,1);assert.equal(x.pending.length,0);
 assert.equal(x.calls.freed,2);assert.equal(x.calls.lost,1);assert.equal(x.calls.removed,1);
 x.p.config.success();x.p.config.error();
});
test('hidden legacy sessions suspend rendering and resume without elapsed-time jumps',()=>{
 const x=setup();x.document.hidden=true;x.p.drawFrame();
 assert.equal(x.calls.draws,0);assert.equal(x.calls.time,1);assert.equal(x.pending.length,1);
 x.document.hidden=false;x.pending.shift()();
 assert.equal(x.calls.draws,1);assert.equal(x.calls.frames,1);
 x.p.dispose();x.pending.shift()();assert.equal(x.pending.length,0);
});
