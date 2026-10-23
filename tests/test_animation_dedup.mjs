import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import test from 'node:test';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const context=vm.createContext({});
vm.runInContext(read('assets/js/spine/animation-identity.js'),context);
function collapse(records){
 context.records=records;
 return vm.runInContext('uniqueAnimationEntries(records)',context);
}
function canonical(id){
 context.lookupId=id;
 return vm.runInContext('canonicalAnimationId(lookupId)',context);
}
function voiceIds(record){
 context.record=record;
 return Array.from(vm.runInContext('animationVoiceIdentityIds(record)',context));
}
const catalogs=['data/spine-characters.json','data/spine-bd2-characters.json',
 'data/spine-newgames.json','data/live2d-azurlane.json','data/spine-arknights-illust.json'];
const all=catalogs.flatMap(path=>JSON.parse(read(path)).characters);
const byId=new Map(all.map(c=>[c.id,c]));
const bd2VoiceSource=read('assets/js/spine/character-audio.js');
const bd2VoiceMatch=bd2VoiceSource.match(/^const characterVoiceMap=(\{[^\n]+\});/m);
assert.ok(bd2VoiceMatch,'BD2 voice mapping source not found');
const bd2Voices=JSON.parse(bd2VoiceMatch[1]);
const azurVoices=JSON.parse(read('data/azurlane-voice-map.json')).skinIds;

test('one selectable model per skin, preserving skin-specific preview and voice',()=>{
 const filtered=collapse(all);
 const ids=new Set(filtered.map(c=>c.id));
 assert.equal(ids.size,filtered.length);
 const paired=all.filter(c=>!ids.has(c.id)&&byId.has(c.id.replace(/(?:_c|_hx)$/,'')));
 const bd2=paired.filter(c=>c.gameId==='browndust2');
 const azur=paired.filter(c=>c.gameId==='azurlane');
 assert.equal(bd2.length,4,'Known BD2 alternate rig duplicates should be merged');
 assert.equal(azur.length,21,'Known Azur Lane regional model duplicates should be merged');
 assert.equal(filtered.length,all.length-25,'Only confirmed same-skin variants should be hidden');
 for(const alt of paired){
  const primary=byId.get(canonical(alt.id));
  assert.ok(primary&&ids.has(primary.id),'Variant must link to visible standard model: '+alt.id);
  assert.equal(primary.characterName,alt.characterName);
  if(primary.preview)assert.ok(primary.previewSource?.startsWith('matching-'));
  const map=alt.gameId==='browndust2'?bd2Voices:azurVoices;
  assert.ok(!map[alt.id],'Alternate was already voice-mapped: '+alt.id);
  assert.ok(map[primary.id],'Must keep the model with mapped voice: '+alt.id);
  assert.deepEqual(voiceIds(alt),[alt.id,primary.id]);
 }
 // Genuinely distinct costumes or rig categories must survive.
 for(const id of ['bd2-char066401','bd2-char061302','ak-char_002_amiya-4212a74',
  'ak-illust-003-kalts-boc-6','al-abeikelongbi_3','al-qiye_9']){
  assert.ok(ids.has(id),'Unrelated costumes/animations must stay accessible: '+id);
 }
});
test('deep links and identical-skin decisions are independent of manifest order',()=>{
 const original=collapse(all).map(c=>c.id);
 const backwards=collapse([...all].reverse()).map(c=>c.id);
 assert.deepEqual([...original].sort(),[...backwards].sort());
 assert.equal(canonical('bd2-char066802_c'),'bd2-char066802');
 assert.equal(canonical('al-z23_hx'),'al-z23');
 assert.equal(canonical('al-lafei_4'),'al-lafei_4');
});
test('standalone, unrelated, or mislabeled variants must not be silently deleted',()=>{
 const alt=byId.get('al-z23_hx'),parent=byId.get('al-z23');
 assert.ok(alt&&parent);
 let list=collapse([alt]);
 assert.equal(list.length,1);
 assert.equal(canonical(alt.id),alt.id);
 assert.deepEqual(voiceIds(alt),['al-z23_hx','al-z23']);
 list=collapse([alt,{...parent,characterName:'not the same skin'}]);
 assert.equal(list.length,2,'Mismatched metadata must not trigger deduplication');
 list=collapse([byId.get('bd2-char066802_c')]);
 assert.equal(list.length,1,'Standalone BD2 alt must remain playable');
 assert.deepEqual(voiceIds(list[0]),['bd2-char066802_c','bd2-char066802']);
});
