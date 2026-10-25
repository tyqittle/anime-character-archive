// Complete hosted-source imports. Asset bytes are locked by SHA-256 because
// these primary hosts do not publish their game assets in an immutable Git tree.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {readCharacters,mergeCatalogRecords} from './catalog_registry.mjs';
const {coalesceAtlasPages}=createRequire(import.meta.url)('../assets/js/shared/spine-atlas-coordinates.js');
const ROOT=new URL('../',import.meta.url),CACHE=new URL('../tmp/hosted-spine/',import.meta.url);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(new URL(p,ROOT),'utf8'));
async function write(p,value){
 const target=new URL(p,ROOT),temporary=new URL(target.href+'.tmp');
 fs.mkdirSync(new URL('./',target),{recursive:true});fs.writeFileSync(temporary,JSON.stringify(value,null,2)+'\n');
 // Windows readers can briefly retain a non-delete-sharing handle. Keep the
 // previous catalog intact and retry its atomic replacement for a bounded time.
 for(let attempt=0;;attempt++)try{fs.renameSync(temporary,target);return}catch(error){
  if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=7)throw error;
  await new Promise(resolve=>setTimeout(resolve,50*(attempt+1)));
 }
}
export function assetURL(scope,relative){
 const url=new URL(relative,scope.assetBase),base=new URL(scope.assetBase);
 if(url.origin!==base.origin||!url.pathname.startsWith(scope.assetPrefix)||url.username||url.password||url.search||url.hash||/%2f|%5c|%2e/i.test(url.pathname))throw Error('Asset escapes declared source: '+relative);
 return url.href;
}
export function atlasPages(text){
 const pages=[...new Set(text.replace(/^\uFEFF/,'').split(/\r\n|\r|\n/).map(x=>x.trim()).filter(x=>/\.(?:png|webp|jpe?g)$/i.test(x)&&!x.includes(':')))];
 if(!pages.length||pages.some(x=>path.posix.basename(x)!==x||x.includes('\\')||x==='..'))throw Error('Invalid atlas pages');
 return pages;
}
export function leaderGroups(groups){
 return Object.fromEntries(Object.entries(groups).map(([group,ids])=>[group,[...new Set(ids.map(id=>{
  if(!/^\d+$/.test(id))throw Error('Invalid leader ID');return id.replace(/^0+(?=\d)/,'');
 }))]]));
}
export function attachmentPathRepairs(bytes,atlas){
 const d=JSON.parse(bytes.toString('utf8')),pages=new Set(atlasPages(atlas)),regions=new Map(),repairs=[];
 for(const line of atlas.split(/\r+\n|\r|\n/).map(x=>x.trim()).filter(x=>x&&!x.includes(':')&&!pages.has(x)))regions.set(line,(regions.get(line)||0)+1);
 for(const skin of d.skins||[])for(const [slot,items] of Object.entries(skin.attachments||{}))for(const [name,a] of Object.entries(items)){
  const from=a.path||name,to=from.trim();
  if(from!==to&&!regions.has(from)&&regions.get(to)===1)repairs.push({skin:skin.name,slot,name,from,to});
 }
 return repairs;
}
export function candidates(scope,metadata){
 if(scope.adapter==='spine-portrait-tree'){
  if(metadata.truncated||metadata.sha!==scope.treeSha||!Array.isArray(metadata.tree))throw Error('Incomplete or unpinned source tree');
  const files=new Map(metadata.tree.filter(x=>x.type==='blob').map(x=>[x.path,x]));
  const atlases=[...files.keys()].filter(p=>p.startsWith(scope.directory)&&p.endsWith('.atlas.bytes'));
  for(const atlas of atlases.filter(p=>/_B\.atlas\.bytes$/i.test(p)))if(!files.has(atlas.replace(/_B\.atlas\.bytes$/i,'_F.atlas.bytes')))throw Error('Orphan source back layer: '+atlas);
  for(const skeleton of [...files.keys()].filter(p=>p.startsWith(scope.directory)&&p.endsWith('.bytes')&&!p.endsWith('.atlas.bytes'))){
   const atlas=skeleton.replace(/(?:\.skel)?\.bytes$/,'.atlas.bytes');if(!files.has(atlas))throw Error('Source skeleton lacks atlas: '+skeleton);
  }
  const model=atlas=>{
   const stem=atlas.slice(0,-'.atlas.bytes'.length),skeleton=[stem+'.skel.bytes',stem+'.bytes'].filter(p=>files.has(p));
   if(skeleton.length!==1)throw Error('Missing or ambiguous source skeleton: '+atlas);
   return {skeleton:assetURL(scope,skeleton[0]),atlas:assetURL(scope,atlas)};
  };
  return atlases.filter(a=>!/_B\.atlas\.bytes$/i.test(a)).map(atlas=>{
   const folder=atlas.slice(scope.directory.length).split('/')[0],base=atlas.slice(0,-'.atlas.bytes'.length),name=scope.names?.[folder];
   const backPath=/_F$/i.test(base)?base.slice(0,-2)+'_B.atlas.bytes':null;
   const back=backPath&&files.has(backPath)?backPath:null;
   if(scope.compositeFolders?.includes(folder)&&!back)throw Error('Missing declared source back layer: '+atlas);
   const siblings=atlases.filter(p=>p.startsWith(scope.directory+folder+'/')&&!/_B\.atlas\.bytes$/i.test(p));
   const suffix=siblings.length>1?'-'+base.split('/').pop():'';
   return {key:folder+suffix,name:name?.title||folder.replace(/_/g,' '),character:name?.character||folder.split('_')[0],costume:name?.variant||folder,
    category:name?.category||'NPC',tags:[],...model(atlas),companions:back?[model(back)]:[]};
  });
 }
 if(scope.adapter==='epicseven-units'){
  if(!Array.isArray(metadata)||!metadata.length)throw Error('Empty unit metadata');
  return metadata.filter(u=>scope.includedKinds.includes(u.kind)).flatMap(u=>(u.spine||[]).map((s,i)=>({
   key:u.id+(i?'-'+i:''),name:u.hero_name||u.name||u.id,character:u.hero_name||u.name||u.base_id||u.id,
   costume:u.variant?(u.name||u.variant):'',category:u.kind,skeleton:assetURL(scope,s.json),atlas:assetURL(scope,s.atlas),tags:[u.attribute,u.role].filter(Boolean)
  })));
 }
 if(scope.adapter==='shadowverse-leaders'){
  if(!metadata.groups||!Object.keys(metadata.groups).length)throw Error('Empty leader metadata');
  const groups=leaderGroups(metadata.groups),ids=[...new Set(Object.values(groups).flat())].sort();
  return ids.map(id=>{
   if(!/^\d+$/.test(id))throw Error('Invalid leader ID');
   const detail=metadata.leaders[id];
   return {key:'class_'+id,name:detail?.name?.en||detail?.name?.jp||'主战者 '+id,character:detail?.name?.en||detail?.name?.jp||id,
    costume:'',category:Object.entries(groups).filter(([,list])=>list.includes(id)).map(([group])=>group).join(' / '),
    skeleton:assetURL(scope,'assets/anim/class_'+id+'.json'),atlas:assetURL(scope,'assets/anim/class_'+id+'.atlas'),tags:[]};
  });
 }
 throw Error('Unknown hosted-source adapter');
}
export function defaultSourceSkinLayers(d,adapter){
 if(adapter==='shadowverse-leaders'){
  const skins=d.skins||[],base=skins.find(s=>s.name==='default');
  const refs=Object.entries(d.animations?.idle?.slots||{}).flatMap(([slot,t])=>(t.attachment||[]).filter(k=>k.name).map(k=>[slot,k.name]));
  if(refs.some(([slot,name])=>!base?.attachments?.[slot]?.[name])){
   const neutral=skins.find(s=>s.name==='skin_01');
   if(!neutral||refs.some(([slot,name])=>!neutral.attachments?.[slot]?.[name]&&!base?.attachments?.[slot]?.[name]))throw Error('Unresolved neutral face attachments');
   return ['default','skin_01'];
  }
  return [];
 }
 if(adapter!=='epicseven-units')return [];
 // The primary viewer composes body + neutral blink face. Expression faces
 // are mutually exclusive with neutral; piling every skin together doubles eyes.
 const skins=new Map((Array.isArray(d.skins)?d.skins:[]).map(s=>[s.name,s.attachments||{}]));
 const expressions=['smile','angry','panic','sad','special'];
 const face=name=>Object.keys(skins.get(name)||{}).some(slot=>/^(?:[a-z]+\/)?(?:face|head|eye|mouth|lip|brow|eyebrow|nose|cheek)(?:[A-Z\d]|[_/]\w+)?$|^normal(?:\d+|c)$/i.test(slot));
 const needsExpression=!face('default')&&!face('normal')&&expressions.some(face);
 let selected=needsExpression?expressions.find(name=>Object.keys(skins.get(name)||{}).length):null;
 selected||=skins.has('normal')?'normal':skins.has('default')?'default':skins.keys().next().value;
 return [...new Set([skins.has('default')?'default':null,selected].filter(Boolean))];
}
export function inspectSkeleton(bytes,adapter,{runtime,atlasText}={}){
 if(!bytes.toString('utf8',0,8).replace(/^\uFEFF/,'').trimStart().startsWith('{')){
  if(!runtime||!atlasText)throw Error('Binary source requires a pinned inspection runtime');
  const atlas=new runtime.TextureAtlas(atlasText);
  for(const page of atlas.pages)page.setTexture(new runtime.FakeTexture({width:page.width,height:page.height}));
  const d=new runtime.SkeletonBinary(new runtime.AtlasAttachmentLoader(atlas)).readSkeletonData(new Uint8Array(bytes));
  if(!/^4\.1\./.test(d.version)||!d.bones.length)throw Error('Unsupported binary source: '+d.version);
  const animations=d.animations.filter(a=>a.duration>0).map(a=>a.name);
  if(!animations.length){const e=Error('No timed animation in source export');e.code='STATIC_SOURCE';throw e}
  return {version:d.version,animations,bones:d.bones.length,boneNames:d.bones.map(b=>b.name),skins:d.skins.map(s=>s.name),skinLayers:[],excludeBones:[],format:'skel'};
 }
 const d=JSON.parse(bytes.toString('utf8')),version=String(d.skeleton?.spine||'');
 if(!/^(?:3\.8|4\.[012])\./.test(version)||!Array.isArray(d.bones)||!d.bones.length)throw Error('Unsupported or incomplete Spine skeleton: '+version);
 function timed(value){if(!value||typeof value!=='object')return false;if(Number(value.time)>0)return true;return Object.values(value).some(timed)}
 const animations=Object.entries(d.animations||{}).filter(([,value])=>timed(value)).map(([name])=>name);
 if(!animations.length){const e=Error('No timed animation in source export');e.code='STATIC_SOURCE';throw e}
 // Source effect branches parked far outside the actor are still rendered.
 // They are excluded only from portrait framing, so full combat/emote staging
 // cannot shrink the character to accommodate an offstage effects workspace.
 const excludeBones=adapter==='shadowverse-leaders'?d.bones.filter(b=>/effect|(?:^|_)ef(?:_|$)|plane_/i.test(b.name)&&Math.max(Math.abs(b.x||0),Math.abs(b.y||0))>2000).map(b=>b.name):[];
 return {version,animations,bones:d.bones.length,boneNames:d.bones.map(b=>b.name),skins:(d.skins||[]).map(s=>s.name),skinLayers:defaultSourceSkinLayers(d,adapter),excludeBones,format:'json'};
}
async function bounded(items,concurrency,fn){let cursor=0;const results=new Array(items.length);await Promise.all(Array.from({length:Math.min(items.length,concurrency)},async()=>{while(cursor<items.length){const i=cursor++;results[i]=await fn(items[i],i)}}));return results}
export async function main(args=process.argv.slice(2)){
 const config=read('data/hosted-spine-source-scopes.json');
 const updates=[];for(let i=0;i<args.length;i++)if(args[i]==='--update-existing'){if(!/^[a-zA-Z0-9_-]+$/.test(args[i+1]||''))throw Error('Invalid explicit update ID');updates.push(args[++i])}
 const selected=args.includes('--scope')?args[args.indexOf('--scope')+1]:null,refresh=args.includes('--refresh')||args.includes('--refresh-metadata'),refreshAssets=args.includes('--refresh-assets');
 const scopes=config.scopes.filter(s=>!selected||s.id===selected);if(!scopes.length)throw Error('Unknown hosted source scope');
 fs.mkdirSync(new URL('cache/',CACHE),{recursive:true});
 const indexPath=new URL('index.json',CACHE),index=fs.existsSync(indexPath)?JSON.parse(fs.readFileSync(indexPath,'utf8')):{schemaVersion:1,assets:{}};
 const active=new Map();let fetched=0;
 function saveIndex(){fs.writeFileSync(new URL('index.json.tmp',CACHE),JSON.stringify(index));fs.renameSync(new URL('index.json.tmp',CACHE),indexPath)}
 async function fetchBytes(url,{fresh=false,timeoutMs=30000}={}){
  const existing=index.assets[url];
  if(!fresh&&existing){const file=new URL(existing.file,CACHE);if(fs.existsSync(file)){const bytes=fs.readFileSync(file);if(digest(bytes)===existing.sha256)return bytes}}
  if(active.has(url))return active.get(url);
  const promise=(async()=>{
   let last;for(let attempt=0;attempt<3;attempt++)try{
    const response=await fetch(url,{signal:AbortSignal.timeout(timeoutMs)});if(!response.ok){const e=Error('HTTP '+response.status+' '+url);e.status=response.status;throw e}
    const parts=[];let size=0;for await(const part of response.body){size+=part.length;if(size>48*1024*1024)throw Error('Source byte budget exceeded');parts.push(part)}
    const bytes=Buffer.concat(parts),sha256=digest(bytes),file='cache/'+sha256;fs.writeFileSync(new URL(file,CACHE),bytes);
    index.assets[url]={file,sha256,bytes:size};if(++fetched%25===0)saveIndex();return bytes;
   }catch(error){last=error;if(error.status===404||attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)))}throw last;
  })();active.set(url,promise);try{return await promise}finally{active.delete(url)}
 }
 const allReports=[];
 for(const scope of scopes){
  const previousPath='data/hosted-spine-source-audit-'+scope.id+'.json';
  const oldAudit=fs.existsSync(new URL(previousPath,ROOT))?read(previousPath):null;
  let metadata,snapshotPath,snapshotSha256;
  if(!refresh&&oldAudit){snapshotPath=oldAudit.metadataSnapshot;snapshotSha256=oldAudit.metadataSha256;const bytes=fs.readFileSync(new URL(snapshotPath,ROOT));if(digest(bytes)!==snapshotSha256)throw Error('Metadata snapshot changed');metadata=JSON.parse(bytes)}
  else{
   let raw=await fetchBytes(scope.metadataUrl,{fresh:refresh});
   metadata=JSON.parse(raw);
   if(typeof metadata==='string')metadata=JSON.parse(metadata);
   if(scope.adapter==='shadowverse-leaders'){
    const groups=leaderGroups(metadata),leaders={},unavailable=[];
    const ids=[...new Set(Object.values(groups).flat())];
    await bounded(ids,6,async id=>{if(!/^\d+$/.test(id))throw Error('Invalid leader ID');try{let d=JSON.parse(await fetchBytes(scope.detailBase+id));if(typeof d==='string')d=JSON.parse(d);leaders[id]=d}catch(e){if(e.status===404)unavailable.push(id);else throw e}});
    metadata={groups,leaders,unavailable:unavailable.sort()};
   }
   const bytes=Buffer.from(JSON.stringify(metadata,null,2)+'\n');snapshotSha256=digest(bytes);snapshotPath='data/source-snapshots/'+scope.id+'-'+snapshotSha256.slice(0,16)+'.json';
   fs.mkdirSync(new URL('data/source-snapshots/',ROOT),{recursive:true});fs.writeFileSync(new URL(snapshotPath,ROOT),bytes);
  }
  const discovered=candidates(scope,metadata);if(!discovered.length||new Set(discovered.map(x=>x.key)).size!==discovered.length)throw Error('Empty or duplicated source identities');
  const excluded=discovered.filter(c=>scope.excludedPortraits?.[c.key]).map(c=>({key:c.key,reason:scope.excludedPortraits[c.key]}));
  const source=discovered.filter(c=>!scope.excludedPortraits?.[c.key]);
  if(!source.length)throw Error('Empty declared portrait scope');
  const sourceFiles=scope.adapter==='spine-portrait-tree'?new Map(metadata.tree.filter(x=>x.type==='blob'&&x.path.startsWith(scope.directory)).map(x=>[assetURL(scope,x.path),x])):null;
  async function sourceBytes(url,options){
   const bytes=await fetchBytes(url,options);
   if(sourceFiles){const file=sourceFiles.get(url),sha=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');if(!file||file.sha!==sha||file.size!==bytes.length)throw Error('Pinned source Git blob mismatch: '+url)}
   return bytes;
  }
  let runtime;
  if(scope.inspectionRuntime){
   const bytes=await fetchBytes(scope.inspectionRuntime.url);
   if(digest(bytes)!==scope.inspectionRuntime.sha256)throw Error('Inspection runtime bytes changed');
   const context=vm.createContext({console,Uint8Array,Uint16Array,Int16Array,Uint32Array,Float32Array,TextDecoder});
   vm.runInContext(bytes.toString('utf8'),context,{timeout:10000});runtime=context.spine;
  }
  console.log('HOSTED_SOURCE_START',scope.id,source.length);
  let completed=0;
  const concurrency=scope.concurrency||5,timeoutMs=scope.assetTimeoutMs||30000;
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8||!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000)throw Error('Invalid source transfer limits');
  async function importModel(candidate){
    if(!/^[a-zA-Z0-9_-]+$/.test(candidate.key))throw Error('Invalid character identity');
    const [skeleton,atlas]=await Promise.all([sourceBytes(candidate.skeleton,{fresh:refreshAssets,timeoutMs}),sourceBytes(candidate.atlas,{fresh:refreshAssets,timeoutMs})]);
    const atlasText=atlas.toString('utf8'),inspected=inspectSkeleton(skeleton,scope.adapter,{runtime,atlasText}),pages=atlasPages(atlasText),coalesced=coalesceAtlasPages(atlasText),pathRepairs=inspected.format==='json'?attachmentPathRepairs(skeleton,coalesced.text):[];
    const extraBones=scope.portraitFramingOverrides?.[candidate.key]?.excludeBones||[];
    const sourceBones=new Set(inspected.boneNames);
    if(extraBones.some(name=>!sourceBones.has(name)))throw Error('Declared framing bone absent from source');
    const excludeBones=[...new Set([...inspected.excludeBones,...extraBones])];
    const skName=decodeURIComponent(new URL(candidate.skeleton).pathname.split('/').pop()),atlasName=decodeURIComponent(new URL(candidate.atlas).pathname.split('/').pop());
    const resources=[{path:skName,sha256:digest(skeleton)},{path:atlasName,sha256:digest(atlas)}],textures=[];
    for(const page of pages){const url=assetURL(scope,new URL(page,candidate.atlas).href),bytes=await sourceBytes(url,{fresh:refreshAssets,timeoutMs});
     if(bytes.length<32||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Texture is not PNG: '+page);
     const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(Math.min(width,height)<64||Math.max(width,height)>16384)throw Error('Texture dimensions outside source budget');
     resources.push({path:page,sha256:digest(bytes)});textures.push({path:page,url,bytes:bytes.length,width,height});
    }
    const stem=skName.replace(/\.(?:json|skel)(?:\.bytes)?$|\.bytes$/i,''),id=scope.idPrefix+candidate.key;
    const idle=scope.adapter==='spine-portrait-tree'?(inspected.animations.find(a=>/^idle_stand$/i.test(a))||inspected.animations.find(a=>/idle|stand/i.test(a))):undefined;
    const sourceSkin=scope.defaultSkins?.[candidate.key]||candidate.skin;
    if(sourceSkin&&!inspected.skins.includes(sourceSkin))throw Error('Source default skin absent');
    const declaredLayers=scope.adapter==='spine-portrait-tree'?[...new Set([inspected.skins.includes('default')?'default':inspected.skins[0],sourceSkin].filter(Boolean))]:sourceSkin?[sourceSkin]:inspected.skinLayers.length>1?inspected.skinLayers:undefined;
    return {id,gameId:scope.gameId,game:scope.name,collectionName:scope.name,engine:'spine',
     name:candidate.name+(candidate.costume?' · '+candidate.costume:''),characterName:candidate.character,costumeName:candidate.costume||candidate.category,skinCode:candidate.key,
     sourceCategory:candidate.category,tags:candidate.tags,assetType:'character-spine',spineVersion:inspected.version.split('.').slice(0,2).join('.'),sourceVersion:inspected.version,
     skeletonFormat:inspected.format,resourceStem:stem,base:candidate.skeleton.replace(/\.(?:json|skel)(?:\.bytes)?$|\.bytes$/i,''),skeletonUrl:candidate.skeleton,atlasUrl:candidate.atlas,
     atlasCoordinateSpace:inspected.version.startsWith('3.8.')?'declared':undefined,resourceIntegrity:resources.sort((a,b)=>a.path.localeCompare(b.path,'en')),
     spineSkinLayers:declaredLayers,
     spineIdleAnimation:idle,
     portraitFraming:excludeBones.length?{excludeBones}:undefined,
     downloadPolicy:scope.downloadPolicy,
     spineAttachmentPathRepairs:pathRepairs.length?pathRepairs:undefined,
     spineAtlasPageMerge:coalesced.mergedPages?true:undefined,
     premultipliedAlpha:scope.premultipliedAlpha,
     sourceUrl:scope.attribution,sourceMetadataSnapshot:snapshotPath,sourceMetadataSha256:snapshotSha256,sourcePath:new URL(candidate.skeleton).pathname,
     sourceRepo:scope.sourceRepo,sourceCommit:scope.sourceCommit,sourceSkins:inspected.skins,
     skeletonBytes:skeleton.length,atlasBytes:atlas.length,textures,motionCount:inspected.animations.length,sourceAnimations:inspected.animations,
     status:'indexed-unverified',playbackStatus:'not-verified',previewSource:'not-rendered'};
  }
  const results=await bounded(source,concurrency,async candidate=>{
   try{
    const record=await importModel(candidate);
    if(candidate.companions?.length){
     record.spineCompanions=[];
     for(const part of candidate.companions){const companion=await importModel({...candidate,...part,companions:[]});
      const {id,gameId,game,collectionName,name,characterName,costumeName,skinCode,sourceCategory,tags,status,playbackStatus,previewSource,...component}=companion;
      if(component.spineVersion!==record.spineVersion)throw Error('Source layers use different engine versions');
      record.spineCompanions.push(component);
     }
    }
    return {record};
   }catch(error){return {failure:{key:candidate.key,skeleton:candidate.skeleton,error:error.message,category:error.code==='STATIC_SOURCE'?'static-source':error.status===404?'source-unavailable':'source-error'}}}
   finally{if(++completed%25===0)console.log('HOSTED_SOURCE_CHECKED',scope.id,completed+'/'+source.length)}
  });
  saveIndex();
  // Re-read both the destination and registry after the slow source scan.
  const catalogPath=scope.catalog||config.catalog;
  const catalog=fs.existsSync(new URL(catalogPath,ROOT))?read(catalogPath):{schemaVersion:1,notes:'Complete source-scoped dynamic portraits, including all published skins. Assets locked by SHA-256; not a claim of current-game completeness.',characters:[]};
  const records=results.filter(x=>x.record).map(x=>x.record),rejected=results.filter(x=>x.failure).map(x=>x.failure);
  const staticSources=rejected.filter(x=>x.category==='static-source'),failed=rejected.filter(x=>x.category!=='static-source');
  const registered=readCharacters();
  catalog.characters=mergeCatalogRecords(catalog.characters,records,{registered,updateExisting:updates});await write(catalogPath,catalog);
  const report={schemaVersion:1,scope:scope.id,gameId:scope.gameId,source:scope.attribution,scopeDescription:scope.scopeDescription,
   metadataSnapshot:snapshotPath,metadataSha256:snapshotSha256,discovered:discovered.length,indexed:records.length,staticSources,failures:failed,
   ...(excluded.length?{scopeExcluded:excluded,declaredPortraitScopeComplete:failed.length===0}:{}),
   sourceScopeComplete:failed.length===0&&excluded.length===0,gameCompleteness:'not-verified',acceptedModelAssetCount:records.reduce((n,c)=>n+2+c.textures.length+(c.spineCompanions||[]).reduce((sum,p)=>sum+2+p.textures.length,0),0)};
  await write(previousPath,report);allReports.push(report);saveIndex();
  console.log('HOSTED_SOURCE_RESULT',JSON.stringify({scope:scope.id,discovered:source.length,indexed:records.length,failed:failed.length,categories:failed.reduce((a,x)=>{a[x.category]=(a[x.category]||0)+1;return a},{})}));
 }
 return allReports;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error);process.exitCode=1});
