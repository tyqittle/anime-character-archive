// Compare a proposed catalog update with the published/PR base. No networking.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {validate,sourceIdentity}=require('../assets/js/shared/catalog-registry.js');
const {uniqueAnimationEntries,canonicalAnimationId}=require('../assets/js/spine/animation-identity.js');
const protectedFields=['gameId','skinCode','collectionId','engine','modelFormat','base','skeletonUrl','atlasUrl','modelUrl','resourceStem','spineVersion','atlasCoordinateSpace','atlasEdgeExtrusion','portraitFraming'];
const value=(c,key)=>key==='engine'?(c[key]||'spine'):(c[key]??null);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function readCatalogSnapshot(read){
 const registry=validate(JSON.parse(read('data/animation-catalogs.json')));
 return {registry,catalogs:registry.map(entry=>({id:entry.id,path:entry.path,characters:JSON.parse(read(entry.path)).characters}))};
}
function indexed(snapshot,errors,label){
 const byId=new Map();
 for(const catalog of snapshot.catalogs){
  if(!Array.isArray(catalog.characters)){errors.push({type:'invalid-catalog',catalog:catalog.id,label});continue}
  for(const c of catalog.characters){
   if(!c||typeof c.id!=='string'||!c.id){errors.push({type:'invalid-id',catalog:catalog.id,label});continue}
   if(byId.has(c.id))errors.push({type:'duplicate-id',id:c.id,label});
   else byId.set(c.id,{catalog:catalog.id,character:c});
  }
 }
 return byId;
}
export function auditCatalogCompatibility(before,after,{changes=[]}={}){
 const errors=[],reviewedChanges=[],old=indexed(before,errors,'baseline'),current=indexed(after,errors,'candidate');
 const recordChange=(change,type)=>{
  const declaration=changes.find(item=>item.id===change.id&&item.field===change.field&&typeof item.reason==='string'&&item.reason.trim()&&equal(item.before,change.before)&&equal(item.after,change.after));
  if(declaration)reviewedChanges.push({...change,reason:declaration.reason});else errors.push({type,...change});
 };
 const registrations=new Map(after.registry.map(entry=>[entry.id,entry.path]));
 for(const [id,{character:c}] of current)if(/^matching-/.test(c.previewSource||'')&&c.previewSourceIdentity&&!equal(c.previewSourceIdentity,sourceIdentity(c)))errors.push({type:'stale-preview',id});
 for(const entry of before.registry)if(registrations.get(entry.id)!==entry.path)errors.push({type:'changed-registration',catalog:entry.id,before:entry.path,after:registrations.get(entry.id)||null});
 for(const [id,previous] of old){
  const found=current.get(id);
  if(!found){errors.push({type:'removed-model',id});continue}
  if(previous.catalog!==found.catalog)errors.push({type:'moved-model',id,before:previous.catalog,after:found.catalog});
  const a=previous.character,b=found.character;
  for(const field of protectedFields){
   if(equal(value(a,field),value(b,field)))continue;
   const change={id,field,before:value(a,field),after:value(b,field)};
   recordChange(change,'changed-protected-field');
  }
  const hadPreview=/^matching-/.test(a.previewSource||'')&&!!a.preview&&/^[a-f0-9]{64}$/.test(a.previewSha256||'');
  if(hadPreview&&(!b.preview||!/^matching-/.test(b.previewSource||'')||!/^[a-f0-9]{64}$/.test(b.previewSha256||'')))errors.push({type:'lost-preview',id});
 }
 uniqueAnimationEntries([...old.values()].map(item=>item.character));
 const oldTargets=new Map([...old.keys()].map(id=>[id,canonicalAnimationId(id)]));
 uniqueAnimationEntries([...current.values()].map(item=>item.character));
 for(const [id,target] of oldTargets)if(current.has(id)&&canonicalAnimationId(id)!==target)recordChange({id,field:'defaultModelId',before:target,after:canonicalAnimationId(id)},'changed-default-model');
 return {schemaVersion:1,baselineModels:old.size,candidateModels:current.size,added:[...current.keys()].filter(id=>!old.has(id)),reviewedChanges,errors,compatible:errors.length===0};
}
export function verifySnapshotPreviews(snapshot,root){
 const errors=[],prefix=path.resolve(root)+path.sep;
 for(const catalog of snapshot.catalogs)for(const c of catalog.characters){
  if(!/^matching-/.test(c.previewSource||''))continue;
  const relative=typeof c.preview==='string'?c.preview.split(/[?#]/)[0]:'';
  if(!/^\.\/assets\/[a-zA-Z0-9_./-]+$/.test(relative)||relative.split('/').includes('..')){errors.push({type:'invalid-preview-path',id:c.id});continue}
  const file=path.resolve(root,relative);
  if(!file.startsWith(prefix)||!fs.existsSync(file)){errors.push({type:'missing-preview-file',id:c.id,path:relative});continue}
  if(!/^[a-f0-9]{64}$/.test(c.previewSha256||'')||createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==c.previewSha256)errors.push({type:'preview-digest-mismatch',id:c.id,path:relative});
 }
 return errors;
}
export function main(args=process.argv.slice(2)){
 const option=name=>{const index=args.indexOf(name);return index<0?null:args[index+1]};
 const baseRef=option('--base-ref'),directory=option('--baseline-dir');
 if(!baseRef&&!directory)throw Error('Provide --base-ref or --baseline-dir; a baseline is required');
 if(baseRef&&!/^[a-zA-Z0-9_./-]+$/.test(baseRef))throw Error('Invalid base ref');
 const root=path.resolve(option('--root')||'.');
 const baselineRead=directory?file=>fs.readFileSync(path.resolve(directory,file),'utf8'):file=>execFileSync('git',['show',baseRef+':'+file],{cwd:root,encoding:'utf8',maxBuffer:30*1024*1024});
 const currentRead=file=>fs.readFileSync(path.resolve(root,file),'utf8');
 const declaration=option('--changes');
 const candidate=readCatalogSnapshot(currentRead);
 const report=auditCatalogCompatibility(readCatalogSnapshot(baselineRead),candidate,{changes:declaration?JSON.parse(fs.readFileSync(declaration,'utf8')):[]});
 if(args.includes('--verify-previews')){report.errors.push(...verifySnapshotPreviews(candidate,root));report.compatible=report.errors.length===0}
 const output=option('--output');
 if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({...report,baseRef:baseRef||option('--baseline-label')||null},null,2)+'\n')}
 console.log(JSON.stringify({...report,added:report.added.length,reviewedChanges:report.reviewedChanges.length}));
 if(!report.compatible)process.exitCode=1;
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main();
