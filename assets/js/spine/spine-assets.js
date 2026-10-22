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
async function downloadBlob(url,timeout=24000,externalSignal){
 const controller=new AbortController(),onAbort=()=>controller.abort();
 if(externalSignal){if(externalSignal.aborted)controller.abort();else externalSignal.addEventListener('abort',onAbort,{once:true})}
 const timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const response=await fetch(url,{signal:controller.signal,cache:'force-cache'});
  if(!response.ok)throw Error('HTTP '+response.status+' '+url.split('/').pop());
  return await response.blob();
 }finally{clearTimeout(timer);externalSignal?.removeEventListener('abort',onAbort)}
}
function imagePages(atlasText){
 return [...new Set(atlasText.replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim())
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
async function downloadPack(c,mirror,externalSignal,isCurrent=()=>true){
 const request=new AbortController(),forward=()=>request.abort();
 if(externalSignal?.aborted)request.abort();else externalSignal?.addEventListener('abort',forward,{once:true});
 const signal=request.signal;
 try{
 const paths=urls(c,mirror),stem=c.resourceStem||decodeURIComponent(c.base.split('/').pop());
 // Start textures after the small atlas arrives, while the skeleton continues downloading.
 const skeletonResult=downloadBlob(paths.skeleton,60000,signal).then(blob=>({blob}),error=>({error}));
 const atlasBlob=await downloadBlob(paths.atlas,30000,signal);
 if(atlasBlob.size<20)throw Error('图集文件大小异常');
 const atlasText=(await atlasBlob.text()).replace(/^\uFEFF/,'');
 const pages=imagePages(atlasText);
 if(!pages.length)throw Error('图集中没有图片文件名');
 const data={};
 data[stem+'.atlas']='data:text/plain,'+atlasText;
 let nextPage=0,completedPages=0;
 async function fetchTexturePages(){
  while(nextPage<pages.length){
   const page=pages[nextPage++],url=paths.base.slice(0,paths.base.lastIndexOf('/')+1)+encodeURIComponent(page);
   const blob=await downloadBlob(url,60000,signal);
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
 if(skelBlob.size<100)throw Error('骨骼文件大小异常');
 const isJSON=paths.format==='json';
 let detected,jsonText='';
 if(isJSON){
  jsonText=await skelBlob.text();
  const parsed=JSON.parse(jsonText),version=String(parsed.skeleton?.spine||'');
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
 return {id:(c.gameId||'nikke')+'-'+c.id,version:detected.majorMinor,exportVersion:detected.version,headerChecked:true,skeleton:skeletonName,atlas:stem+'.atlas',rawDataURIs:data};
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
