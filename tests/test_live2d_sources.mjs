import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectScope,prepareSourceRecord,sourceRecord,sourceSettings,settingsBlob,main,mapBounded} from '../scripts/live2d_sources.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
const scope={id:'test',gameId:'sample',sourceRepo:'owner/repo',sourceCommit:'a'.repeat(40),directory:'game',name:'Sample',requireComplete:true,
 import:{idPrefix:'s-',pattern:'^([a-z]+)\\/\\1\\.model3\\.json$',minimumTextureBytes:100}};
const tree=['hero/hero.model3.json','hero/hero.moc3','hero/tex.png','hero/motions/idle.motion3.json','other/other.model3.json']
 .map(path=>({path,type:'blob',size:1000}));
const settings={Version:3,FileReferences:{Moc:'hero.moc3',Textures:['tex.png'],Motions:{'':[{File:'motions/idle.motion3.json'}]}}};
test('settings cache reuses only exact Git blobs and repairs corrupted cached bytes',async()=>{
 const cacheRoot=fs.mkdtempSync(path.join(os.tmpdir(),'anime-settings-cache-'));
 const bytes=Buffer.from(JSON.stringify(settings)),sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 const entry={path:'hero/hero.model3.json',size:bytes.length,sha};let requests=0;
 const fetcher=async(url,options)=>{requests++;assert.equal(url,'https://raw.githubusercontent.com/owner/repo/'+scope.sourceCommit+'/game/hero/hero.model3.json');assert.ok(options.signal instanceof AbortSignal);return new Response(bytes)};
 const options={cacheRoot,fetcher},file=path.join(cacheRoot,sha+'.json');
 try{
  assert.deepEqual(await settingsBlob(scope,entry,options),settings);
  assert.deepEqual(await settingsBlob(scope,entry,options),settings);assert.equal(requests,1);
  fs.writeFileSync(file,Buffer.alloc(bytes.length,32));
  assert.deepEqual(await settingsBlob(scope,entry,options),settings);assert.equal(requests,2);
  assert.deepEqual(fs.readdirSync(cacheRoot),[sha+'.json']);
 }finally{for(const file of fs.readdirSync(cacheRoot))fs.unlinkSync(path.join(cacheRoot,file));fs.rmdirSync(cacheRoot)}
});

test('settings download rejects invalid budgets, wrong blobs and oversized streams before caching',async()=>{
 const cacheRoot=fs.mkdtempSync(path.join(os.tmpdir(),'anime-settings-budget-'));
 const entry={path:'hero/hero.model3.json',size:3,sha:'a'.repeat(40)};let cancelled=false;
 try{
  await assert.rejects(()=>settingsBlob(scope,{...entry,sha:'../escape'},{cacheRoot}),/budget/);
  await assert.rejects(()=>settingsBlob(scope,{...entry,size:4*1024*1024+1},{cacheRoot}),/budget/);
  await assert.rejects(()=>settingsBlob(scope,entry,{cacheRoot,fetcher:async()=>new Response('bad')}),/blob mismatch/);
  await assert.rejects(()=>settingsBlob(scope,entry,{cacheRoot,fetcher:async()=>new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(4))},cancel(){cancelled=true}}))}),/byte budget/);
  assert.equal(cancelled,true);assert.deepEqual(fs.readdirSync(cacheRoot),[]);
 }finally{fs.rmdirSync(cacheRoot)}
});
test('full-source validation bounds simultaneous work and preserves source order',async()=>{
 let active=0,peak=0;
 const result=await mapBounded([0,1,2,3,4,5,6],3,async value=>{
  active++;peak=Math.max(peak,active);await new Promise(resolve=>setImmediate(resolve));active--;return value*2;
 });
 assert.equal(peak,3);assert.equal(active,0);assert.deepEqual(result,[0,2,4,6,8,10,12]);
 await assert.rejects(()=>mapBounded([1],0,async x=>x),/concurrency/);
});
test('coverage is based on the whole pinned source scope, including unindexed models',()=>{
 const records=[{gameId:'sample',sourceRepo:scope.sourceRepo,sourceCommit:scope.sourceCommit,id:'s-hero',sourcePath:'game/hero/hero.model3.json'}];
 const audit=inspectScope(scope,tree,records);
 assert.equal(audit.scopeComplete,false);assert.equal(audit.sourceModelSettings,2);
 assert.equal(audit.unindexedSourceSettings[0].path,'game/other/other.model3.json');
 assert.equal(inspectScope(scope,tree.slice(0,-1),records).scopeComplete,true);
 assert.equal(sourceSettings(scope,[{type:'blob',path:'hero/model3.json'}]).length,1);
});

test('declared accessory effects remain audited but never count as missing or indexed character skins',()=>{
 const records=[{gameId:'sample',sourceRepo:scope.sourceRepo,sourceCommit:scope.sourceCommit,id:'s-hero',sourcePath:'game/hero/hero.model3.json'}];
 const effectScope={...scope,auxiliarySettings:{'other/other.model3.json':{kind:'accessory-effect',reason:'Native frame contains a standalone necklace, not a character'}}};
 const audit=inspectScope(effectScope,tree,records);
 assert.equal(audit.sourceModelSettings,2);assert.equal(audit.indexedModelSettings,1);assert.equal(audit.auxiliarySettings.length,1);assert.equal(audit.scopeComplete,true);
 assert.equal(inspectScope(effectScope,tree,[...records,{...records[0],id:'s-effect',sourcePath:'game/other/other.model3.json'}]).scopeComplete,false);
 assert.equal(inspectScope({...scope,auxiliarySettings:{'missing/missing.model3.json':{reason:'Typo'}}},tree,records).scopeComplete,false);
 assert.equal(inspectScope({...scope,auxiliarySettings:{'other/other.model3.json':{}}},tree,records).scopeComplete,false);
 assert.equal(inspectScope({...scope,auxiliarySettings:Object.fromEntries(sourceSettings(scope,tree).map(e=>[e.path,{kind:'accessory-effect',reason:'Must not certify an empty portrait selection'}]))},tree,[]).scopeComplete,false);
});

test('visual-quality failures remain explicit source gaps and never certify source completeness',()=>{
 const records=[{gameId:'sample',sourceRepo:scope.sourceRepo,sourceCommit:scope.sourceCommit,id:'s-hero',sourcePath:'game/hero/hero.model3.json'}];
 const qualityScope={...scope,qualityExclusions:{'other/other.model3.json':{reason:'Visual layout unresolved',failureType:'visual-layout-unresolved'}}};
 const audit=inspectScope(qualityScope,tree,records);
 assert.equal(audit.scopeComplete,false);assert.equal(audit.unindexedSourceSettings.length,1);
 assert.equal(audit.unindexedSourceSettings[0].failureType,'visual-layout-unresolved');
 assert.equal(audit.qualityExclusions[0].path,'game/other/other.model3.json');
 assert.equal(inspectScope(qualityScope,tree,[...records,{...records[0],id:'s-other',sourcePath:'game/other/other.model3.json'}]).scopeComplete,false);
});
test('imports preserve stable model identity and exact existing preview metadata',()=>{
 const first=sourceRecord(scope,'hero/hero.model3.json',settings,tree);
 assert.equal(first.id,'s-hero');assert.equal(first.status,'indexed-unverified');assert.equal(first.motionCount,1);
 const captured={...first,status:'browser-preview-captured',preview:'./exact.webp',previewSha256:'b'.repeat(64),previewSourceIdentity:['exact']};
 const second=sourceRecord(scope,'hero/hero.model3.json',settings,tree,captured);
 assert.deepEqual(second,captured);assert.deepEqual(sourceRecord(scope,'hero/hero.model3.json',settings,tree,second),second);
});

test('declared labels group costumes without replacing custom names or touching captured source identity',()=>{
 const labelled={...scope,import:{...scope.import,names:{hero:'Known Hero · Costume 01'},nameMetadata:{hero:{character:'Known Hero',title:'Costume 01'}}}};
 const old=sourceRecord(scope,'hero/hero.model3.json',settings,tree);
 const captured={...old,preview:'./exact.webp',previewSha256:'b'.repeat(64),previewSourceIdentity:['exact'],status:'browser-preview-captured'};
 const updated=sourceRecord(labelled,'hero/hero.model3.json',settings,tree,captured);
 assert.equal(updated.name,'Known Hero · Costume 01');assert.equal(updated.characterName,'Known Hero');assert.equal(updated.costumeName,'Costume 01');
 assert.equal(updated.id,captured.id);assert.equal(updated.modelUrl,captured.modelUrl);assert.equal(updated.preview,captured.preview);assert.deepEqual(updated.previewSourceIdentity,captured.previewSourceIdentity);
 assert.deepEqual(sourceRecord(labelled,'hero/hero.model3.json',settings,tree,updated),updated);
 const custom={...captured,name:'Reviewed name',characterName:'Reviewed person',costumeName:'Reviewed costume'};
 assert.deepEqual(sourceRecord(labelled,'hero/hero.model3.json',settings,tree,custom),custom);
});

test('audited texture ordering preserves every pinned file and invalidates the old captured model',()=>{
 const refs={...settings.FileReferences,Textures:['mask.png','tex.png']};
 const source={...settings,FileReferences:refs},files=[...tree,{path:'hero/mask.png',type:'blob',size:20}];
 const repair={...scope,import:{...scope.import,normalizedSettingsDirectory:'assets/model-settings/newgames',textureOrderOverrides:{hero:{expected:['mask.png','tex.png'],order:['tex.png','mask.png']}}}};
 const old={...sourceRecord(scope,'hero/hero.model3.json',source,files),preview:'./wrong.webp',previewSha256:'b'.repeat(64),status:'browser-preview-captured'};
 const {record,generated}=prepareSourceRecord(repair,'hero/hero.model3.json',source,files,old);
 assert.match(record.modelUrl,/s-hero[.]model3[.]json[?]v=[a-f0-9]{64}$/);assert.equal(record.skinCode,old.skinCode);
 assert.equal(record.preview,undefined);assert.equal(record.status,'indexed-unverified');assert.equal(record.id,old.id);
 assert.deepEqual(JSON.parse(generated.body).FileReferences.Textures.map(x=>x.split('/').at(-1)),['tex.png','mask.png']);
 assert.deepEqual(source.FileReferences.Textures,['mask.png','tex.png']);
 for(const override of [{expected:['tex.png','mask.png'],order:['tex.png','mask.png']},{expected:refs.Textures,order:['tex.png']},{expected:refs.Textures,order:['tex.png','tex.png']}]){
  const bad={...repair,import:{...repair.import,textureOrderOverrides:{hero:override}}};
  assert.throws(()=>sourceRecord(bad,'hero/hero.model3.json',source,files),/texture order/);
 }
});
test('missing files, path escapes, unexpected identities and unsupported model schemas fail before import',()=>{
 assert.throws(()=>sourceRecord(scope,'hero/hero.model3.json',settings,tree.filter(x=>!x.path.endsWith('tex.png'))),/Missing/);
 assert.throws(()=>sourceRecord(scope,'hero/hero.model3.json',{...settings,FileReferences:{...settings.FileReferences,Moc:'../../outside.moc3'}},tree),/escapes/);
 assert.throws(()=>sourceRecord(scope,'hero/hero.model3.json',settings,tree,{id:'other',modelUrl:'wrong'}),/identity differs/);
 assert.throws(()=>sourceRecord(scope,'hero/hero.model3.json',{...settings,Version:2},tree),/Incomplete/);
});

test('empty or accidentally narrowed source scopes never certify completeness',()=>{
 assert.equal(inspectScope(scope,[],[]).scopeComplete,false);
 assert.equal(inspectScope({...scope,selection:'never-match'},tree,[]).scopeComplete,false);
});
test('overlapping source adapters only count indexed records inside their selection',()=>{
 const records=['hero','other'].map(name=>({gameId:'sample',sourceRepo:scope.sourceRepo,sourceCommit:scope.sourceCommit,id:name,sourcePath:'game/'+name+'/'+name+'.model3.json'}));
 const report=inspectScope({...scope,selection:'/hero/'},tree,records);
 assert.equal(report.indexedModelSettings,1);assert.equal(report.indexedMissingFromScope.length,0);
 assert.equal(report.scopeComplete,true);
});
test('nested identity captures preserve the old character and costume ID independently of setting stem',()=>{
 const adapter={...scope,import:{idPrefix:'gc-',pattern:'^(girl[0-9]+)/(l2d[0-9]+)[.]u/\\2[.]u[.]model3[.]json$',idGroups:[1,2],modelStemGroup:2,modelStemSuffix:'.u'}};
 const files=['girl101/l2d01.u/l2d01.u.model3.json','girl101/l2d01.u/hero.moc3','girl101/l2d01.u/tex.png'].map(path=>({path,type:'blob',size:1000}));
 const record=sourceRecord(adapter,files[0].path,{Version:3,FileReferences:{Moc:'hero.moc3',Textures:['tex.png']}},files);
 assert.equal(record.id,'gc-girl101-l2d01');assert.equal(record.skinCode,'l2d01.u');
});

test('informational incomplete sources retain diagnostics while explicit imports still fail',async()=>{
 const settingsText=JSON.stringify({model:'model.moc',textures:['tex.png']});
 const bytes=Buffer.from(settingsText),sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 const files=['00001','00002'].flatMap(id=>{
  const folder='playerunits/player_unit_'+id+'/live2d/';
  return [{type:'blob',path:folder+'model.json',size:bytes.length,sha},
   {type:'blob',path:folder+'model.moc',size:1000},
   ...(id==='00001'?[{type:'blob',path:folder+'tex.png',size:1000}]:[])];
 });
 const previousFetch=globalThis.fetch,previousExit=process.exitCode;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'anime-source-gates-'));
 const output=path.join(dir,'audit.json');
 globalThis.fetch=async value=>{
  const url=String(value);
  if(url.includes('raw.githubusercontent.com'))return new Response(settingsText);
  if(url.includes('trees/7e446cbd95ec352cdb0f73c079e4d075d7d528ac'))
   return Response.json({tree:[{type:'tree',path:'VenusScramble',sha:'fixture'}]});
  if(url.includes('trees/fixture'))return Response.json({sha:'fixture',tree:files,truncated:false});
  throw Error('Unexpected source request '+url);
 };
 try{
  process.exitCode=0;
  const audit=await main(['--scope','venusscramble','--output',output]);
  assert.equal(process.exitCode,0);assert.equal(audit[0].scopeComplete,false);
  assert.equal(audit[0].failedModels.length,1);assert.match(audit[0].failedModels[0].error,/Missing/);
  await main(['--scope','venusscramble','--import','venusscramble','--dry-run','--output',output]);
  assert.equal(process.exitCode,1,'Explicit partial import must not be reported as success');
 }finally{
  globalThis.fetch=previousFetch;process.exitCode=previousExit;
  if(fs.existsSync(output))fs.unlinkSync(output);fs.rmdirSync(dir);
 }
});
