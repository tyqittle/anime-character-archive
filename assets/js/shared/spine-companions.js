'use strict';
// Optional source-defined back layers. One renderer, camera, clock and texture
// owner; this service never downloads, schedules frames or accesses the DOM.
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArchiveSpineCompanions=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 function text(uri){
  const comma=uri.indexOf(',');if(comma<0)throw Error('Invalid companion data URI');
  return uri.slice(0,comma).includes(';base64')?new TextDecoder().decode(Uint8Array.from(atob(uri.slice(comma+1)),c=>c.charCodeAt(0))):uri.slice(comma+1);
 }
 function combine(primary,layers){
  if(!layers.length)return primary;
  if(primary.version!=='4.1'||layers.length>3||layers.some(p=>p.version!==primary.version||p.companions?.length))throw Error('Unsupported composite Spine source');
  const raw={...primary.rawDataURIs},companions=[];let combined=text(raw[primary.atlas]);
  for(let i=0;i<layers.length;i++){
   const part=layers[i],prefix='__archive_layer_'+i+'_',atlas=text(part.rawDataURIs[part.atlas]);
   const pages=new Set(atlas.split(/\r?\n/).map(l=>l.trim()).filter(l=>/\.(png|webp|jpe?g)$/i.test(l)&&!l.includes(':')));
   const renamed=atlas.split(/\r?\n/).map(l=>pages.has(l.trim())?prefix+l.trim():l).join('\n');
   for(const page of pages){if(!part.rawDataURIs[page]||raw[prefix+page])throw Error('Missing or colliding companion texture');raw[prefix+page]=part.rawDataURIs[page]}
   const skeleton=prefix+part.skeleton;if(raw[skeleton])throw Error('Companion skeleton collision');raw[skeleton]=part.rawDataURIs[part.skeleton];
   // The main atlas loads all textures. Its extra regions are namespaced;
   // companion parsers retain their original region names in a separate atlas.
   combined+='\n\n'+renamed.split('\n').map(l=>l.trim()&&!l.includes(':')&&!pages.has(l.trim().replace(prefix,''))?prefix+l:l).join('\n');
   companions.push({atlasText:renamed,skeleton,format:/\.json$/i.test(part.skeleton)?'json':'skel',idle:part.sourceIdleAnimation,skinLayers:part.sourceSkinLayers});
  }
  raw[primary.atlas]='data:text/plain,'+combined;
  return {...primary,rawDataURIs:raw,companions};
 }
 function install(p,packs,runtime){
  if(!packs?.length)return null;
  const atlas=p.assetManager.get(p.config.atlasUrl),main=p.skeleton;
  const layers=packs.map(pack=>{
   const ownAtlas=new runtime.TextureAtlas(pack.atlasText);
   for(const page of ownAtlas.pages){const shared=atlas.pages.find(a=>a.name===page.name);if(!shared?.texture)throw Error('Companion texture not loaded: '+page.name);page.setTexture(shared.texture)}
   const loader=new runtime.AtlasAttachmentLoader(ownAtlas),uri=p.config.rawDataURIs[pack.skeleton];
   const data=pack.format==='json'?new runtime.SkeletonJson(loader).readSkeletonData(JSON.parse(text(uri))):new runtime.SkeletonBinary(loader).readSkeletonData(Uint8Array.from(atob(uri.slice(uri.indexOf(',')+1)),c=>c.charCodeAt(0)));
   const skeleton=new runtime.Skeleton(data),skinNames=pack.skinLayers||[data.skins[0]?.name].filter(Boolean);
   const skin=new runtime.Skin('__archive_companion');for(const name of skinNames){const s=data.findSkin(name);if(!s)throw Error('Companion skin absent: '+name);skin.addSkin(s)}
   skeleton.setSkin(skin);skeleton.setSlotsToSetupPose();
   const state=new runtime.AnimationState(new runtime.AnimationStateData(data));
   const idle=data.findAnimation(pack.idle)||data.animations.find(a=>/idle_stand/i.test(a.name))||data.animations.find(a=>/idle|stand/i.test(a.name));
   if(!idle)throw Error('Companion idle animation absent');state.setAnimation(0,idle.name,true);state.apply(skeleton);skeleton.updateWorldTransform();
   return {skeleton,state,idle:idle.name};
  });
  const renderer=p.sceneRenderer,draw=renderer.drawSkeleton,bounds=main.getBounds,dispose=p.dispose;
  let disposed=false;
  const session={layers,update(delta){
   if(disposed)return;
   const primary=p.animationState.getCurrent(0);
   for(const part of layers){
    const matching=primary&&part.skeleton.data.animations.find(a=>a.name.toLowerCase()===primary.animation.name.toLowerCase());
    const name=matching?.name||part.idle,loop=matching?primary.loop:true;
    let entry=part.state.getCurrent(0);
    if(entry?.animation.name!==name||entry.loop!==loop)entry=part.state.setAnimation(0,name,loop);
    if(matching){entry.trackTime=primary.trackTime;part.state.update(0)}else part.state.update(delta);
    part.state.apply(part.skeleton);part.skeleton.updateWorldTransform();
   }
  },dispose(){
   if(disposed)return;disposed=true;renderer.drawSkeleton=draw;main.getBounds=bounds;p.dispose=dispose;p._archiveCompanionSession=null;
   for(const part of layers)part.state.clearTracks();layers.length=0;
  }};
  renderer.drawSkeleton=function(skeleton,...args){if(!disposed&&skeleton===main)for(const part of layers)draw.call(this,part.skeleton,...args);return draw.call(this,skeleton,...args)};
  main.getBounds=function(offset,size,...args){
   bounds.call(this,offset,size,...args);let x=offset.x,y=offset.y,X=x+size.x,Y=y+size.y;
   for(const part of layers){const o=new runtime.Vector2(),s=new runtime.Vector2();part.skeleton.getBounds(o,s,...args);x=Math.min(x,o.x);y=Math.min(y,o.y);X=Math.max(X,o.x+s.x);Y=Math.max(Y,o.y+s.y)}
   offset.set(x,y);size.set(X-x,Y-y);
  };
  p.dispose=function(...args){session.dispose();return dispose?.apply(this,args)};
  p._archiveCompanionSession=session;return session;
 }
 return Object.freeze({combine,install});
});
