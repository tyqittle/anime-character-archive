#!/usr/bin/env node
/**
 * Add all real NIKKE character/skin Spine file sets from upstream Git tree.
 * This is a file-level inventory, not a playback assertion.
 * Run from repo root: node scripts/import_nikke_dynamic.mjs
 */
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const repo='https://api.github.com/repos/Nikke-db/Nikke-db.github.io';
const index='https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/js/json/';
async function getJSON(url){
 const r=await fetch(url,{headers:{'User-Agent':'AnimeCharacterArchive-NIKKE-importer','Accept':'application/vnd.github+json'}});
 if(!r.ok)throw Error(url+' HTTP '+r.status);return r.json();
}
const [source,characters,rootTree,revision]=await Promise.all([
 getJSON(index+'l2d.json'),getJSON(index+'Characters.json'),getJSON(repo+'/git/trees/main'),
 getJSON(repo+'/git/refs/heads/main')
]);
const l2d=rootTree.tree.find(x=>x.path==='l2d'&&x.type==='tree');
if(!l2d)throw Error('Upstream l2d tree not found');
const tree=await getJSON(repo+'/git/trees/'+l2d.sha+'?recursive=1');
if(tree.truncated)throw Error('Source tree was truncated; not safe to import');
const assetSets=new Map();
for(const file of tree.tree){
 const m=file.path.match(/^(c\d{3}(?:_\d+|_old)?)\/([^/]+)$/);
 if(!m||file.type!=='blob')continue;
 const files=assetSets.get(m[1])||new Set();files.add(m[2]);assetSets.set(m[1],files);
}
const qualified=[...assetSets].map(([id,files])=>{
 const fileBase=files.has(id+'_00.skel')&&files.has(id+'_00.atlas')?id+'_00':id;
 return {id,fileBase,files};
}).filter(x=>x.files.has(x.fileBase+'.skel')&&x.files.has(x.fileBase+'.atlas')&&[...x.files].some(y=>y.toLowerCase().endsWith('.png')))
.sort((a,b)=>a.id.localeCompare(b.id,'en',{numeric:true}));
const sourceNames=new Map(source.map(x=>[x.id,x.name]));
const sourceVersions=new Map(source.map(x=>[x.id,x.version]));
const unitNames=new Map(characters.map(x=>[x.id,x.name]));
const staticData=JSON.parse(fs.readFileSync(new URL('data/characters.json',root),'utf8'));
const staticNames=new Map(staticData.characters.filter(x=>x.gameId==='nikke'&&/^c\d{3}$/.test(x.id)).map(x=>[x.id,x.name]));
const manifestPath=new URL('data/spine-characters.json',root);
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const previous=manifest.characters.filter(x=>x.gameId==='nikke');
const byId=new Map(previous.map(x=>[x.id,x]));
const baseOld=new Map(previous.filter(x=>/^c\d{3}$/.test(x.id)).map(x=>[x.id,x.name]));
const baseNames=new Map(qualified.filter(x=>/^c\d{3}$/.test(x.id)).map(x=>[x.id,
 baseOld.get(x.id)||sourceNames.get(x.id)||unitNames.get(x.id)||staticNames.get(x.id)||'角色 '+x.id+'（待核对）'
]));
const added=[];
const models=qualified.map(x=>{
 const old=byId.get(x.id),base=x.id.slice(0,4),group=baseNames.get(base)||'角色 '+base+'（待核对）';
 const variant=x.id!==base;
 const label=sourceNames.get(x.id)||(variant?group+' · '+x.id.slice(5)+'号服装（待核对）':group);
 const entry={...old,id:x.id,name:old?.name||label,gameId:'nikke',
  spineVersion:old?.spineVersion||String(sourceVersions.get(x.id)||'4.0'),
  base:old?.base||'https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/'+x.id+'/'+x.fileBase,
  characterName:group};
 if(variant)entry.costumeName=sourceNames.get(x.id)||x.id.slice(5)+'号服装（待核对）';
 if(!old){entry.versionUnverified=true;added.push(x.id)}
 return entry;
});
const qualifiedIDs=new Set(qualified.map(x=>x.id));
const retained=previous.filter(x=>!qualifiedIDs.has(x.id));
manifest.characters=[...models,...retained,...manifest.characters.filter(x=>x.gameId!=='nikke')];
manifest.note='NIKKE source character/skin skeleton+atlas+texture folders imported; playback and true previews require individual verification; Blue Archive lobby records retained.';
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const audit={source:'https://github.com/Nikke-db/Nikke-db.github.io',sourceCommit:revision.object.sha,
 sourceL2DIndexEntries:source.length,modelsWithSkeletonAtlasAndTexture:qualified.length,
 sourceIndexModelsMatched:qualified.filter(x=>sourceNames.has(x.id)).length,
 additionalUnlistedModels:qualified.filter(x=>!sourceNames.has(x.id)).length,
 previousNikkeEntries:previous.length,newlyIndexed:added.length,
 currentNikkeSpineIndexes:models.length+retained.length,
 retainedLegacyIndexes:retained.map(x=>x.id),newIds:added,
 warning:'Folder-level check only. Individual model render, atlas texture page correctness, version and matching previews unverified; remote original Spine data not mirrored.'};
fs.writeFileSync(new URL('data/nikke-import-audit.json',root),JSON.stringify(audit,null,2)+'\n');
console.log('NIKKE_IMPORT',JSON.stringify({models:qualified.length,added:added.length,retained:retained.length}));
