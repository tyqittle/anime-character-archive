// Structural checks complement fault-injection behavior tests; no code execution.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const presenters=new Set(['assets/js/shared/friend-links.js']);
export function auditModuleBoundaries(files,read){
 const errors=[];
 for(const file of files.filter(p=>p.startsWith('assets/js/shared/')&&p.endsWith('.js'))){
  const source=read(file).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm,'');
  if(!presenters.has(file)&&/\bdocument\s*[.\[]|\b(?:querySelector|getElementById|ArchiveTheaterUI|ArchiveDesktopBridge|allCharacters|azurlanePending|selectedVoiceChanged)\b/.test(source))errors.push({file,rule:'shared-service-page-dependency'});
  if(/(?:from\s*|require\s*\(\s*|import\s*\(\s*)['"][^'"]*\/(?:spine|live2d|gallery)\//.test(source))errors.push({file,rule:'shared-service-engine-dependency'});
 }
 const entries={
  'spine.html':/^assets\/js\/live2d\//,
  'azurlane-stage.html':/^assets\/js\/spine\/(?:state|catalog|playback|spine-runtime|bootstrap)\.js$/,
  'characters.html':/^assets\/js\/(?:spine|live2d)\//
 };
 for(const [file,forbidden] of Object.entries(entries)){
  if(!files.includes(file))continue;
  const scripts=[...read(file).matchAll(/<script\b[^>]*\bsrc=["']\.\/([^"'?]+)(?:\?[^"']*)?["']/g)].map(match=>match[1]);
  for(const dependency of scripts)if(forbidden.test(dependency))errors.push({file,dependency,rule:'engine-entry-isolation'});
  if(file==='spine.html'){
   const cache=scripts.indexOf('assets/js/shared/indexeddb-storage.js'),catalog=scripts.indexOf('assets/js/spine/catalog.js');
   if(catalog>=0&&(cache<0||cache>catalog))errors.push({file,rule:'storage-service-before-ui'});
  }
 }
 return {checkedSharedModules:files.filter(p=>p.startsWith('assets/js/shared/')&&p.endsWith('.js')).length,errors};
}
export function main(root=path.resolve('.')){
 const folder=path.join(root,'assets/js/shared');
 const files=[...fs.readdirSync(folder).filter(p=>p.endsWith('.js')).map(p=>'assets/js/shared/'+p),'spine.html','azurlane-stage.html','characters.html'];
 const result=auditModuleBoundaries(files,p=>fs.readFileSync(path.join(root,p),'utf8'));
 console.log('MODULE_BOUNDARIES',JSON.stringify(result));if(result.errors.length)process.exitCode=1;
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main();
