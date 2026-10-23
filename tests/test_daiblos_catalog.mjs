import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readCharacters,readCatalogRegistry} from '../scripts/catalog_registry.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../data/spine-daiblos-core.json',import.meta.url),'utf8'));
const models=data.characters;
test('bulk skin catalog has 100+ distinct exact-source rigs and never claims unverified previews',()=>{
 assert.ok(models.length>=100);assert.equal(data.totalCharacters,models.length);
 assert.equal(models.length,127,'The declared-coordinate repair restores two previously quarantined rigs');
 assert.ok(models.filter(c=>c.preview).length>=125,'Previously rendered previews must be preserved');
 assert.equal(new Set(models.map(c=>c.id)).size,models.length);
 assert.equal(data.quarantinedModels.length,0);
 assert.equal(data.restoredModels.length,2);
 assert.equal(data.excludedModels.length,2);
 assert.ok(!models.some(c=>data.quarantinedModels.some(q=>q.id===c.id)));
 for(const name of ['alps04','hades03'])assert.ok(models.some(c=>c.id.includes(name)));
 assert.ok(!models.some(c=>data.excludedModels.some(x=>x.id===c.id)));
 for(const c of models){
  assert.equal(c.gameId,'daibloscore');assert.equal(c.skeletonFormat,'json');
  assert.equal(c.visualIntegrityPolicy,'coherent-character');
  assert.equal(c.atlasCoordinateSpace,'declared');
  assert.match(c.id,/^dbcore-\d{5}_skin_[a-z0-9_]+-[a-z0-9_]+$/);
  assert.ok(c.base.startsWith('https://raw.githubusercontent.com/bungaku-moe/DaiblosCoreAssets/'+data.sourceCommit+'/spine/'));
  assert.equal(c.skeletonUrl,c.base+'.json');assert.equal(c.atlasUrl,c.base+'.atlas');
  assert.ok(c.textureBytes>800000&&c.textureBytes<13000000);
  assert.ok(c.skeletonBytes>50000&&c.skeletonBytes<6500000);
  assert.ok(c.atlasBytes>500);
  if(c.preview){
   assert.equal(c.previewSource,'matching-spine-animation-frame');
   assert.match(c.previewSha256,/^[a-f0-9]{64}$/);
   assert.ok(fs.existsSync(new URL('../'+c.preview.replace(/^\.\//,''),import.meta.url)),'Matching preview missing: '+c.id);
  }else assert.equal(c.previewSource,'not-rendered');
 }
});
test('all game IDs are unique across registered dynamic catalogs',()=>{
 assert.equal(readCatalogRegistry().filter(x=>x.id==='daibloscore').length,1);
 const all=readCharacters();assert.equal(new Set(all.map(x=>x.id)).size,all.length);
});
