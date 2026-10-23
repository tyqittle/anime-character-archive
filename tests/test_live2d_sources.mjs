import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectScope,sourceRecord,sourceSettings} from '../scripts/live2d_sources.mjs';
const scope={id:'test',gameId:'sample',sourceRepo:'owner/repo',sourceCommit:'a'.repeat(40),directory:'game',name:'Sample',requireComplete:true,
 import:{idPrefix:'s-',pattern:'^([a-z]+)\\/\\1\\.model3\\.json$',minimumTextureBytes:100}};
const tree=['hero/hero.model3.json','hero/hero.moc3','hero/tex.png','hero/motions/idle.motion3.json','other/other.model3.json']
 .map(path=>({path,type:'blob',size:1000}));
const settings={Version:3,FileReferences:{Moc:'hero.moc3',Textures:['tex.png'],Motions:{'':[{File:'motions/idle.motion3.json'}]}}};
test('coverage is based on the whole pinned source scope, including unindexed models',()=>{
 const records=[{gameId:'sample',sourceRepo:scope.sourceRepo,sourceCommit:scope.sourceCommit,id:'s-hero',sourcePath:'game/hero/hero.model3.json'}];
 const audit=inspectScope(scope,tree,records);
 assert.equal(audit.scopeComplete,false);assert.equal(audit.sourceModelSettings,2);
 assert.equal(audit.unindexedSourceSettings[0].path,'game/other/other.model3.json');
 assert.equal(inspectScope(scope,tree.slice(0,-1),records).scopeComplete,true);
 assert.equal(sourceSettings(scope,[{type:'blob',path:'hero/model3.json'}]).length,1);
});
test('imports preserve stable model identity and exact existing preview metadata',()=>{
 const first=sourceRecord(scope,'hero/hero.model3.json',settings,tree);
 assert.equal(first.id,'s-hero');assert.equal(first.status,'indexed-unverified');assert.equal(first.motionCount,1);
 const captured={...first,status:'browser-preview-captured',preview:'./exact.webp',previewSha256:'b'.repeat(64),previewSourceIdentity:['exact']};
 const second=sourceRecord(scope,'hero/hero.model3.json',settings,tree,captured);
 assert.deepEqual(second,captured);assert.deepEqual(sourceRecord(scope,'hero/hero.model3.json',settings,tree,second),second);
});
test('missing files, path escapes, unexpected identities and unsupported model schemas fail before import',()=>{
 assert.throws(()=>sourceRecord(scope,'hero/hero.model3.json',settings,tree.filter(x=>!x.path.endsWith('tex.png'))),/Missing/);
 assert.throws(()=>sourceRecord(scope,'hero/hero.model3.json',{...settings,FileReferences:{...settings.FileReferences,Moc:'../../outside.moc3'}},tree),/escapes/);
 assert.throws(()=>sourceRecord(scope,'hero/hero.model3.json',settings,tree,{id:'other',modelUrl:'wrong'}),/identity differs/);
 assert.throws(()=>sourceRecord(scope,'hero/hero.model3.json',{...settings,Version:2},tree),/Incomplete/);
});
