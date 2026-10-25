'use strict';
function urls(c,mirror){
 // Both skeleton and atlas can be explicitly supplied regardless of format.
 // Some upstream full-size illustrations use different stems for these files.
 if(c.skeletonUrl&&c.atlasUrl&&c.base)
  return {skeleton:c.skeletonUrl,atlas:c.atlasUrl,base:c.base,format:c.skeletonFormat==='json'?'json':'skel'};
 // Explicit JSON skeleton URL enables Spine 3.8 game exports stored as .txt.
 if(c.skeletonFormat==='json'&&c.skeletonUrl&&c.atlasUrl)
  return {skeleton:c.skeletonUrl,atlas:c.atlasUrl,base:c.base,format:'json'};
 if(c.gameId==='bluearchive'||c.gameId==='browndust2')return {skeleton:c.base+'.skel',atlas:c.base+'.atlas',base:c.base,format:'skel'};
 const base=mirror==='legacy'?'https://nikke-db-legacy.pages.dev/l2d/'+c.id+'/'+c.id+'_00':c.base;
 return {skeleton:base+'.skel',atlas:base+'.atlas',base,format:'skel'};
}
async function downloadBlob(url,timeout=24000,externalSignal,providerTimeoutMs){
 return ArchiveAssets.blob(url,timeout,externalSignal,{providerTimeoutMs});
}
function spineDownloadBudget(c){
 const policy=c?.downloadPolicy;
 if(policy===undefined)return {assetMs:60000,totalMs:55000,providerMs:12000};
 if(!Number.isInteger(policy.assetMs)||policy.assetMs<12000||policy.assetMs>90000||!Number.isInteger(policy.totalMs)||policy.totalMs<policy.assetMs+15000||policy.totalMs>150000)throw Error('资源下载时限声明无效');
 return {assetMs:policy.assetMs,totalMs:policy.totalMs,providerMs:policy.assetMs};
}

function imagePages(atlasText){
 return [...new Set(atlasText.replace(/^\uFEFF/,'').split(/\r\n|\r|\n/).map(x=>x.trim())
  .filter(x=>/\.(png|webp|jpg|jpeg)$/i.test(x)&&!x.includes(':')))];
}
// 3.8 stores a length-prefixed hash; 4.x stores an 8-byte hash.
 // Match the actual .skel header rather than the version guessed in the catalog.
async function detectSpineVersion(blob){
 const bytes=new Uint8Array(await blob.slice(0,256).arrayBuffer());
 function readString(start){
  let len=0,shift=0,pos=start,b;
  do{if(pos>=bytes.length||shift>28)throw Error('骨骼头部不完整');b=bytes[pos++];len|=(b&127)<<shift;shift+=7}while(b&128);
  if(!len)return {value:null,end:pos};
  len--;
  if(len>120||pos+len>bytes.length)throw Error('骨骼文件头无效');
  return {value:new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(pos,pos+len)),end:pos+len};
 }
 const candidates=[];
 try{const hash=readString(0),v=readString(hash.end);candidates.push({hash:hash.value,version:v.value})}catch(e){}
 try{const v=readString(8);candidates.push({hash:null,version:v.value})}catch(e){}
 const found=candidates.find(x=>/^\d+\.\d+(?:\.\d+)?/.test(x.version||''));
 const version=found?.version||'';
 if(!/^\d+\.\d+(?:\.\d+)?/.test(version||''))throw Error('无法解析骨骼导出版本（文件头不支持或文件损坏）');
 return {hash:found.hash,version,majorMinor:version.split('.').slice(0,2).join('.')};
}
function sourceFingerprint(c){
 const identity=[2,c.base,c.skeletonUrl||'',c.atlasUrl||'',c.skeletonFormat||'skel'];
 if(c.resourceIntegrity)identity.push(['source-text-normalization:2',ArchiveCatalogRegistry.sourceIdentity(c)]);
 return JSON.stringify(identity);
}
function isCachedPackFor(c,pack){return !!pack?.headerChecked&&pack.sourceFingerprint===sourceFingerprint(c)}
// Optional byte locks for hosts without immutable asset revisions. Existing
// catalogs keep their original cache identity and download behavior.
function packIntegrityVerifier(c){
 if(c.resourceIntegrity===undefined)return async()=>{};
 if(!Array.isArray(c.resourceIntegrity)||!c.resourceIntegrity.length)throw Error('资源摘要清单无效');
 const hashes=new Map();
 for(const item of c.resourceIntegrity){
  if(!item||typeof item.path!=='string'||!item.path||/[\\/]/.test(item.path)||!/^([a-f0-9]{64})$/.test(item.sha256)||hashes.has(item.path))throw Error('资源摘要清单无效');
  hashes.set(item.path,item.sha256);
 }
 return async(blob,name)=>{
  if(!hashes.has(name))throw Error('资源缺少版本摘要：'+name);
  const hash=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
  const actual=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
  if(actual!==hashes.get(name))throw Error('源资源版本已变化，请更新目录：'+name);
 };
}
async function downloadPack(c,mirror,externalSignal,isCurrent=()=>true){
 const request=new AbortController(),forward=()=>request.abort();
 if(externalSignal?.aborted)request.abort();else externalSignal?.addEventListener('abort',forward,{once:true});
 const signal=request.signal;
 try{
 const paths=urls(c,mirror),stem=c.resourceStem||decodeURIComponent(c.base.split('/').pop());
 const budget=spineDownloadBudget(c);
 const verify=packIntegrityVerifier(c),fileName=url=>decodeURIComponent(new URL(url,location.href).pathname.split('/').pop());
 // Start textures after the small atlas arrives, while the skeleton continues downloading.
 const skeletonResult=downloadBlob(paths.skeleton,budget.assetMs,signal,budget.providerMs).then(blob=>({blob}),error=>({error}));
 const atlasBlob=await downloadBlob(paths.atlas,30000,signal,budget.providerMs);
 await verify(atlasBlob,fileName(paths.atlas));
 if(atlasBlob.size<20)throw Error('图集文件大小异常');
 let atlasText=(await atlasBlob.text()).replace(/^\uFEFF/,'').replace(/\r+\n|\r/g,'\n');
 if(c.spineAtlasPageMerge){
  const normalized=ArchiveSpineAtlasCoordinates.coalesceAtlasPages(atlasText);
  if(!normalized.mergedPages)throw Error('源图集页合并声明已过期');
  atlasText=normalized.text;
 }
 const pages=imagePages(atlasText);
 if(!pages.length)throw Error('图集中没有图片文件名');
 const data={};
 data[stem+'.atlas']='data:text/plain,'+atlasText;
 let nextPage=0,completedPages=0;
 async function fetchTexturePages(){
  while(nextPage<pages.length){
   const page=pages[nextPage++],url=paths.base.slice(0,paths.base.lastIndexOf('/')+1)+encodeURIComponent(page);
   const blob=await downloadBlob(url,budget.assetMs,signal,budget.providerMs);
   await verify(blob,page);
   if(blob.size<100)throw Error('贴图为空：'+page);
   data[page]=await blobToUri(blob);
   completedPages++;
   if(isCurrent())status('正在并行加载骨骼与贴图 '+completedPages+'/'+pages.length);
  }
 }
 const texturesPromise=Promise.all(Array.from({length:Math.min(3,pages.length)},()=>fetchTexturePages())).then(()=>({ok:true}),error=>({error}));
 const skeleton=await skeletonResult;
 if(skeleton.error)throw skeleton.error;
 const skelBlob=skeleton.blob;
 await verify(skelBlob,fileName(paths.skeleton));
 if(skelBlob.size<100)throw Error('骨骼文件大小异常');
 const isJSON=paths.format==='json';
 let detected,jsonText='';
 if(isJSON){
  jsonText=await skelBlob.text();
  const parsed=JSON.parse(jsonText),version=String(parsed.skeleton?.spine||'');
  if(c.spineAttachmentPathRepairs){
   const regions=new Set(atlasText.split('\n').map(x=>x.trim()));
   for(const repair of c.spineAttachmentPathRepairs){
    const a=parsed.skins?.find(s=>s.name===repair.skin)?.attachments?.[repair.slot]?.[repair.name];
    if(!a||(a.path||repair.name)!==repair.from||!regions.has(repair.to))throw Error('源附件路径修复已过期：'+repair.name);
    a.path=repair.to;
   }
   jsonText=JSON.stringify(parsed);
  }
  if(!/^\d+\.\d+/.test(version))throw Error('JSON 骨骼缺少有效的 Spine 版本');
  detected={version,majorMinor:version.split('.').slice(0,2).join('.')};
 }else detected=await detectSpineVersion(skelBlob);
 if(!['3.8','4.0','4.1','4.2'].includes(detected.majorMinor))throw Error('不支持的骨骼版本 '+detected.version);
 if(isCurrent())status('骨骼版本 '+detected.version+' 已确认，正在完成贴图加载…');
 const skeletonName=stem+(isJSON?'.json':'.skel');
 data[skeletonName]=isJSON?'data:application/json,'+jsonText:await blobToUri(skelBlob);
 const textures=await texturesPromise;
 if(textures.error)throw textures.error;
 if(signal?.aborted)throw Error('下载已取消');
 return {id:(c.gameId||'nikke')+'-'+c.id,version:detected.majorMinor,exportVersion:detected.version,headerChecked:true,sourceFingerprint:sourceFingerprint(c),skeleton:skeletonName,atlas:stem+'.atlas',rawDataURIs:data};
 }finally{request.abort();externalSignal?.removeEventListener('abort',forward)}
}
function blobToUri(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})}
let sequence=0,activeCharacterAbort=null;
function cancelCharacterDownload(){
 ++sequence;
 pendingRenderCancel?.();pendingRenderCancel=null;
 if(activeCharacterAbort){activeCharacterAbort.abort();activeCharacterAbort=null}
 ++currentAttempt;
 stopWatchdog();
}

