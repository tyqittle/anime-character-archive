import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../assets/js/live2d/additional-sources.js',import.meta.url),'utf8');
const location={href:'https://example.test/anime-character-archive/azurlane-stage.html'};
const root={location};
vm.runInNewContext(code,{window:root,URL});
const resolve=root.ArchiveAdditionalLive2DSources.resolve;
const hash='a'.repeat(64);
const local=id=>'./assets/model-settings/newgames/'+id+'.model.json?v='+hash;
test('adult game character and monster IDs resolve strictly to their own local Cubism2 settings',()=>{
 for(const id of ['rs-player','rs-baisu','kg-s_chihaya01','kg-v106a','kg2-s_yayoi01']){
  assert.equal(resolve(id,local(id),id),new URL(local(id),location.href).href);
 }
});
test('new adult game source adapters reject foreign origins, altered identities, and path escapes',()=>{
 assert.equal(resolve('rs-player',local('rs-baisu'),'rs-player'),'');
 assert.equal(resolve('kg-s_chihaya01',local('kg-s_chihaya01'),'kg-s_yukari01'),'');
 assert.equal(resolve('rs-player','https://outside.example/model.json','rs-player'),'');
 assert.equal(resolve('rs-player','./assets/model-settings/newgames/../rs-player.model.json?v='+hash,'rs-player'),'');
 assert.equal(resolve('rs-player',local('rs-player').slice(0,-1),'rs-player'),'');
});
test('Cubism3 adult-game chapter is restricted to the fixed source commit and same-character stem',()=>{
 const source='https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model@7e446cbd95ec352cdb0f73c079e4d075d7d528ac/';
 const path='galgame live2d/神楽黎明記～Live2d/神楽黎明記～初花の章～/s_hatsuka01/s_hatsuka01.model3.json';
 const valid=source+path.split('/').map(encodeURIComponent).join('/');
 assert.equal(resolve('s_hatsuka01',valid,'kg3-s_hatsuka01'),valid);
 assert.equal(resolve('s_natsu01',valid,'kg3-s_hatsuka01'),'');
 assert.equal(resolve('s_hatsuka01',valid.replace('7e446cbd95ec352cdb0f73c079e4d075d7d528ac','main'),'kg3-s_hatsuka01'),'');
});
