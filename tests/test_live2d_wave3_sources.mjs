import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Validate the real iframe source adapter with an isolated, inert DOM.
const context=vm.createContext({
 URL,location:{origin:'https://example.test',href:'https://example.test/anime-character-archive/azurlane-stage.html'},
 navigator:{hardwareConcurrency:8,deviceMemory:8,connection:{}},
 document:{getElementById:()=>({})},window:{},console
});
vm.runInContext(fs.readFileSync(new URL('../assets/js/live2d/state-and-viewport.js',import.meta.url),'utf8'),context);
const lookup=vm.runInContext('modelUrlFor',context);
const make=(id,hash='a'.repeat(64))=>'./assets/model-settings/newgames/'+id+'.model.json?v='+hash;
test('pinned wave-3 models are accepted only from their own local settings',()=>{
 for(const id of ['ggz-bronya','ggz-kiana','ao-l_133100611','gs1-lili','gs2-elizabeth_4','wg-209_2']){
  assert.equal(lookup(id,make(id),id),
    'https://example.test/anime-character-archive/assets/model-settings/newgames/'+id+'.model.json?v='+ 'a'.repeat(64),id);
 }
});
test('new source adapter rejects cross-character and unverified URLs',()=>{
 const valid=make('ggz-bronya');
 for(const [name,url,id] of [
  ['ggz-kiana',valid,'ggz-bronya'],
  ['ggz-bronya',valid,'ggz-kiana'],
  ['ggz-bronya','https://attacker.example/'+valid,'ggz-bronya'],
  ['ggz-bronya','./assets/model-settings/tokyonecro/ggz-bronya.model.json?v='+'a'.repeat(64),'ggz-bronya'],
  ['ggz-bronya','./assets/model-settings/newgames/../ggz-bronya.model.json?v='+'a'.repeat(64),'ggz-bronya'],
  ['ggz-bronya',make('ggz-bronya','a'.repeat(63)),'ggz-bronya'],
  ['random-demo',make('random-demo'),'random-demo']
 ]){
  assert.equal(lookup(name,url,id),'',name+' / '+url);
 }
});
