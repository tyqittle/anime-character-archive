// Read-only coverage for every registered source scope; explicit imports reuse
// the same file-reference checks and preserve existing model IDs and previews.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {readCharacters} from './catalog_registry.mjs';
const root=new URL('../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
export function sourceSettings(scope,tree){
 const selected=scope.selection?new RegExp(scope.selection):null;
 return tree.filter(x=>x.type==='blob'&&/(?:^|\/)model(?:3)?\.json$|\.model(?:3)?\.json$/i.test(x.path)&&(!selected||selected.test('/'+x.path)));
}
export function inspectScope(scope,tree,records){
 const prefix=scope.directory?scope.directory+'/':'';
 const source=sourceSettings(scope,tree),found=new Set(source.map(x=>prefix+x.path));
 const indexed=records.filter(c=>c.gameId===scope.gameId&&c.sourceRepo===scope.sourceRepo&&c.sourceCommit===scope.sourceCommit&&c.sourcePath?.startsWith(prefix));
 const known=new Set(indexed.map(c=>c.sourcePath));
 const missing=source.filter(x=>!known.has(prefix+x.path)).map(x=>({path:prefix+x.path,format:x.path.endsWith('.model3.json')?'cubism3':'cubism2'}));
 return {id:scope.id,gameId:scope.gameId,sourceRepo:scope.sourceRepo,sourceCommit:scope.sourceCommit,directory:scope.directory,
  sourceModelSettings:source.length,indexedModelSettings:indexed.length,
  unindexedSourceSettings:missing,indexedMissingFromScope:indexed.filter(c=>!found.has(c.sourcePath)).map(c=>({id:c.id,path:c.sourcePath})),
  scopeComplete:source.length>0&&missing.length===0&&indexed.every(c=>found.has(c.sourcePath)),requireComplete:!!scope.requireComplete};
}
export function sourceRecord(scope,relative,settings,tree,existing){
 if(!scope.import)throw Error('No identity adapter configured for '+scope.id);
 const match=relative.match(new RegExp(scope.import.pattern));
 if(!match||!match[1])throw Error('Model path is outside the identity rule: '+relative);
 const stem=match[1],refs=settings.FileReferences;
 if(settings.Version!==3||!refs?.Moc||!Array.isArray(refs.Textures)||!refs.Textures.length)throw Error('Incomplete Cubism3 settings: '+relative);
 const files=new Map(tree.filter(x=>x.type==='blob').map(x=>[x.path,x]));
 function resolve(ref){
  if(typeof ref!=='string'||!ref||/^[a-z]+:|^[/\\]/i.test(ref))throw Error('Invalid source reference: '+ref);
  const result=path.posix.normalize(path.posix.join(path.posix.dirname(relative),ref.replaceAll('\\','/')));
  if(result==='..'||result.startsWith('../'))throw Error('Source reference escapes scope: '+ref);
  if(!(files.get(result)?.size>0))throw Error('Missing or empty source file: '+result);
  return result;
 }
 const motions=Object.values(refs.Motions||{}).flat();
 for(const file of [refs.Moc,...refs.Textures,refs.Physics,refs.Pose,...(refs.Expressions||[]).map(x=>x.File),...motions.map(x=>x.File)].filter(Boolean))resolve(file);
 const textureBytes=refs.Textures.reduce((n,x)=>n+files.get(resolve(x)).size,0);
 if(textureBytes<(scope.import.minimumTextureBytes||1))throw Error('Texture size below declared source policy: '+relative);
 const sourcePath=(scope.directory?scope.directory+'/':'')+relative;
 const modelUrl='https://cdn.jsdelivr.net/gh/'+scope.sourceRepo+'@'+scope.sourceCommit+'/'+sourcePath.split('/').map(encodeURIComponent).join('/');
 if(existing&&(existing.id!==scope.import.idPrefix+stem||existing.modelUrl!==modelUrl))throw Error('Existing model identity differs: '+sourcePath);
 const name=scope.import.names?.[stem]||stem;
 return {...(existing||{}),id:existing?.id||scope.import.idPrefix+stem,gameId:scope.gameId,engine:'cubism',
  name:existing?.name||name,characterName:existing?.characterName||stem.split('_')[0],costumeName:existing?.costumeName||stem,
  skinCode:stem,game:scope.name||scope.gameId,collectionName:scope.name||scope.gameId,modelUrl,
  sourceRepo:scope.sourceRepo,sourceCommit:scope.sourceCommit,sourcePath,assetType:'live2d-character',textureBytes,motionCount:motions.length,
  ...(!existing?{status:'indexed-unverified',playbackStatus:'not-verified',previewSource:'not-rendered'}:{})};
}
const cache=new Map();
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
 const blob=await api('https://api.github.com/repos/'+scope.sourceRepo+'/git/blobs/'+entry.sha);
 return JSON.parse(Buffer.from(blob.content.replace(/\s/g,''),'base64').toString('utf8').replace(/^\uFEFF/,''));
}
export async function main(args=process.argv.slice(2)){
 const config=read('data/live2d-source-scopes.json'),records=readCharacters(),report=[];
 const selected=args.includes('--scope')?args[args.indexOf('--scope')+1]:null;
 const importId=args.includes('--import')?args[args.indexOf('--import')+1]:null;
 const output=args.includes('--output')?args[args.indexOf('--output')+1]:path.join(os.tmpdir(),'live2d-source-coverage.json');
 let failed=false;
 for(const scope of config.scopes.filter(s=>!selected||s.id===selected)){
  const entry={id:scope.id};report.push(entry);
  try{
   const tree=await scopedTree(scope);Object.assign(entry,inspectScope(scope,tree,records));
   if(scope.import){
    const incoming=[];
    for(const file of sourceSettings(scope,tree)){
     const sourcePath=(scope.directory?scope.directory+'/':'')+file.path;
     const existing=records.find(c=>c.sourceRepo===scope.sourceRepo&&c.sourceCommit===scope.sourceCommit&&c.sourcePath===sourcePath);
     const settings=await settingsBlob(scope,file);
     incoming.push(sourceRecord(scope,file.path,settings,tree,existing));
    }
    entry.checkedModels=incoming.length;entry.wouldAdd=incoming.filter(c=>!records.some(x=>x.id===c.id)).map(c=>c.id);
    if(importId===scope.id){
     const catalog=read(scope.catalog);
     const byPath=new Map(incoming.map(c=>[c.sourcePath,c]));
     catalog.characters=catalog.characters.map(c=>byPath.has(c.sourcePath)?byPath.get(c.sourcePath):c);
     for(const c of incoming)if(!catalog.characters.some(x=>x.id===c.id))catalog.characters.push(c);
     catalog.sources=(catalog.sources||[]).map(source=>{
      if(source.gameId!==scope.gameId)return source;
      const updated={...source,sourceFolder:scope.directory,selection:'All matched settings within the pinned source scope; browser evidence is tracked separately',indexed:incoming.length,fileChecked:incoming.length};
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
