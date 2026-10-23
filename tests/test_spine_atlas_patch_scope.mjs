// Regression: Spine 3.8 atlas rotation depends on individual region, not game.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../assets/js/spine/spine-runtime.js',import.meta.url),'utf8');
const start=source.indexOf('function patchSpine38AtlasRotations(){');
const end=source.indexOf('// Spine 3.8\'s bundled',start);
assert(start>=0&&end>start);
const sandbox={console,Float32Array,Uint16Array,Uint32Array,Array,Math};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL('../vendor/spine38/spine-player.js',import.meta.url),'utf8'),sandbox);
sandbox.window=sandbox;
vm.runInContext(source.slice(start,end)+'\npatchSpine38AtlasRotations();',sandbox);
const {TextureAtlas,RegionAttachment}=sandbox.spine;
const raw=['page.png','size: 200,300','format: RGBA8888','filter: Linear,Linear','repeat: none',
 ...[0,90,180,270].flatMap(deg=>[String(deg),'  rotate: '+deg,'  xy: 10,20','  size: 30,50','  orig: 30,50','  offset: 0,0','  index: -1'])].join('\n');
const texture={getImage:()=>({width:200,height:300}),setFilters(){},setWraps(){}};
const atlas=new TextureAtlas(raw,()=>texture);
const regions=atlas.regions;
assert.equal(regions[0].rotate,false);
assert.equal(regions[1].rotate,true);
assert.equal(regions[2].rotate,false);
assert.equal(regions[3].rotate,true);
assert.equal(regions[3].u2,(10+50)/200);
assert.equal(regions[3].v2,(20+30)/300);
for(const deg of [0,90]){
 const r=new RegionAttachment('rotation-test');r.setRegion(regions[deg/90]);const expected=deg===0?[.05,70/300,.05,20/300,.2,20/300,.2,70/300]:[.3,.166666667,.05,.166666667,.05,20/300,.3,20/300];
 r.uvs.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-6));
}
for(const [index,expected] of [[2,[.2,20/300,.2,70/300,.05,70/300,.05,20/300]],[3,[.05,20/300,.3,20/300,.3,50/300,.05,50/300]]]){
 const r=new RegionAttachment('rotation-test');r.setRegion(regions[index]);
 assert.equal(r.uvs.length,8);
 r.uvs.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-6,index+': '+i+' '+v));
}
console.log('PASS: all region rotations use consistent atlas UVs');
