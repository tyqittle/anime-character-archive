import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../assets/js/spine/illustration-quality.js',import.meta.url),'utf8');
const fragment=`precision mediump float;
 varying vec2 v_texCoords;
 uniform sampler2D u_texture;
 void main () {
   vec4 texColor = texture2D(u_texture, v_texCoords);
   gl_FragColor = texColor;
 }`;
function setup(){
 const seen={flushes:0,uniforms:[],disposed:0};
 class Shader{
  constructor(_context,vertex,fragmentText){
   this.vertex=vertex;
   this.fragmentText=fragmentText;
  }
  getVertexShaderSource(){return this.vertex}
  getFragmentSource(){return this.fragmentText}
  setUniform2f(name,x,y){seen.uniforms.push({name,x,y})}
  dispose(){seen.disposed++}
 }
 const original=new Shader({},'void main(){}',fragment);
 const batcher={verticesLength:10,lastTexture:{getImage:()=>({width:2452,height:2452})},
  flush(){seen.flushes++}};
 const renderer={batcherShader:original,batcher,context:{}};
 const player={sceneRenderer:renderer};
 const context=vm.createContext({window:{spine:{webgl:{Shader}}},console});
 vm.runInContext(code,context,{filename:'illustration-quality.js'});
 return {seen,player,renderer,batcher,context,original};
}
test('real illustration category receives original-atlas high-quality sampling',()=>{
 const x=setup();
 const entry={gameId:'arknights',assetType:'dynamic-illustration-spine'};
 x.context.entry=entry;x.context.active=x.player;
 assert.equal(vm.runInContext('installSpineIllustrationQuality(active,entry)',x.context),true);
 assert.equal(x.renderer._archiveRenderMinRatio,undefined);
 const shader=x.renderer.batcherShader;
 assert.notEqual(shader,x.original);
 assert.ok(shader.fragmentText.includes('uniform vec2 u_archiveTexel;'));
 assert.ok(shader.fragmentText.includes('texColor.rgb = clamp('));
 assert.ok(!shader.fragmentText.includes('\\n'));
 x.batcher.shader=shader;
 x.batcher.flush();
 assert.equal(x.seen.flushes,1);
 assert.equal(x.seen.uniforms.length,1);
 assert.equal(x.seen.uniforms[0].name,'u_archiveTexel');
 assert.ok(Math.abs(x.seen.uniforms[0].x-1/2452)<1e-10);
 assert.equal(vm.runInContext('installSpineIllustrationQuality(active,entry)',x.context),true);
 x.batcher.flush();
 assert.equal(x.seen.uniforms.length,2,'idempotent installation must not double wrap batcher');
});
test('normal and battle chibi models do not receive illustration enhancement',()=>{
 for(const entry of [
  {gameId:'arknights',assetType:'battle-spine'},
  {gameId:'bluearchive',assetType:'dynamic-illustration-spine'},
  {gameId:'nikke',assetType:'spine'}]){
  const x=setup();x.context.entry=entry;x.context.active=x.player;
  assert.equal(vm.runInContext('installSpineIllustrationQuality(active,entry)',x.context),false);
  assert.equal(x.renderer.batcherShader,x.original);
 }
});
