import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const manifest=JSON.parse(fs.readFileSync(new URL('../data/live2d-highquality.json',import.meta.url),'utf8'));
const data=manifest.characters;
const src=fs.readFileSync(new URL('../assets/js/live2d/state-and-viewport.js',import.meta.url),'utf8');
const start=src.indexOf('function modelUrlFor(');
const stop=src.indexOf('const TOUHOU_SOURCE=',start);
assert.ok(start>0&&stop>start);
const declarations=src.slice(0,start)+src.slice(start,stop)+src.slice(stop,src.indexOf('\n',stop));
const context=vm.createContext({});
vm.runInContext(declarations,context);
const modelURL=(c,url=c.modelUrl,name=c.skinCode)=>{
 context.c=c;context.url=url;context.name=name;
 return vm.runInContext('modelUrlFor(name,url,c.id)',context);
};
test('Only structurally complete, high-resolution Cubism models are indexed',()=>{
 assert.equal(data.length,196);
 assert.equal(data.filter(c=>c.gameId==='girldimension').length,102);
 assert.equal(data.filter(c=>c.gameId==='sinsevendeadlysins').length,94);
 assert.equal(new Set(data.map(c=>c.id)).size,data.length);
 assert.equal(new Set(data.map(c=>c.sourcePath)).size,data.length);
 for(const c of data){
  assert.ok(c.textureBytes>950000&&c.motionCount>0,c.id);
  if(c.gameId==='sinsevendeadlysins')assert.ok(c.textureBytes>=1800000,c.id);
  assert.ok(!c.preview||c.previewSource==='matching-live2d-animation-frame');
  assert.equal(c.sourceCommit,'7e446cbd95ec352cdb0f73c079e4d075d7d528ac');
 }
});
test('Reject aliases, mismatched costumes, unpinned commits and traversal',()=>{
 for(const c of data){
  assert.equal(modelURL(c),c.modelUrl,c.id);
  assert.equal(modelURL(c,c.modelUrl.replace('@'+c.sourceCommit+'/','@master/')),'',c.id);
  assert.equal(modelURL(c,c.modelUrl.replace('.model3.json','/../.model3.json')),'',c.id);
  assert.equal(modelURL(c,c.modelUrl,'different-skin'),'',c.id);
 }
});
