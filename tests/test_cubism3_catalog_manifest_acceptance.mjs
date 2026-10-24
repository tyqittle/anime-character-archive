import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../assets/js/spine/bootstrap.js',import.meta.url),'utf8');
const beginning=source.slice(0,source.indexOf('// Catalogs can change'));
const context=vm.createContext({});
vm.runInContext(beginning,context);
const validate=context.isPlayableAnimationEntry;
const hash='a'.repeat(64);
function record(id,format='model3',modifiers={}){
 return {id,gameId:'unknownbride',name:id,engine:'cubism',
  modelUrl:'./assets/model-settings/newgames/'+id+'.'+format+'.json?v='+hash,
  normalizedSettingsSha256:hash,sourceCommit:'7e446cbd95ec352cdb0f73c079e4d075d7d528ac',
  ...modifiers
 };
}
test('registry accepts correctly pinned Cubism3 AND previous Cubism2 character files',()=>{
 assert.equal(validate(record('ub-c_3012')),true);
 assert.equal(validate(record('rs-player','model')),true);
});
test('registry rejects bad hashes, character swaps, unpinned sources and arbitrary settings extensions',()=>{
 assert.equal(validate(record('ub-c_3012','model3',{normalizedSettingsSha256:'b'.repeat(64)})),false);
 assert.equal(validate(record('ub-c_3012','model3',{modelUrl:'./assets/model-settings/newgames/ub-c_3023.model3.json?v='+hash})),false);
 assert.equal(validate(record('ub-c_3012','model3',{sourceCommit:'main'})),false);
 assert.equal(validate(record('ub-c_3012','png')),false);
});
