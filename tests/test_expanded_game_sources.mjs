import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {sourceRecord} from '../scripts/live2d_sources.mjs';
import {readCharacters,readCatalogRegistry} from '../scripts/catalog_registry.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const chars=JSON.parse(read('data/live2d-expanded-games.json')).characters;
const scopes=JSON.parse(read('data/live2d-source-scopes.json')).scopes;
const source=read('assets/js/live2d/state-and-viewport.js');
const cx=vm.createContext({});vm.runInContext(source.slice(0,source.indexOf('const SAME_ORIGIN=')),cx);
function allow(c,url=c.modelUrl,id=c.id,name=c.skinCode){Object.assign(cx,{url,id,name});return vm.runInContext('modelUrlFor(name,url,id)',cx)}

test('new games use the common registry and retain exact, unique model identities',()=>{
 assert.ok(readCatalogRegistry().some(c=>c.id==='expanded-games'));
 assert.deepEqual(Object.fromEntries(['mementomori','ironsaga','venusscramble','destinychild'].map(game=>[game,chars.filter(c=>c.gameId===game).length])),{mementomori:49,ironsaga:4,venusscramble:17,destinychild:14});
 assert.equal(new Set(readCharacters().map(c=>c.id)).size,readCharacters().length);
 for(const c of chars){
  assert.equal(allow(c),c.modelUrl,c.id);
  assert.equal(allow(c,c.modelUrl.replace(c.sourceCommit,'main')),'');
  assert.equal(allow(c,c.modelUrl,c.id+'-wrong'),'');
  assert.equal(allow(c,c.modelUrl,c.id,c.skinCode+'_wrong'),'');
  assert.equal(allow(c,c.modelUrl.replace(/\/[^/]+$/,'/..%2Fwrong.model3.json')),'');
 }
 assert.ok(!chars.some(c=>c.id==='vs-player_unit_00005'),'Source missing texture must not be indexed');
});

test('Cubism2 file references are validated and repeat imports preserve current preview state',()=>{
 const scope=scopes.find(s=>s.id==='ironsaga');
 const tree=['leila/model.model.json','leila/hero.moc','leila/texture.png','leila/idle.mtn','leila/physics.json']
  .map(path=>({path,type:'blob',size:1000}));
 const settings={model:'hero.moc',textures:['texture.png'],physics:'physics.json',motions:{idle:[{file:'idle.mtn'}]}};
 const entry=sourceRecord(scope,'leila/model.model.json',settings,tree);
 assert.equal(entry.id,'is-leila');assert.equal(entry.skinCode,'model');assert.equal(entry.modelFormat,'cubism2');assert.equal(entry.motionCount,1);
 const prior={...entry,status:'browser-preview-captured',preview:'./exact.webp',previewSha256:'b'.repeat(64)};
 assert.deepEqual(sourceRecord(scope,'leila/model.model.json',settings,tree,prior),prior);
 assert.throws(()=>sourceRecord(scope,'leila/model.model.json',settings,tree.filter(x=>!x.path.endsWith('idle.mtn'))),/Missing/);
 assert.throws(()=>sourceRecord(scope,'leila/model.model.json',{...settings,model:'../../escape.moc'},tree),/escapes/);
});

test('source format and ID mapping are explicit; Cubism3 IDs can preserve uppercase setting stems',()=>{
 const scope=scopes.find(s=>s.id==='mementomori');
 const tree=['CHR_000001/CHR_000001.model3.json','CHR_000001/hero.moc3','CHR_000001/tex.png'].map(path=>({path,type:'blob',size:1000}));
 const settings={Version:3,FileReferences:{Moc:'hero.moc3',Textures:['tex.png']}};
 const record=sourceRecord(scope,'CHR_000001/CHR_000001.model3.json',settings,tree);
 assert.equal(record.id,'mm-chr_000001');assert.equal(record.skinCode,'CHR_000001');assert.equal(allow(record),record.modelUrl);
 assert.throws(()=>sourceRecord({...scope,import:{...scope.import,format:'cubism2'}},'CHR_000001/CHR_000001.model3.json',settings,tree),/Incomplete/);
});
