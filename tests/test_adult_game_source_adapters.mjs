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
 for(const id of ['rs-player','rs-baisu','kg-s_chihaya01','kg-v106a','kg2-s_yayoi01','ss-char2d_live2d_002']){
  assert.equal(resolve(id,local(id),id),new URL(local(id),location.href).href);
 }
});
test('new adult game source adapters reject foreign origins, altered identities, and path escapes',()=>{
 assert.equal(resolve('rs-player',local('rs-baisu'),'rs-player'),'');
 assert.equal(resolve('kg-s_chihaya01',local('kg-s_chihaya01'),'kg-s_yukari01'),'');
 assert.equal(resolve('rs-player','https://outside.example/model.json','rs-player'),'');
 assert.equal(resolve('rs-player','./assets/model-settings/newgames/../rs-player.model.json?v='+hash,'rs-player'),'');
 assert.equal(resolve('rs-player',local('rs-player').slice(0,-1),'rs-player'),'');
 assert.equal(resolve('ss-char2d_live2d_002',local('ss-char2d_live2d_003'),'ss-char2d_live2d_002'),'');
 assert.equal(resolve('ss-char2d_live2d_002',local('ss-char2d_live2d_002'),'ss-char_cg_live2d_002'),'');
 assert.equal(resolve('ss-char2d_live2d_003',local('ss-char2d_live2d_002'),'ss-char2d_live2d_002'),'');
});
test('Cubism3 adult-game chapter is restricted to the fixed source commit and same-character stem',()=>{
 const source='https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model@7e446cbd95ec352cdb0f73c079e4d075d7d528ac/';
 const path='galgame live2d/神楽黎明記～Live2d/神楽黎明記～初花の章～/s_hatsuka01/s_hatsuka01.model3.json';
 const valid=source+path.split('/').map(encodeURIComponent).join('/');
 assert.equal(resolve('s_hatsuka01',valid,'kg3-s_hatsuka01'),valid);
 assert.equal(resolve('s_natsu01',valid,'kg3-s_hatsuka01'),'');
 assert.equal(resolve('s_hatsuka01',valid.replace('7e446cbd95ec352cdb0f73c079e4d075d7d528ac','main'),'kg3-s_hatsuka01'),'');
});

test('Reverse1999 source adapter binds the pinned commit, directory, setting and exact model ID',()=>{
 const source='https://cdn.jsdelivr.net/gh/myssal/Reverse-1999-CN-Asset@45e75248ba3b25053fd32e63ab13c2f9f54dd9df/live2d/roles/';
 for(const name of ['300301_hujisheng','v4a0_304805_yl','s01_300301']){
  const id='r99-'+name.toLowerCase(),url=source+name+'/'+name+'.model3.json';
  assert.equal(resolve(name,url,id),url);
  assert.equal(resolve(name,url.replace('@45e75248ba3b25053fd32e63ab13c2f9f54dd9df/','@main/'),id),'');
  assert.equal(resolve(name,url,'r99-other'),'');
  assert.equal(resolve('other',url,id),'');
  assert.equal(resolve(name,url+'?redirect=other',id),'');
  assert.equal(resolve(name,source+'../'+name+'/'+name+'.model3.json',id),'');
  assert.equal(resolve(name,source+name+'/other.model3.json',id),'');
  assert.equal(resolve(name,url.replace('cdn.jsdelivr.net','outside.example'),id),'');
 }
 const name='v1a6_308402_gt',id='r99-'+name,url='./assets/model-settings/newgames/'+id+'.model3.json?v='+hash;
 assert.equal(resolve(name,url,id),new URL(url,location.href).href);
 assert.equal(resolve('v2a7_304804_yl',url,id),'');
 assert.equal(resolve(name,url.replace(id,'r99-other'),id),'');
 assert.equal(resolve(name,url.slice(0,-1),id),'');
});
