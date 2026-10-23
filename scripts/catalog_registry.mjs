import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {validate}=require('../assets/js/shared/catalog-registry.js');
export function readCatalogRegistry(){
 return validate(JSON.parse(fs.readFileSync(new URL('../data/animation-catalogs.json',import.meta.url),'utf8')));
}
export function sourceIdentity(c){
 return [c.engine||'spine',...['base','skeletonUrl','atlasUrl','modelUrl','resourceStem','spineVersion'].map(key=>c[key]||'')];
}
export function readCharacters(){
 const characters=readCatalogRegistry().flatMap(entry=>JSON.parse(fs.readFileSync(new URL('../'+entry.path,import.meta.url),'utf8')).characters);
 const known=new Set();
 for(const c of characters){if(!c||typeof c.id!=='string'||known.has(c.id))throw Error('Invalid or duplicate catalog model ID: '+c?.id);known.add(c.id)}
 return characters;
}
