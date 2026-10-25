import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {validate,sourceIdentity}=require('../assets/js/shared/catalog-registry.js');
export function readCatalogRegistry(){
 return validate(JSON.parse(fs.readFileSync(new URL('../data/animation-catalogs.json',import.meta.url),'utf8')));
}
export {sourceIdentity};
// Imports are additive unless an individual source replacement is requested.
// Resolve by stable ID, never by a repository-relative path shared by games.
export function mergeCatalogRecords(existing,incoming,{registered=existing,updateExisting=[]}={}){
 const byId=new Map(),globalIds=new Map(),updates=new Set(updateExisting),seen=new Set();
 for(const c of registered){if(globalIds.has(c.id))throw Error('Duplicate registered model ID: '+c.id);globalIds.set(c.id,c)}
 for(const c of existing){if(byId.has(c.id))throw Error('Duplicate catalog model ID: '+c.id);byId.set(c.id,c)}
 const replacements=new Map();
 for(const c of incoming){
  if(!c||typeof c.id!=='string'||!c.id||seen.has(c.id))throw Error('Duplicate or invalid incoming model ID: '+c?.id);
  seen.add(c.id);const old=byId.get(c.id);
  if(!old&&globalIds.has(c.id))throw Error('Model ID belongs to another catalog: '+c.id);
  if(!old){replacements.set(c.id,c);continue}
  for(const key of ['gameId','skinCode'])if((old[key]||'')!==(c[key]||''))throw Error('Conflicting '+key+' for existing model: '+c.id);
  if((old.engine||'spine')!==(c.engine||'spine'))throw Error('Conflicting engine for existing model: '+c.id);
  const same=JSON.stringify(sourceIdentity(old))===JSON.stringify(sourceIdentity(c));
  if(!same&&!updates.has(c.id))throw Error('Source replacement requires --update-existing '+c.id);
  const next={...old,...c};
  if(same){
   for(const key of Object.keys(next))if(key.startsWith('preview')||['status','playbackStatus'].includes(key)){
    if(Object.hasOwn(old,key))next[key]=old[key];else delete next[key];
   }
  }else{
   for(const key of Object.keys(next))if(key.startsWith('preview'))delete next[key];
   Object.assign(next,{status:'indexed-unverified',playbackStatus:'not-verified',previewSource:'not-rendered'});
  }
  replacements.set(c.id,next);
 }
 return [...existing.map(c=>{const next=replacements.get(c.id)||c;replacements.delete(c.id);return next}),...replacements.values()];
}
export function readCharacters(){
 const characters=readCatalogRegistry().flatMap(entry=>JSON.parse(fs.readFileSync(new URL('../'+entry.path,import.meta.url),'utf8')).characters);
 const known=new Set();
 for(const c of characters){if(!c||typeof c.id!=='string'||known.has(c.id))throw Error('Invalid or duplicate catalog model ID: '+c?.id);known.add(c.id)}
 return characters;
}
