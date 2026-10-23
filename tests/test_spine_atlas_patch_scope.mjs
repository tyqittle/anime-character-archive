// Regression: Spine 3.8 atlas rotation depends on individual region, not game.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../assets/js/spine/spine-runtime.js',import.meta.url),'utf8');
const start=source.indexOf('function patchSpine38AtlasRotations(){');
const end=source.indexOf('// Spine 3.8\'s bundled',start);
assert(start>=0&&end>start);
class TextureAtlas {
 load(){this.regions=[0,90,180,270].map(degrees=>({degrees,rotate:degrees===90,x:10,y:20,width:30,height:50,page:{width:200,height:300},name:String(degrees)}))}
}
class RegionAttachment {
 constructor(){this.uvs=[]}
 setRegion(region){this.region=region;this.uvs=['native']}
}
const sandbox={window:{spine:{TextureAtlas,RegionAttachment}},Error};
vm.runInNewContext(source.slice(start,end)+'\npatchSpine38AtlasRotations();',sandbox);
const atlas=new TextureAtlas();atlas.load();
const regions=atlas.regions;
assert.equal(regions[0].rotate,false);
assert.equal(regions[1].rotate,true);
assert.equal(regions[2].rotate,false);
assert.equal(regions[3].rotate,true);
assert.equal(regions[3].u2,(10+50)/200);
assert.equal(regions[3].v2,(20+30)/300);
for(const deg of [0,90]){
 const r=new RegionAttachment();r.setRegion(regions[deg/90]);assert.deepEqual(r.uvs,['native']);
}
for(const [index,expected] of [[2,[.2,20/300,.2,70/300,.05,70/300,.05,20/300]],[3,[.05,20/300,.3,20/300,.3,50/300,.05,50/300]]]){
 const r=new RegionAttachment();r.setRegion(regions[index]);
 assert.equal(r.uvs.length,8);
 r.uvs.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-6,index+': '+i+' '+v));
}
console.log('PASS: all region rotations use consistent atlas UVs');
