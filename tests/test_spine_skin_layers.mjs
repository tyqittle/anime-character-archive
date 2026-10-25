import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const code=fs.readFileSync(new URL('../assets/js/spine/spine-runtime.js',import.meta.url),'utf8');
test('declared source layers compose in order and validate completely before mutating the skeleton',()=>{
 const calls=[],available={default:{name:'body'},normal:{name:'face'}};
 class Skin{constructor(name){this.name=name;this.layers=[]}addSkin(skin){this.layers.push(skin)}}
 const p={skeleton:{data:{findSkin:name=>available[name]},setSkin:s=>calls.push(s.layers.map(x=>x.name)),setSlotsToSetupPose:()=>calls.push('setup'),updateWorldTransform:()=>calls.push('update')}};
 const context=vm.createContext({spine:{Skin},p});vm.runInContext(code,context);
 assert.equal(vm.runInContext('applyDeclaredSpineSkinLayers(p,{})',context),false);assert.deepEqual(calls,[]);
 assert.equal(vm.runInContext('applyDeclaredSpineSkinLayers(p,{spineSkinLayers:["default","normal"]})',context),true);
 assert.deepEqual(calls,[['body','face'],'setup','update']);calls.length=0;
 assert.throws(()=>vm.runInContext('applyDeclaredSpineSkinLayers(p,{spineSkinLayers:["default","missing"]})',context),/缺少皮肤层/);assert.deepEqual(calls,[]);
});
