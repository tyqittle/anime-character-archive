import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const chars=JSON.parse(read('data/live2d-mature.json')).characters.filter(c=>['lovecube','foxhimezero'].includes(c.gameId));
const src=read('assets/js/live2d/state-and-viewport.js');const ctx=vm.createContext({});
vm.runInContext(src.slice(0,src.indexOf('const SAME_ORIGIN=')),ctx);
const valid=(c,url=c.modelUrl,name=c.skinCode)=>{ctx.c=c;ctx.url=url;ctx.n=name;return vm.runInContext('modelUrlFor(n,url,c.id)',ctx)};
test('7 mature Cubism models have unique identities and no fake previews',()=>{
 assert.equal(chars.length,7);assert.equal(new Set(chars.map(x=>x.id)).size,7);assert.equal(chars.filter(x=>x.gameId==='lovecube').length,6);
 for(const c of chars){
  assert.equal(c.engine,'cubism');assert.ok(c.textureBytes>700000);
  if(c.preview){
   assert.equal(c.previewSource,'matching-live2d-animation-frame');
   assert.match(c.previewSha256,/^[a-f0-9]{64}$/);
   assert.deepEqual(Array.from(c.previewSourceIdentity||[]),['cubism','','','',c.modelUrl,'','']);
   assert.ok(fs.existsSync(new URL('../'+c.preview.replace(/^\.\//,''),import.meta.url)),'Missing real model preview: '+c.id);
  }else{
   assert.equal(c.playbackStatus,'not-verified');assert.equal(c.status,'indexed-unverified');
   assert.ok(!c.previewSha256);
  }
 }
 assert.ok(chars.find(x=>x.gameId==='foxhimezero').motionCount>0);assert.ok(chars.filter(x=>x.gameId==='lovecube').every(x=>x.motionCount===0));
});
test('exact source whitelist rejects floating refs and wrong scene/skin',()=>{
 for(const c of chars){assert.equal(valid(c),c.modelUrl);assert.equal(valid(c,c.modelUrl.replace(c.sourceCommit,'main')),'');assert.equal(valid(c,c.modelUrl.replace('galgame%20live2d/','galgame%20live2d/adult/')),'');assert.equal(valid(c,c.modelUrl,c.skinCode+'_other'),'')}
 assert.equal(valid(chars[0],chars[1].modelUrl),'');
});
