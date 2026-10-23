import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSourceSettings,normalizedCubism2Settings} from '../scripts/cubism_source_settings.mjs';
import {prepareSourceRecord} from '../scripts/live2d_sources.mjs';
import fs from 'node:fs';
import vm from 'node:vm';

test('browser catalog admits content-bound local settings and refuses mismatched or escaping paths',()=>{
 const source=fs.readFileSync(new URL('../assets/js/spine/bootstrap.js',import.meta.url),'utf8');
 const context=vm.createContext({});vm.runInContext(source.slice(0,source.indexOf('// Catalogs can change')),context);
 const sha='a'.repeat(64),c={id:'tn2-hero',name:'Hero',gameId:'game',engine:'cubism',sourceCommit:'b'.repeat(40),normalizedSettingsSha256:sha,modelUrl:'./assets/model-settings/game/tn2-hero.model.json?v='+sha};
 const valid=value=>{context.c=value;return vm.runInContext('isPlayableAnimationEntry(c)',context)};
 assert.equal(valid(c),true);
 for(const patch of [{id:'other'},{normalizedSettingsSha256:'c'.repeat(64)},{sourceCommit:'main'},{modelUrl:c.modelUrl.replace('/game/','/../')},{modelUrl:'./untrusted.json'}])assert.equal(valid({...c,...patch}),false);
});
test('JSONC repairs preserve quoted URLs, commas and escapes without accepting executable input',()=>{
 const source='{/* source */"url":"https://example.test/a//b", "literal":"x,}","quote":"a\\\"b",// note\n"items":[1,2,],}';
 assert.throws(()=>parseSourceSettings(source));
 assert.deepEqual(parseSourceSettings(source,true),{url:'https://example.test/a//b',literal:'x,}',quote:'a"b',items:[1,2]});
 assert.throws(()=>parseSourceSettings('{"x": process.exit()}',true));
 assert.throws(()=>parseSourceSettings('{/* no end',true),/Unterminated/);
});
test('legacy normalized settings preserve all motion groups and bind the URL to their actual content',()=>{
 const source={model:'hero.moc',textures:['tex.png'],motions:{idle:[{File:'loop.mtn',fade_in:0}],tap:[{file:'tap.mtn'}]}};
 const a=normalizedCubism2Settings(source,p=>'https://fixed.test/revision/'+p,'tn2-hero','assets/model-settings/tokyonecro');
 const settings=JSON.parse(a.body);
 assert.equal(settings.motions.idle[0].file,'https://fixed.test/revision/loop.mtn');
 assert.equal(settings.motions.idle[0].fade_in,0);assert.equal(settings.motions.tap.length,1);
 const b=normalizedCubism2Settings({...source,textures:['different.png']},p=>'https://fixed.test/revision/'+p,'tn2-hero','assets/model-settings/tokyonecro');
 assert.notEqual(a.url,b.url);assert.match(a.url,/\?v=[a-f0-9]{64}$/);
});
test('generated settings still reject missing and escaping motion references before importing a model',()=>{
 const scope={id:'fixture',gameId:'g',directory:'l2d',sourceRepo:'owner/repo',sourceCommit:'a'.repeat(40),import:{format:'cubism2',idPrefix:'tn2-',pattern:'^(hero)/model[.]json$',normalizedSettingsDirectory:'assets/model-settings/tokyonecro'}};
 const settings={model:'hero.moc',textures:['tex.png'],motions:{idle:[{File:'loop.mtn'}]}};
 const tree=['hero/model.json','hero/hero.moc','hero/tex.png','hero/loop.mtn'].map(path=>({path,type:'blob',size:1000}));
 const result=prepareSourceRecord(scope,'hero/model.json',settings,tree);
 assert.equal(result.record.skinCode,'tn2-hero');assert.equal(result.record.modelUrl,result.generated.url);
 assert.match(JSON.parse(result.generated.body).model,/raw\.githubusercontent\.com\/owner\/repo\/a{40}\/l2d\/hero\/hero.moc$/);
 assert.throws(()=>prepareSourceRecord(scope,'hero/model.json',settings,tree.slice(0,-1)),/Missing/);
 assert.throws(()=>prepareSourceRecord(scope,'hero/model.json',{...settings,motions:{idle:[{File:'../../bad.mtn'}]}},tree),/escapes/);
});

test('declared source repairs use one exact local alternative and reject ambiguous or other-model assets',()=>{
 const scope={directory:'l2d',sourceRepo:'owner/repo',sourceCommit:'a'.repeat(40),import:{format:'cubism2',idPrefix:'tn2-',pattern:'^(hero)/model[.]json$',normalizedSettingsDirectory:'assets/model-settings/tokyonecro',referenceRepairs:{caseInsensitive:true,insertDirectories:['android']}}};
 const settings={model:'hero.moc',textures:['model.2048/tex.png'],motions:{idle:[{File:'loop.mtn'}]}};
 const tree=['hero/hero.moc','hero/model.2048/android/tex.png','hero/Loop.mtn'].map(path=>({path,type:'blob',size:1000}));
 const result=prepareSourceRecord(scope,'hero/model.json',settings,tree);
 assert.equal(result.record.sourceReferenceRepairs.length,2);
 const generated=JSON.parse(result.generated.body);
 assert.ok(generated.textures[0].endsWith('/hero/model.2048/android/tex.png'));
 assert.ok(generated.motions.idle[0].file.endsWith('/hero/Loop.mtn'));
 assert.throws(()=>prepareSourceRecord(scope,'hero/model.json',settings,[...tree,{path:'hero/LOOP.mtn',type:'blob',size:1000}]),/Ambiguous/);
 assert.throws(()=>prepareSourceRecord(scope,'hero/model.json',settings,[...tree.slice(0,1),{path:'other/model.2048/android/tex.png',type:'blob',size:1000}]),/Missing/);
});

test('omitted source motions are discovered only inside the same model and invalidate stale preview identity',()=>{
 const scope={directory:'l2d',sourceRepo:'owner/repo',sourceCommit:'a'.repeat(40),import:{format:'cubism2',idPrefix:'tn2-',pattern:'^(hero)/model[.]json$',normalizedSettingsDirectory:'assets/model-settings/tokyonecro',discoverMotionDirectory:'mtn'}};
 const settings={model:'hero.moc',textures:['tex.png']};
 const tree=['hero/hero.moc','hero/tex.png','hero/mtn/loop.mtn','other/mtn/tap.mtn'].map(path=>({path,type:'blob',size:1000}));
 const existing={id:'tn2-hero',modelUrl:'./old.model.json',preview:'./old.webp',previewSourceIdentity:['old'],playbackStatus:'browser-preview-captured'};
 const result=prepareSourceRecord(scope,'hero/model.json',settings,tree,existing);
 assert.deepEqual(result.record.sourceDiscoveredMotions,['mtn/loop.mtn']);
 assert.equal(result.record.motionCount,1);assert.ok(!result.record.preview);
 assert.equal(result.record.playbackStatus,'not-verified');
 assert.ok(JSON.parse(result.generated.body).motions.source_loop[0].file.endsWith('/hero/mtn/loop.mtn'));
 assert.ok(!settings.motions,'Source input is never mutated');
});
