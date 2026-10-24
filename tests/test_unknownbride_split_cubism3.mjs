import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {sourceSettings,prepareSourceRecord} from '../scripts/live2d_sources.mjs';

const root=new URL('../',import.meta.url);
const scope=JSON.parse(fs.readFileSync(new URL('data/live2d-source-scopes.json',root),'utf8')).scopes.find(x=>x.id==='unknownbride-cubism3');
const rootFolder='c_3012';
const settings={Version:3,FileReferences:{
 Moc:'c_3012.moc3',Textures:[],Motions:{'':[{File:'motions/c_3012_home.motion3.json'},{File:'motions/c_3012_gacha.motion3.json'}]}
}};
const file=(p,size=200000)=>({path:p,size,type:'blob'});
const tree=[
 file('c_3012/c_3012.model3.json',600),
 file('c_3012/c_3012.moc3'),
 file('c_3012/textures/texture_00.png',1234567),
 file('c_3012/motions/c_3012_home.motion3.json',200),
 file('c_3012/motions/c_3012_gacha.motion3.json',200)
];
test('source scope selects exactly motion-only Cubism3 descriptors, not any asset JSON',()=>{
 assert.deepEqual(sourceSettings(scope,tree).map(x=>x.path),['c_3012/c_3012.model3.json']);
});
test('high-quality split art and motions form a pinned character model',()=>{
 const {record,generated}=prepareSourceRecord(scope,'c_3012/c_3012.model3.json',settings,tree);
 assert.equal(record.id,'ub-c_3012');
 assert.equal(record.textureBytes,1234567);
 assert.equal(record.motionCount,2);
 assert.equal(record.skinCode,'ub-c_3012');
 assert.equal(record.modelFormat,'cubism3');
 assert.match(record.modelUrl,/^\.\/assets\/model-settings\/newgames\/ub-c_3012\.model3\.json\?v=[a-f0-9]{64}$/);
 const result=JSON.parse(generated.body);
 assert.ok(result.FileReferences.Moc.includes('7e446cbd95ec352cdb0f73c079e4d075d7d528ac'));
 assert.ok(result.FileReferences.Textures[0].endsWith('/c_3012/textures/texture_00.png'));
 assert.ok(result.FileReferences.Motions[''][0].File.endsWith('/c_3012/motions/c_3012_home.motion3.json'));
});
test('split art and model cannot silently accept missing textures, duplicate candidate assets, or no motions',()=>{
 const more=[...tree,file('c_3012/textures/texture_00 .png',1234567)];
 assert.throws(()=>prepareSourceRecord(scope,'c_3012/c_3012.model3.json',settings,more),/ambiguous/);
 assert.throws(()=>prepareSourceRecord(scope,'c_3012/c_3012.model3.json',settings,tree.filter(x=>!x.path.endsWith('.png'))),/Missing/);
 assert.throws(()=>prepareSourceRecord(scope,'c_3012/c_3012.model3.json',{...settings,FileReferences:{...settings.FileReferences,Motions:{}}},tree),/Missing source Cubism3 motions/);
});
test('new model family URL may only resolve its exact same-origin versioned settings',()=>{
 const js=fs.readFileSync(new URL('assets/js/live2d/additional-sources.js',root),'utf8');
 const w={location:{href:'https://example.com/anime-character-archive/azurlane-stage.html'}};
 vm.runInNewContext(js,{window:w,URL});
 const resolve=w.ArchiveAdditionalLive2DSources.resolve;
 const candidate='./assets/model-settings/newgames/ub-c_3012.model3.json?v='+'a'.repeat(64);
 assert.equal(resolve('ub-c_3012',candidate,'ub-c_3012'),'https://example.com/anime-character-archive/assets/model-settings/newgames/ub-c_3012.model3.json?v='+'a'.repeat(64));
 assert.equal(resolve('ub-c_3223',candidate,'ub-c_3223'),'');
 assert.equal(resolve('ub-c_3012','https://example.net/ub-c_3012.model3.json','ub-c_3012'),'');
});
