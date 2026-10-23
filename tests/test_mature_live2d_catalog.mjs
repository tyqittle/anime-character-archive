import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const records=JSON.parse(fs.readFileSync(new URL('../data/live2d-mature.json',import.meta.url),'utf8')).characters;
const js=fs.readFileSync(new URL('../assets/js/live2d/state-and-viewport.js',import.meta.url),'utf8');
const a=js.indexOf('function modelUrlFor('),b=js.indexOf('const TOUHOU_SOURCE=',a);
assert.ok(a>0&&b>a);
const cx=vm.createContext({});
vm.runInContext(js.slice(0,a)+js.slice(a,b),cx);
const modelUrl=(c,url=c.modelUrl,name=c.skinCode)=>{
 cx.c=c;cx.url=url;cx.name=name;
 return vm.runInContext('modelUrlFor(name,url,c.id)',cx);
};
test('Every catalog entry has a proper original character model, not an explicit CG scene',()=>{
 assert.equal(records.length,72);
 assert.equal(records.filter(x=>x.gameId==='tokyonecro').length,62);
 assert.equal(records.filter(x=>x.gameId==='maidslife').length,10);
 assert.equal(new Set(records.map(x=>x.id)).size,72);
 for(const c of records){
  assert.ok(c.textureBytes>650000&&c.motionCount>0,c.id);
  assert.ok(!c.sourcePath.includes('/adult/'),c.id);
  assert.equal(c.sourceCommit,'7e446cbd95ec352cdb0f73c079e4d075d7d528ac');
  assert.ok(!c.preview||c.previewSource==='matching-live2d-animation-frame',c.id);
 }
});
test('Pinned URL allowlist correctly binds each new character and refuses model switching',()=>{
 for(const c of records){
  assert.equal(modelUrl(c),c.modelUrl,c.id);
  assert.equal(modelUrl(c,c.modelUrl.replace('@'+c.sourceCommit+'/','@main/')),'',c.id);
  assert.equal(modelUrl(c,c.modelUrl.replace('.model3.json','/../model3.json')),'',c.id);
  assert.equal(modelUrl(c,c.modelUrl,'incorrect-model'),'',c.id);
 }
});
