// Regression: atlas rotation overrides must not leak across games.
// Run: node tests/test_spine_atlas_patch_scope.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../assets/js/spine/spine-runtime.js',import.meta.url),'utf8');
const start=source.indexOf('function patchSpine38AtlasRotations(){');
const end=source.indexOf('// Spine 3.8\'s bundled',start);
assert(start>=0&&end>start,'atlas patch function missing');
class TextureAtlas {
 load(){this.regions=[{degrees:270,rotate:false,x:1,y:2,width:4,height:8,page:{width:100,height:100}}]}
}
class RegionAttachment {
 setRegion(region){this.region=region;this.uvs=['native']}
 constructor(){this.uvs=[]}
}
const sandbox={window:{spine:{TextureAtlas,RegionAttachment}},Error};
vm.runInNewContext(source.slice(start,end)+'\npatchSpine38AtlasRotations();',sandbox);
const atlas=new TextureAtlas();
sandbox.window.__archiveUseLegacyAtlasRotations=false;
atlas.load();
assert.equal(atlas.regions[0].rotate,false,'Other game atlas region was modified');
const normal=new RegionAttachment();
normal.setRegion({u:0.1,v:0.2,u2:0.7,v2:0.8,degrees:270});
assert.deepEqual(normal.uvs,['native'],'Other game region attachment did not use native runtime');
sandbox.window.__archiveUseLegacyAtlasRotations=true;
atlas.load();
assert.equal(atlas.regions[0].rotate,true,'Blue Archive 270 degree region not corrected');
const blueArchive=new RegionAttachment();
blueArchive.setRegion({u:0.1,v:0.2,u2:0.7,v2:0.8,degrees:270});
assert.deepEqual(Array.from(blueArchive.uvs),[0.1,0.2,0.7,0.2,0.7,0.8,0.1,0.8]);
sandbox.window.__archiveUseLegacyAtlasRotations=false;
const switched=new RegionAttachment();
switched.setRegion({degrees:270});
assert.deepEqual(switched.uvs,['native'],'Blue Archive UV override leaked into next game');
console.log('PASS: atlas correction is restricted to designated models');
