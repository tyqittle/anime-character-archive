'use strict';
// Provider failover always addresses the same repository/ref/path.
(function(){
 function variants(value){
  const raw=String(value).match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
  const cdn=String(value).match(/^https:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^/@]+)@([^/]+)\/(.+)$/);
  const match=raw||cdn;
  if(!match)return [String(value)];
  const [,owner,repo,ref,path]=match;
  return [...new Set(['https://raw.githubusercontent.com/'+owner+'/'+repo+'/'+ref+'/'+path,
   'https://cdn.jsdelivr.net/gh/'+owner+'/'+repo+'@'+ref+'/'+path])];
 }
 async function blob(value,timeout=12000,signal){
  const errors=[];
  for(const url of variants(value)){
   if(signal?.aborted)throw Object.assign(Error('下载已取消'),{name:'AbortError'});
   const abort=new AbortController(),cancel=()=>abort.abort();
   signal?.addEventListener('abort',cancel,{once:true});
   const timer=setTimeout(cancel,Math.min(timeout,12000));
   try{
    const response=await fetch(url,{signal:abort.signal,cache:'force-cache'});
    if(!response.ok)throw Error('HTTP '+response.status);
    return await response.blob();
   }catch(error){
    if(signal?.aborted)throw Object.assign(Error('下载已取消'),{name:'AbortError'});
    errors.push(new URL(url).hostname+'：'+(error.name==='AbortError'?'12秒超时':error.message));
   }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel)}
  }
  throw Error(errors.join('；'));
 }
 window.ArchiveAssets={variants,blob};
})();
