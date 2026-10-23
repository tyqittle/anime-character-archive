'use strict';
// Pure registry contract. The browser facade is the only public global.
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ArchiveCatalogRegistry=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 function validate(value){
  if(value?.schemaVersion!==1||!Array.isArray(value.catalogs)||!value.catalogs.length)throw Error('Unsupported catalog registry');
  const ids=new Set(),paths=new Set();
  return value.catalogs.map(entry=>{
   if(!entry||typeof entry.id!=='string'||!/^[a-z0-9-]+$/.test(entry.id)||typeof entry.name!=='string'||!entry.name.trim()||
    typeof entry.path!=='string'||!/^data\/[a-zA-Z0-9_-]+\.json$/.test(entry.path))throw Error('Invalid catalog registration');
   if(ids.has(entry.id)||paths.has(entry.path))throw Error('Duplicate catalog registration');
   ids.add(entry.id);paths.add(entry.path);
   return Object.freeze({id:entry.id,name:entry.name,path:entry.path,url:'./'+entry.path});
  });
 }
 async function load(fetcher,signal){
  const controller=new AbortController(),cancel=()=>controller.abort();
  if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(cancel,12000);
  try{
   const response=await fetcher('./data/animation-catalogs.json',{cache:'no-cache',signal:controller.signal});
   if(!response.ok)throw Error('Catalog registry HTTP '+response.status);
   return validate(await response.json());
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel)}
 }
 function sourceIdentity(c){
  return [c.engine||'spine',...['base','skeletonUrl','atlasUrl','modelUrl','resourceStem','spineVersion'].map(key=>c[key]||'')];
 }
 return Object.freeze({validate,load,sourceIdentity});
});
