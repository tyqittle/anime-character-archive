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
  const identity=[c.engine||'spine',...['base','skeletonUrl','atlasUrl','modelUrl','resourceStem','spineVersion'].map(key=>c[key]||'')];
  if(c.atlasCoordinateSpace)identity.push('atlas-coordinate-space:'+c.atlasCoordinateSpace);
  if(c.atlasEdgeExtrusion!==undefined)identity.push('atlas-edge-extrusion:'+c.atlasEdgeExtrusion);
  const excluded=c.portraitFraming?.excludeDrawables;
  if(excluded?.length)identity.push('portrait-framing-excluded-drawables:'+JSON.stringify([...new Set(excluded)].sort()));
  const excludedBones=c.portraitFraming?.excludeBones;
  if(excludedBones?.length)identity.push('portrait-framing-excluded-bones:'+JSON.stringify([...new Set(excludedBones)].sort()));
  if(c.spineSkinLayers)identity.push('spine-skin-layers:'+JSON.stringify(c.spineSkinLayers));
  if(c.spineIdleAnimation)identity.push('spine-idle-animation:'+c.spineIdleAnimation);
  if(c.spineCompanions)identity.push('spine-companions:'+JSON.stringify(c.spineCompanions.map(sourceIdentity)));
  if(typeof c.premultipliedAlpha==='boolean')identity.push('premultiplied-alpha:'+c.premultipliedAlpha);
  if(c.spineAtlasPageMerge)identity.push('spine-atlas-page-merge:true');
  if(c.spineAttachmentPathRepairs)identity.push('spine-attachment-path-repairs:'+JSON.stringify(c.spineAttachmentPathRepairs.map(r=>[r.skin,r.slot,r.name,r.from,r.to])));
  if(c.resourceIntegrity)identity.push('resource-integrity:'+JSON.stringify(c.resourceIntegrity.map(x=>[x.path,x.sha256]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0)));
  return identity;
 }
 return Object.freeze({validate,load,sourceIdentity});
});
