'use strict';
// A model variant is not a new skin. Keep source assets intact, but show
// only the standard model when a same-skin alternative exists.
// These rules deliberately do NOT merge different characters, costumes,
// BattleFront vs illustrated models, or visually similar screenshots.
const animationAliasIds=new Map();

function variantParentAnimationId(c){
 if(!c||typeof c.id!=='string')return '';
 if(c.gameId==='browndust2'&&/^bd2-char[0-9]{6}_c$/.test(c.id))return c.id.slice(0,-2);
 // _hx is the alternative regional version of the very same Azur Lane skin.
 if(c.gameId==='azurlane'&&/^al-[a-z0-9_-]+_hx$/i.test(c.id)&&
    c.skinCode===c.id.slice(3))return c.id.slice(0,-3);
 return '';
}
function isEquivalentAnimationVariant(primary,alternative){
 if(!primary||!alternative||primary.gameId!==alternative.gameId||
    primary.id!==variantParentAnimationId(alternative))return false;
 if(alternative.gameId==='browndust2'){
  return !!primary.characterName&&primary.characterName===alternative.characterName&&
   !!primary.costume&&primary.costume===alternative.costume&&
   typeof primary.base==='string'&&typeof alternative.base==='string'&&
   primary.base===alternative.base.slice(0,-2);
 }
 if(alternative.gameId==='azurlane'){
  return !!primary.characterName&&primary.characterName===alternative.characterName&&
   primary.skinCode===alternative.skinCode.slice(0,-3)&&
   primary.engine==='cubism'&&alternative.engine==='cubism'&&
   !!primary.modelUrl&&!!alternative.modelUrl;
 }
 return false;
}
// Existing bookmarks/desktop links to hidden variants must still work.
function canonicalAnimationId(id){
 const seen=new Set();
 while(animationAliasIds.has(id)&&!seen.has(id)){
  seen.add(id);id=animationAliasIds.get(id);
 }
 return id;
}
// Shared identity fallback for voice lookup, including standalone variants.
// Never inherit audio across skins or between unrelated game catalogs.
function animationVoiceIdentityIds(c){
 if(!c||typeof c.id!=='string')return [];
 const parent=variantParentAnimationId(c);
 return parent?[c.id,parent]:[c.id];
}
function uniqueAnimationEntries(entries){
 animationAliasIds.clear();
 const byId=new Map();
 for(const c of entries){
  if(!c||!c.id)continue;
  const key=(c.gameId||'nikke')+'|'+c.id;
  if(!byId.has(key))byId.set(key,c);
 }
 const hiddenVariants=new Set();
 for(const [key,c] of byId){
  const parentId=variantParentAnimationId(c);
  if(!parentId)continue;
  const standard=byId.get((c.gameId||'nikke')+'|'+parentId);
  if(isEquivalentAnimationVariant(standard,c)){
   hiddenVariants.add(key);
   animationAliasIds.set(c.id,standard.id);
  }
 }
 const assets=new Map(),result=[];
 for(const [key,c] of byId){
  if(hiddenVariants.has(key))continue;
  const game=c.gameId||'nikke',url=c.modelUrl||c.base||'';
  const asset=url?game+'|'+url.replace(/[?#].*$/,'').replace(/\/$/,''):'';
  if(asset&&assets.has(asset)){
   animationAliasIds.set(c.id,assets.get(asset).id);
   continue;
  }
  if(asset)assets.set(asset,c);
  result.push(c);
 }
 return result;
}

// The browser and Node regressions must use the same skin identity policy.
if(typeof module==='object'&&module.exports)module.exports={uniqueAnimationEntries,canonicalAnimationId,animationVoiceIdentityIds};
