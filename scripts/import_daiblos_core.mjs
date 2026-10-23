#!/usr/bin/env node
/** Reproducible inventory importer, shared Spine loader and preview pipeline.
 *  Source is pinned: no floating main branch, no local asset redistribution.
 *  Run: node scripts/import_daiblos_core.mjs
 */
import fs from 'node:fs';
const repo='bungaku-moe/DaiblosCoreAssets';
const pinnedCommit='3c672a0f11cc70fee35432b1a28522d7d74068c2';
const url='https://api.github.com/repos/'+repo+'/git/trees/'+pinnedCommit+'?recursive=1';
const response=await fetch(url,{headers:{Accept:'application/vnd.github+json','User-Agent':'AnimeCharacterArchive/1.0'}});
if(!response.ok)throw Error('Pinned source unavailable: HTTP '+response.status);
const tree=await response.json();
if(tree.truncated||!Array.isArray(tree.tree))throw Error('Git tree truncated; refusing partial import');
const byFolder=new Map();
for(const entry of tree.tree){
 if(entry.type!=='blob'||!entry.path.startsWith('spine/'))continue;
 const parts=entry.path.split('/'),folder=parts[1];
 if(!byFolder.has(folder))byFolder.set(folder,new Map());
 byFolder.get(folder).set(parts.at(-1),entry);
}
const models=[];
for(const [folder,files] of byFolder){
 if(!/^\d{5}_skin_[a-z0-9]+(?:_spine)?$/i.test(folder))continue;
 for(const atlas of files.values()){
  if(!atlas.path.endsWith('.atlas'))continue;
  const stem=atlas.path.split('/').at(-1).slice(0,-6);
  const skeleton=files.get(stem+'.json'),texture=files.get(stem+'.png');
  if(!skeleton||!texture)continue;
  if(!(atlas.size>500&&skeleton.size>50000&&skeleton.size<6500000&&texture.size>800000&&texture.size<13000000))continue;
  models.push({folder,stem,atlasBytes:atlas.size,skeletonBytes:skeleton.size,textureBytes:texture.size});
 }
}
// Actual Chromium capture rejected two source-complete but visually unusable rigs.
// Keep exclusions model-specific, with evidence in data/preview-audits/daibloscore.json.
const excludedModelIds=new Set([
 'dbcore-40350_skin_meteor05_spine-40350_skin_meteor05', // missing attachment in atlas
 'dbcore-70310_skin_atum03a_spine-70310_skin_atum03a' // unusably tiny scene
]);
models.sort((a,b)=>a.folder.localeCompare(b.folder,'en')||a.stem.localeCompare(b.stem,'en'));
const accepted=models.filter(c=>!excludedModelIds.has('dbcore-'+c.folder.toLowerCase()+'-'+c.stem.toLowerCase()));
if(accepted.length<100)throw Error('Insufficient confirmed source triplets: '+models.length);
const characters=accepted.map(c=>{
 const raw=c.stem.replace(/^\d+_skin_?/i,'').replace(/_character$/i,'');
 const m=raw.match(/^([A-Za-z]+)(\d+[a-z]?)$/i);
 const characterName=m?m[1]:raw.replace(/(\d+)/g,' $1').trim();
 const costumeName=m?'皮肤 '+m[2]:'皮肤 · '+raw;
 const base='https://raw.githubusercontent.com/'+repo+'/'+pinnedCommit+'/spine/'+encodeURIComponent(c.folder)+'/'+encodeURIComponent(c.stem);
 return {id:'dbcore-'+c.folder.toLowerCase()+'-'+c.stem.toLowerCase(),gameId:'daibloscore',game:'Daiblos Core',collectionName:'Daiblos Core · 动态角色',engine:'spine',
  name:characterName+' · '+costumeName,characterName,characterCode:c.folder.split('_')[0],costumeName,skinCode:c.stem,assetType:'character-spine',
  spineVersion:'3.8',skeletonFormat:'json',atlasCoordinateSpace:'declared',resourceStem:c.stem,base,skeletonUrl:base+'.json',atlasUrl:base+'.atlas',
  sourceRepo:repo,sourceCommit:pinnedCommit,sourcePath:'spine/'+c.folder+'/'+c.stem+'.json',
  skeletonBytes:c.skeletonBytes,atlasBytes:c.atlasBytes,textureBytes:c.textureBytes,
  status:'indexed-unverified',playbackStatus:'not-verified',previewSource:'not-rendered',visualIntegrityPolicy:'coherent-character'};
});
if(new Set(characters.map(c=>c.id)).size!==characters.length)throw Error('Duplicate generated IDs');
const dest='data/spine-daiblos-core.json';
const manifest=JSON.parse(fs.readFileSync(dest,'utf8'));
if(manifest.sourceCommit!==pinnedCommit)throw Error('Manifest and importer revisions diverged');
const existing=new Map(manifest.characters.map(c=>[c.id,c]));
for(const record of characters){
 const previous=existing.get(record.id);
 if(!previous||previous.sourcePath!==record.sourcePath||previous.skeletonBytes!==record.skeletonBytes||
   previous.atlasBytes!==record.atlasBytes||previous.textureBytes!==record.textureBytes)continue;
 for(const name of ['preview','previewSource','previewSourceIdentity','previewSha256','previewWidth','previewHeight','status','playbackStatus'])
  if(Object.hasOwn(previous,name))record[name]=previous[name];
}
manifest.characters=characters;
manifest.totalCharacters=characters.length;
fs.writeFileSync(dest,JSON.stringify(manifest,null,2)+'\n');
console.log('DAIBLOS_BULK_IMPORT',JSON.stringify({indexed:characters.length,sourceCommit:pinnedCommit}));
