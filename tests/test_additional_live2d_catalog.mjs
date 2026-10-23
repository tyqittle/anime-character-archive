import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const data=JSON.parse(fs.readFileSync(new URL('../data/live2d-moregames.json',import.meta.url),'utf8')).characters;
const js=fs.readFileSync(new URL('../assets/js/live2d/state-and-viewport.js',import.meta.url),'utf8');
const start=js.indexOf('function modelUrlFor(');
const stop=js.indexOf('const TOUHOU_SOURCE=',start);
const line=js.slice(stop,js.indexOf('\n',stop));
assert.ok(start>0&&stop>start);
const ctx=vm.createContext({});
vm.runInContext(js.slice(0,start)+line+'\n'+js.slice(start,stop),ctx);
const get=(c,name=c.skinCode,url=c.modelUrl)=>{
 ctx.c=c;ctx.n=name;ctx.u=url;
 return vm.runInContext('modelUrlFor(n,u,c.id)',ctx);
};
test('complete Girl Cafe Gun source imports preserve every original model identity',()=>{
 const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/pre-encyclopedia-models.json',import.meta.url))).moregames;
 for(const id of baseline)assert.ok(data.some(c=>c.id===id),id);
 const inventory=JSON.parse(fs.readFileSync(new URL('../data/girlscafegun-full-inventory.json',import.meta.url))).scopes[0];
 assert.equal(inventory.scopeComplete,true);
 assert.equal(data.filter(c=>c.gameId==='touhoucannonball').length,84);
 assert.equal(data.filter(c=>c.gameId==='girlscafegun').length,inventory.sourceModelSettings);
 assert.equal(new Set(data.map(c=>c.id)).size,data.length);
 assert.equal(new Set(data.map(c=>c.gameId+'|'+c.sourcePath)).size,data.length);
});
test('pinned source, model identity, and skin basename enforced for every record',()=>{
 for(const c of data){
  assert.equal(get(c),c.modelUrl,c.id);
  assert.equal(get(c,c.skinCode,c.modelUrl.replace('@'+c.sourceCommit+'/','@main/')),'',c.id);
  assert.equal(get(c,'not-the-model'),'',c.id);
  assert.equal(get(c,c.skinCode,c.modelUrl.replace('.model3.json','/../model3.json')),'',c.id);
 }
});
