import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeCatalogRecords,readCharacters} from '../scripts/catalog_registry.mjs';
import {auditCatalogCompatibility,verifySnapshotPreviews} from '../scripts/catalog_compatibility.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
const a={id:'a-hero',gameId:'a',engine:'cubism',skinCode:'hero',modelUrl:'https://a.test/ref/hero.model3.json',sourcePath:'hero/model3.json',preview:'./a.webp',previewSha256:'a'.repeat(64),previewSource:'matching-live2d-animation-frame',previewSourceIdentity:['cubism','','','','https://a.test/ref/hero.model3.json','',''],status:'browser-preview-captured'};
const b={id:'b-hero',gameId:'b',engine:'cubism',skinCode:'hero',modelUrl:'https://b.test/ref/hero.model3.json',sourcePath:'hero/model3.json'};
const snapshot=characters=>({registry:[{id:'test',path:'data/test.json'}],catalogs:[{id:'test',path:'data/test.json',characters}]});

test('additive imports preserve unrelated games even when their source-relative paths collide',()=>{
 const first=mergeCatalogRecords([a],[b]);
 assert.equal(first[0],a);assert.deepEqual(first,[a,b]);
 assert.deepEqual(mergeCatalogRecords(first,[b]),first,'Running an import twice is idempotent');
 const refreshed=mergeCatalogRecords(first,[{...a,textureBytes:123,previewSource:'not-rendered',status:'indexed-unverified'}]);
 assert.equal(refreshed[0].preview,a.preview);assert.equal(refreshed[0].status,a.status);assert.equal(refreshed[0].textureBytes,123);
 assert.equal(refreshed[1],b);
});
test('ID collisions, duplicate input and accidental resource replacements fail before mutation',()=>{
 const original=structuredClone(a);
 for(const incoming of [[{...a,modelUrl:'https://wrong.test/model'}],[{...a,gameId:'wrong'}],[b,b]])assert.throws(()=>mergeCatalogRecords([a],incoming));
 assert.throws(()=>mergeCatalogRecords([a],[b],{registered:[a,b]}),/another catalog/);
 assert.deepEqual(a,original);
 const changed=mergeCatalogRecords([a],[{...a,modelUrl:'https://a.test/new/model'}],{updateExisting:[a.id]})[0];
 assert.equal(changed.preview,undefined);assert.equal(changed.previewSourceIdentity,undefined);assert.equal(changed.playbackStatus,'not-verified');
});
test('compatibility gate rejects old-ID removal, changed skins, stale previews and moved catalog ownership',()=>{
 assert.equal(auditCatalogCompatibility(snapshot([a]),snapshot([a,b])).compatible,true);
 for(const next of [[],[{...a,skinCode:'other'}],[{...a,modelUrl:'https://other.test'}],[{...a,preview:null}],[a,a]])assert.equal(auditCatalogCompatibility(snapshot([a]),snapshot(next)).compatible,false);
 const after=snapshot([a]);after.catalogs[0].id='other';
 assert.ok(auditCatalogCompatibility(snapshot([a]),after).errors.some(e=>e.type==='moved-model'));
});
test('reviewed repairs require exact before/after declarations and a newly matching preview identity',()=>{
 const next={...a,modelUrl:'https://a.test/new/model'};
 const declaration={id:a.id,field:'modelUrl',before:a.modelUrl,after:next.modelUrl,reason:'Verified source repair'};
 assert.equal(auditCatalogCompatibility(snapshot([a]),snapshot([next]),{changes:[declaration]}).compatible,false,'Old preview must not validate a new resource');
 next.previewSourceIdentity=['cubism','','','',next.modelUrl,'',''];
 assert.equal(auditCatalogCompatibility(snapshot([a]),snapshot([next]),{changes:[declaration]}).compatible,true);
 assert.equal(auditCatalogCompatibility(snapshot([a]),snapshot([next]),{changes:[{...declaration,after:'unrelated'}]}).compatible,false);
});
test('newly added aliases cannot silently redirect an old portrait link',()=>{
 const alternate={id:'al-rig_2_hx',gameId:'azurlane',characterName:'Rig',skinCode:'rig_2_hx',engine:'cubism',modelUrl:'https://test.example/alt'};
 const standard={...alternate,id:'al-rig_2',skinCode:'rig_2',modelUrl:'https://test.example/standard'};
 const result=auditCatalogCompatibility(snapshot([alternate]),snapshot([alternate,standard]));
 assert.ok(result.errors.some(e=>e.type==='changed-default-model'&&e.id===alternate.id));
});

test('inherited preview mismatches stay visible without masking new regressions or file tampering',()=>{
 const stale={...a,previewSourceIdentity:['old-source']};
 const result=auditCatalogCompatibility(snapshot([stale]),snapshot([stale,b]));
 assert.equal(result.compatible,true);assert.deepEqual(result.inheritedIssues,[{type:'stale-preview',id:a.id}]);
 for(const next of [{...stale,modelUrl:'https://changed.test'},{...stale,previewSha256:'b'.repeat(64)},{...stale,preview:'./different.webp'}]){
  const report=auditCatalogCompatibility(snapshot([stale]),snapshot([next]));
  assert.ok(report.errors.some(e=>e.type==='stale-preview'));assert.deepEqual(report.inheritedIssues,[]);
 }
 assert.ok(verifySnapshotPreviews(snapshot([stale]),process.cwd()).length,'Inherited metadata never bypasses file checks');
});
test('preview file checks detect missing, tampered and escaping files',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'archive-compat-'));
 try{
  const dir=path.join(root,'assets','animation-previews');fs.mkdirSync(dir,{recursive:true});
  const data=Buffer.from('known captured bytes'),file=path.join(dir,'a.webp');fs.writeFileSync(file,data);
  const c={...a,preview:'./assets/animation-previews/a.webp',previewSha256:createHash('sha256').update(data).digest('hex')};
  assert.deepEqual(verifySnapshotPreviews(snapshot([c]),root),[]);
  fs.writeFileSync(file,'different');assert.equal(verifySnapshotPreviews(snapshot([c]),root)[0].type,'preview-digest-mismatch');
  fs.unlinkSync(file);assert.equal(verifySnapshotPreviews(snapshot([c]),root)[0].type,'missing-preview-file');
  assert.equal(verifySnapshotPreviews(snapshot([{...c,preview:'./assets/../../outside.webp'}]),root)[0].type,'invalid-preview-path');
 }finally{if(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep))fs.rmSync(root,{recursive:true,force:true})}
});
test('all existing Cubism catalog records still resolve to their own allowed source',async()=>{
 const fs=await import('node:fs'),vm=await import('node:vm');
 const cx=vm.createContext({location:{origin:'https://archive.example',href:'https://archive.example/azurlane-stage.html'},document:{getElementById:()=>({})},navigator:{},URL});
 cx.window=cx;
 vm.runInContext(fs.readFileSync(new URL('../assets/js/live2d/additional-sources.js',import.meta.url),'utf8'),cx);
 vm.runInContext(fs.readFileSync(new URL('../assets/js/live2d/state-and-viewport.js',import.meta.url),'utf8'),cx);
 for(const c of readCharacters().filter(c=>c.engine==='cubism')){
  cx.c=c;
  assert.equal(vm.runInContext('!!modelUrlFor(c.skinCode,c.modelUrl,c.id)',cx),true,c.id);
 }
});
