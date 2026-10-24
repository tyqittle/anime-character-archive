// Read-only coverage for every registered source scope; explicit imports reuse
// the same file-reference checks and preserve existing model IDs and previews.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {readCharacters} from './catalog_registry.mjs';
import {parseSourceSettings,normalizedCubism2Settings,normalizedCubism3Settings} from './cubism_source_settings.mjs';
const root=new URL('../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
export function sourceSettings(scope,tree){
 const selected=scope.selection?new RegExp(scope.selection):null;
 return tree.filter(x=>x.type==='blob'&&/(?:^|\/)model(?:3)?\.json$|\.model(?:3)?\.json$/i.test(x.path)&&(!selected||selected.test('/'+x.path))
  &&(!scope.import?.pathMappings||Object.hasOwn(scope.import.pathMappings,x.path)));
}
export function inspectScope(scope,tree,records){
 const prefix=scope.directory?scope.directory+'/':'';
 const source=sourceSettings(scope,tree),found=new Set(source.map(x=>prefix+x.path));
 const selection=scope.selection?new RegExp(scope.selection):null;
 const indexed=records.filter(c=>c.gameId===scope.gameId&&c.sourceRepo===scope.sourceRepo&&c.sourceCommit===scope.sourceCommit&&c.sourcePath?.startsWith(prefix)
  &&(!selection||selection.test('/'+c.sourcePath.slice(prefix.length)))
  &&(!scope.import?.pathMappings||Object.hasOwn(scope.import.pathMappings,c.sourcePath.slice(prefix.length))));
 const known=new Set(indexed.map(c=>c.sourcePath));
 const missing=source.filter(x=>!known.has(prefix+x.path)).map(x=>({path:prefix+x.path,format:x.path.endsWith('.model3.json')?'cubism3':'cubism2'}));
 return {id:scope.id,gameId:scope.gameId,sourceRepo:scope.sourceRepo,sourceCommit:scope.sourceCommit,directory:scope.directory,
  sourceModelSettings:source.length,indexedModelSettings:indexed.length,
  unindexedSourceSettings:missing,indexedMissingFromScope:indexed.filter(c=>!found.has(c.sourcePath)).map(c=>({id:c.id,path:c.sourcePath})),
  scopeComplete:source.length>0&&missing.length===0&&indexed.every(c=>found.has(c.sourcePath)),requireComplete:!!scope.requireComplete};
}
export function prepareSourceRecord(scope,relative,settings,tree,existing){
 if(!scope.import)throw Error('No identity adapter configured for '+scope.id);
 const mapped=scope.import.pathMappings?.[relative];
 const match=mapped?[relative,mapped.id]:relative.match(new RegExp(scope.import.pattern));
 if(!match||!match[1])throw Error('Model path is outside the identity rule: '+relative);
 const stem=match[1],legacy=scope.import.format==='cubism2';
 const discoveredMotions=[];
 if(scope.import.discoverMotionDirectory){
  if(!legacy||!/^[-a-z0-9_]+$/.test(scope.import.discoverMotionDirectory))throw Error('Invalid source motion directory');
  settings=structuredClone(settings);settings.motions||={};
  const known=new Set(Object.values(settings.motions).flat().map(x=>x.file||x.File));
  const folder=path.posix.dirname(relative),prefix=folder+'/'+scope.import.discoverMotionDirectory+'/';
  for(const file of tree.filter(x=>x.type==='blob'&&x.size>0&&x.path.startsWith(prefix)&&x.path.endsWith('.mtn'))){
   const ref=path.posix.relative(folder,file.path);if(known.has(ref))continue;
   const group='source_'+path.posix.basename(ref,'.mtn');
   (settings.motions[group]||=[]).push({file:ref});known.add(ref);discoveredMotions.push(ref);
  }
 }
 // Certain complete Cubism3 rigs ship art and motion settings separately.
 // Only an explicitly enabled source scope may compose their one pinned texture.
 if(!legacy&&scope.import.composeCubism3Texture){
  if(settings.Version!==3||!settings.FileReferences?.Moc||!Array.isArray(settings.FileReferences.Textures)||settings.FileReferences.Textures.length!==0)
   throw Error('Expected motion-only Cubism3 manifest: '+relative);
  if(!Object.values(settings.FileReferences.Motions||{}).some(group=>Array.isArray(group)&&group.length))
   throw Error('Missing source Cubism3 motions: '+relative);
  const folder=path.posix.dirname(relative);
  const textureOptions=[
   folder+'/textures/texture_00.png',folder+'/textures/texture_00 .png',
   folder+'/texture_00.png',folder+'/texture_00 .png'
  ].filter(candidate=>tree.some(file=>file.type==='blob'&&file.size>0&&file.path===candidate));
  if(textureOptions.length!==1)throw Error('Missing or ambiguous source Cubism3 texture: '+relative);
  settings=structuredClone(settings);
  settings.FileReferences.Textures=[path.posix.relative(folder,textureOptions[0])];
 }
 const refs=legacy?{Moc:settings.model,Textures:settings.textures,Physics:settings.physics,Pose:settings.pose,
  Expressions:(settings.expressions||[]).map(x=>({File:x.file||x.File})),
  Motions:Object.fromEntries(Object.entries(settings.motions||{}).map(([group,items])=>[group,items.map(x=>({File:x.file||x.File}))]))}:settings.FileReferences;
 if((!legacy&&settings.Version!==3)||!refs?.Moc||!Array.isArray(refs.Textures)||!refs.Textures.length)throw Error('Incomplete Cubism settings: '+relative);
 const files=new Map(tree.filter(x=>x.type==='blob').map(x=>[x.path,x]));
 const referenceRepairs=[];
 function resolve(ref){
  if(typeof ref!=='string'||!ref||/^[a-z]+:|^[/\\]/i.test(ref))throw Error('Invalid source reference: '+ref);
  const result=path.posix.normalize(path.posix.join(path.posix.dirname(relative),ref.replaceAll('\\','/')));
  if(result==='..'||result.startsWith('../'))throw Error('Source reference escapes scope: '+ref);
  if(!(files.get(result)?.size>0)){
   const policy=scope.import.referenceRepairs;
   const candidates=new Set();
   if(policy?.caseInsensitive)for(const [candidate,file] of files)if(file.size>0&&candidate.toLowerCase()===result.toLowerCase())candidates.add(candidate);
   for(const directory of policy?.insertDirectories||[]){
    if(!/^[a-z0-9_-]+$/.test(directory))throw Error('Invalid reference repair directory');
    const candidate=path.posix.join(path.posix.dirname(result),directory,path.posix.basename(result));
    if(files.get(candidate)?.size>0)candidates.add(candidate);
   }
   if(candidates.size!==1)throw Error((candidates.size?'Ambiguous':'Missing or empty')+' source file: '+result);
   const replacement=[...candidates][0];
   if(!referenceRepairs.some(x=>x.from===result))referenceRepairs.push({from:result,to:replacement});
   return replacement;
  }
  return result;
 }
 const motions=Object.values(refs.Motions||{}).flat();
 for(const file of [refs.Moc,...refs.Textures,refs.Physics,refs.Pose,...(refs.Expressions||[]).map(x=>x.File),...motions.map(x=>x.File)].filter(Boolean))resolve(file);
 const textureBytes=refs.Textures.reduce((n,x)=>n+files.get(resolve(x)).size,0);
 if(textureBytes<(scope.import.minimumTextureBytes||1))throw Error('Texture size below declared source policy: '+relative);
 const sourcePath=(scope.directory?scope.directory+'/':'')+relative;
 const upstream='https://cdn.jsdelivr.net/gh/'+scope.sourceRepo+'@'+scope.sourceCommit+'/';
 let modelUrl=upstream+sourcePath.split('/').map(encodeURIComponent).join('/');
 const identity=scope.import.idGroups?scope.import.idGroups.map(index=>match[index]).join('-'):stem;
 if(!/^[a-zA-Z0-9_-]+$/.test(identity))throw Error('Invalid model identity: '+relative);
 const id=scope.import.idPrefix+(scope.import.lowercaseId?identity.toLowerCase():identity);
 const generated=scope.import.normalizedSettingsDirectory?(
  legacy?normalizedCubism2Settings(settings,
  ref=>'https://raw.githubusercontent.com/'+scope.sourceRepo+'/'+scope.sourceCommit+'/'+((scope.directory?scope.directory+'/':'')+resolve(ref)).split('/').map(encodeURIComponent).join('/'),id,scope.import.normalizedSettingsDirectory)
  :scope.import.composeCubism3Texture?normalizedCubism3Settings(settings,
  ref=>'https://raw.githubusercontent.com/'+scope.sourceRepo+'/'+scope.sourceCommit+'/'+((scope.directory?scope.directory+'/':'')+resolve(ref)).split('/').map(encodeURIComponent).join('/'),id,scope.import.normalizedSettingsDirectory)
  :null):null;
 if(generated)modelUrl=generated.url;
 if(existing&&(existing.id!==id||(!generated&&existing.modelUrl!==modelUrl)))throw Error('Existing model identity differs: '+sourcePath);
 const name=scope.import.names?.[stem]||stem;
 const record={...(existing||{}),id:existing?.id||id,gameId:scope.gameId,engine:'cubism',
  name:existing?.name||name,characterName:existing?.characterName||stem.split('_')[0],costumeName:existing?.costumeName||stem,
  skinCode:generated?id:mapped?.modelStem||scope.import.modelStem||(scope.import.modelStemGroup?match[scope.import.modelStemGroup]:stem)+(scope.import.modelStemSuffix||''),game:scope.name||scope.gameId,collectionName:scope.name||scope.gameId,modelUrl,
  sourceRepo:scope.sourceRepo,sourceCommit:scope.sourceCommit,sourcePath,assetType:'live2d-character',textureBytes,motionCount:motions.length,
  ...(legacy?{modelFormat:'cubism2'}:{modelFormat:'cubism3'}),
  ...(generated?{normalizedSettingsSha256:generated.sha256,normalizationNotes:generated.notes}:{}),
  ...(referenceRepairs.length?{sourceReferenceRepairs:referenceRepairs}:{}),
  ...(discoveredMotions.length?{sourceDiscoveredMotions:discoveredMotions}:{}),
  ...(!existing?{status:'indexed-unverified',playbackStatus:'not-verified',previewSource:'not-rendered'}:{})};
 if(existing&&existing.modelUrl!==modelUrl){
  for(const key of Object.keys(record))if(key.startsWith('preview'))delete record[key];
  Object.assign(record,{status:'indexed-unverified',playbackStatus:'not-verified',previewSource:'not-rendered'});
 }
 return {record,generated};
}
export function sourceRecord(...args){return prepareSourceRecord(...args).record}
const cache=new Map();
export async function mapBounded(items,concurrency,work){
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>12)throw Error('Invalid source concurrency');
 const results=new Array(items.length);let next=0;
 await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{
  while(next<items.length){const index=next++;results[index]=await work(items[index],index)}
 }));
 return results;
}
async function api(url){
 if(!cache.has(url))cache.set(url,(async()=>{
  const headers={Accept:'application/vnd.github+json'};
  if(process.env.GH_TOKEN)headers.Authorization='Bearer '+process.env.GH_TOKEN;
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('GitHub '+response.status+' '+url);
  return response.json();
 })());
 return cache.get(url);
}
async function scopedTree(scope){
 if(!/^[\w.-]+\/[\w.-]+$/.test(scope.sourceRepo)||!/^([a-f0-9]{40})$/.test(scope.sourceCommit)||scope.directory.split('/').includes('..'))throw Error('Invalid pinned scope '+scope.id);
 const base='https://api.github.com/repos/'+scope.sourceRepo+'/git/';
 let data=await api(base+'trees/'+scope.sourceCommit);
 for(const segment of scope.directory.split('/').filter(Boolean)){
  const next=data.tree.find(x=>x.type==='tree'&&x.path===segment);
  if(!next)throw Error('Source directory missing: '+scope.directory);
  data=await api(base+'trees/'+next.sha);
 }
 const all=await api(base+'trees/'+data.sha+'?recursive=1');
 if(all.truncated)throw Error('Truncated source tree; cannot certify coverage: '+scope.id);
 return all.tree;
}
async function settingsBlob(scope,entry){
 const sourcePath=(scope.directory?scope.directory+'/':'')+entry.path;
 const url='https://raw.githubusercontent.com/'+scope.sourceRepo+'/'+scope.sourceCommit+'/'+sourcePath.split('/').map(encodeURIComponent).join('/');
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Model settings HTTP '+response.status+' '+sourcePath);
 const bytes=Buffer.from(await response.arrayBuffer());
 const hash=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(hash!==entry.sha)throw Error('Model settings Git blob mismatch: '+sourcePath);
 const encoded=scope.import?.encoding==='shift_jis';
 const text=encoded?new TextDecoder('shift_jis',{fatal:true}).decode(bytes):bytes.toString('utf8');
 return parseSourceSettings(text,!!scope.import?.allowJSONC,!!scope.import?.repairLegacyMotionCommas);
}
export async function main(args=process.argv.slice(2)){
 const config=read('data/live2d-source-scopes.json'),records=readCharacters(),report=[];
 const selected=args.includes('--scope')?args[args.indexOf('--scope')+1]:null;
 const importId=args.includes('--import')?args[args.indexOf('--import')+1]:null;
 const output=args.includes('--output')?args[args.indexOf('--output')+1]:path.join(os.tmpdir(),'live2d-source-coverage.json');
 let failed=false;
 for(const scope of config.scopes.filter(s=>!selected||s.id===selected)){
  if(args.includes('--whole-directory'))delete scope.selection;
  if(args.includes('--whole-directory')&&args.includes('--inventory-only')&&scope.import)delete scope.import.pathMappings;
  const entry={id:scope.id};report.push(entry);
  try{
   if(scope.import?.namesFile){
    if(!/^data\/[a-z0-9-]+\.json$/.test(scope.import.namesFile))throw Error('Invalid name mapping path');
    const mapping=read(scope.import.namesFile);
    scope.import.names={...Object.fromEntries(Object.entries(mapping).map(([key,value])=>[key,value.title?value.character+' · '+value.title:value.character])),...scope.import.names};
   }
   let tree;
   if(args.includes('--source-tree')){
    if(!selected||!scope.sourceTreeSha)throw Error('A pinned source-tree snapshot requires one declared scope');
    const snapshot=JSON.parse(fs.readFileSync(args[args.indexOf('--source-tree')+1],'utf8'));
    if(snapshot.sha!==scope.sourceTreeSha||snapshot.truncated||!Array.isArray(snapshot.tree))throw Error('Source-tree snapshot mismatch');
    tree=snapshot.tree;
   }else tree=await scopedTree(scope);
   Object.assign(entry,inspectScope(scope,tree,records));
   if(scope.import&&!args.includes('--inventory-only')){
    const incoming=[];
    entry.failedModels=[];
    const outcomes=await mapBounded(sourceSettings(scope,tree),6,async file=>{
     const sourcePath=(scope.directory?scope.directory+'/':'')+file.path;
     const existing=records.find(c=>c.sourceRepo===scope.sourceRepo&&c.sourceCommit===scope.sourceCommit&&c.sourcePath===sourcePath);
     try{
      const settings=await settingsBlob(scope,file);
      return prepareSourceRecord(scope,file.path,settings,tree,existing);
     }catch(error){
      return {failure:{path:sourcePath,error:error.message}};
     }
    });
    for(const outcome of outcomes){
     if(outcome.record)incoming.push(outcome.record);
     else{entry.failedModels.push(outcome.failure);if(scope.requireComplete||importId===scope.id)failed=true}
    }
    entry.checkedModels=incoming.length;entry.wouldAdd=incoming.filter(c=>!records.some(x=>x.id===c.id)).map(c=>c.id);
    if(importId===scope.id){
     if(!args.includes('--dry-run'))for(const outcome of outcomes)if(outcome.generated){
      const destination=new URL(outcome.generated.path,root);fs.mkdirSync(new URL('./',destination),{recursive:true});fs.writeFileSync(destination,outcome.generated.body);
     }
     const catalog=read(scope.catalog);
     const byPath=new Map(incoming.map(c=>[c.sourcePath,c]));
     catalog.characters=catalog.characters.map(c=>byPath.has(c.sourcePath)?byPath.get(c.sourcePath):c);
     for(const c of incoming)if(!catalog.characters.some(x=>x.id===c.id))catalog.characters.push(c);
     catalog.sources=(catalog.sources||[]).map(source=>{
      if(source.gameId!==scope.gameId)return source;
      const total=catalog.characters.filter(c=>c.gameId===scope.gameId&&c.sourceRepo===scope.sourceRepo&&c.sourceCommit===scope.sourceCommit).length;
      const updated={...source,sourceFolder:scope.directory,selection:'Imported matching settings across declared scopes; whole-source coverage and browser evidence are tracked separately',indexed:total,fileChecked:total};
      delete updated.playbackVerified;return updated;
     });
     if(!args.includes('--dry-run'))fs.writeFileSync(new URL(scope.catalog,root),JSON.stringify(catalog,null,2)+'\n');
     Object.assign(entry,inspectScope(scope,tree,catalog.characters));
    }
   }
   if(scope.requireComplete&&!entry.scopeComplete)failed=true;
  }catch(error){entry.error=error.message;failed=true}
  console.log('LIVE2D_SOURCE_SCOPE '+JSON.stringify({...entry,unindexedSourceSettings:entry.unindexedSourceSettings?.length,indexedMissingFromScope:entry.indexedMissingFromScope?.length}));
 }
 if(!report.length||importId&&!config.scopes.some(x=>x.id===importId&&x.import))throw Error('Unknown or non-importable source scope');
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({schemaVersion:1,scopes:report},null,2)+'\n');
 if(failed)process.exitCode=1;
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
