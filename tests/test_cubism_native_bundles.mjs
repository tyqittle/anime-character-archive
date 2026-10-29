import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {nativeBundleDescriptors,validateNativeBundleSettings} from '../scripts/cubism_native_bundles.mjs';
import {sourceSettings,prepareSourceRecord,inspectScope,settingsBlob} from '../scripts/live2d_sources.mjs';

const data={model:'hero.moc',textures:['texture_00.png','texture_01.png'],motions:{idle:[{file:'Default.mtn'}],source_wave:[{file:'Wave.mtn'}]}};
const files=['hero/hero.moc','hero/texture_00.png','hero/texture_01.png','hero/Default.mtn','hero/Wave.mtn'].map(path=>({type:'blob',path,size:1000,sha:'a'.repeat(40)}));
const scope={id:'native',gameId:'native',sourceRepo:'owner/repo',sourceCommit:'b'.repeat(40),directory:'portraits',requireComplete:true,selection:'[.]model[.]json$',
 import:{format:'cubism2',idPrefix:'nb-',pattern:'^([a-z]+)/[a-z]+\\.moc$',nativeBundles:{pattern:'^[a-z]+/[a-z]+\\.moc$',normalizedSettingsDirectory:'assets/model-settings/newgames',models:{'hero/hero.moc':{settings:data}}}}};

test('native bundle discovery uses the complete declared MOC range and refuses omitted bundles',()=>{
 const descriptors=nativeBundleDescriptors(scope,files,[]);
 assert.equal(descriptors.length,1);assert.deepEqual(descriptors[0].derivedSettings,data);
 assert.throws(()=>nativeBundleDescriptors(scope,[...files,{type:'blob',path:'other/other.moc',size:1000}],[]),/Missing native bundle declaration/);
 assert.throws(()=>nativeBundleDescriptors(scope,files.slice(1),[]),/Empty native/);
 assert.throws(()=>nativeBundleDescriptors(scope,files.filter(f=>!f.path.endsWith('Wave.mtn')),[]),/reference absent/);
});

test('source manifests are kept once and must belong to exactly their declared MOC',()=>{
 const file={type:'blob',path:'hero/hero.model.json',size:500};
 const config=structuredClone(scope);config.import.nativeBundles.models['hero/hero.moc']={settingsPath:file.path};
 const descriptors=nativeBundleDescriptors(config,[...files,file],[file]);
 assert.equal(descriptors.length,1);assert.equal(descriptors[0].derivedSettings,undefined);
 assert.equal(validateNativeBundleSettings(descriptors[0],data),data);
 assert.throws(()=>validateNativeBundleSettings(descriptors[0],{...data,model:'other.moc'}),/different MOC/);
 assert.throws(()=>nativeBundleDescriptors(config,files,[]),/source manifest absent/);
});

test('derived manifests reject foreign models, textures and motion paths',()=>{
 for(const update of [{model:'other.moc'},{textures:['../other.png']},{textures:['https://outside.test/t.png']},{motions:{idle:[{file:'../other.mtn'}]}},{textures:['texture_00.png','texture_00.png']}]){
  const config=structuredClone(scope);Object.assign(config.import.nativeBundles.models['hero/hero.moc'].settings,update);
  assert.throws(()=>nativeBundleDescriptors(config,files,[]));
 }
});

test('native bundle imports share normal source identity, completeness and idempotent normalization',()=>{
 const descriptors=sourceSettings(scope,files);assert.equal(descriptors.length,1);
 const audit=inspectScope(scope,files,[]);assert.equal(audit.scopeComplete,false);
 assert.deepEqual(audit.sourceDescriptorCounts,{settingsFiles:0,nativeBundlesWithoutSettings:1});
 const first=prepareSourceRecord(scope,descriptors[0].path,data,files);
 assert.equal(first.record.id,'nb-hero');assert.equal(first.record.modelFormat,'cubism2');assert.equal(first.record.motionCount,2);
 assert.ok(first.generated);assert.match(first.record.modelUrl,/nb-hero.model.json\?v=[a-f0-9]{64}$/);
 assert.equal(inspectScope(scope,files,[first.record]).scopeComplete,true);
 const captured={...first.record,status:'browser-preview-captured',preview:'./same.webp',previewSha256:'c'.repeat(64)};
 const again=prepareSourceRecord(scope,descriptors[0].path,data,files,captured);
 assert.deepEqual(again.record,captured);assert.equal(again.generated.body,first.generated.body);
});

test('derived descriptors require the exact original MOC bytes and never parse them as JSON',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'native-moc-test-'));
 const bytes=Buffer.from([0,77,79,67,255]),sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 const entry={...sourceSettings(scope,files)[0],size:bytes.length,sha};let requests=0;
 try{
  const fetcher=async()=>{requests++;return new Response(bytes)};
  assert.deepEqual(await settingsBlob(scope,entry,{cacheRoot:root,fetcher}),data);
  assert.deepEqual(await settingsBlob(scope,entry,{cacheRoot:root,fetcher}),data);assert.equal(requests,1);
  assert.deepEqual(fs.readdirSync(root),[sha+'.moc']);
  fs.unlinkSync(path.join(root,sha+'.moc'));
  await assert.rejects(()=>settingsBlob(scope,entry,{cacheRoot:root,fetcher:async()=>new Response(Buffer.alloc(bytes.length))}),/blob mismatch/);
  assert.deepEqual(fs.readdirSync(root),[]);
 }finally{
  for(const file of fs.readdirSync(root))fs.unlinkSync(path.join(root,file));fs.rmdirSync(root);
 }
});
