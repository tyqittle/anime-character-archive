'use strict';
// Separate source adapter for adult-game catalogs. The common Cubism renderer
// never needs a per-game branch, and arbitrary URLs remain rejected.
(function(root){
 const pinned='https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model@7e446cbd95ec352cdb0f73c079e4d075d7d528ac/';
 const localPrefix='./assets/model-settings/newgames/';
 function resolve(name,url,id){
  if(typeof url!=='string'||typeof id!=='string')return '';
  if(/^r99-[a-z0-9_]+$/.test(id)){
   if(url.startsWith(localPrefix)){
    const local=url.slice(localPrefix.length).match(/^([a-z0-9_-]+)\.model3\.json\?v=([a-f0-9]{64})$/);
    return local&&local[1]===id&&typeof name==='string'&&id==='r99-'+name.toLowerCase()?new URL(url,root.location.href).href:'';
   }
   const source='https://cdn.jsdelivr.net/gh/myssal/Reverse-1999-CN-Asset@45e75248ba3b25053fd32e63ab13c2f9f54dd9df/live2d/roles/';
   if(!url.startsWith(source))return '';
   const match=url.slice(source.length).match(/^([A-Za-z0-9_]+)\/\1\.model3\.json$/);
   return match&&name===match[1]&&id==='r99-'+match[1].toLowerCase()?url:'';
  }
  if(/^ub-c_[0-9]+$/.test(id)){
   if(!url.startsWith(localPrefix)||name!==id)return '';
   const relative=url.slice(localPrefix.length);
   const found=relative.match(/^([a-z0-9_-]+)\.model3\.json\?v=([a-f0-9]{64})$/);
   return found&&found[1]===id?new URL(url,root.location.href).href:'';
  }
  if(/^(?:rs|kg|kg2)-[a-z0-9_]+$/.test(id)||/^ss-char2d_live2d_[0-9]+$/.test(id)){
   if(!url.startsWith(localPrefix)||name!==id)return '';
   const relative=url.slice(localPrefix.length);
   const m=relative.match(/^([a-z0-9_-]+)\.model\.json\?v=([a-f0-9]{64})$/);
   return m&&m[1]===id?new URL(url,root.location.href).href:'';
  }
  if(/^kg3-s_[a-z0-9]+$/.test(id)){
   if(!url.startsWith(pinned))return '';
   try{
    const relative=decodeURIComponent(url.slice(pinned.length));
    if(relative.includes('..'))return '';
    const m=relative.match(/^galgame live2d\/神楽黎明記～Live2d\/(?:神楽黎明記 〜ナツの章〜|神楽黎明記～初花の章～)\/(s_[a-z0-9]+)\/\1\.model3\.json$/);
    return m&&id==='kg3-'+m[1]&&name===m[1]?url:'';
   }catch(_){return ''}
  }
  return '';
 }
 root.ArchiveAdditionalLive2DSources=Object.freeze({resolve});
})(window);
