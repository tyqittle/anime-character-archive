// Source adapter for native Cubism2 bundles whose export lost its JSON manifest.
// All references are declared data; the original MOC and motions remain intact.
import path from 'node:path';

export function nativeBundleDescriptors(scope,tree,settings){
 const config=scope.import?.nativeBundles;
 if(!config)return settings;
 if(scope.import.format!=='cubism2'||!config.pattern||!config.models||
    !/^assets\/model-settings\/[a-z0-9-]+$/.test(config.normalizedSettingsDirectory||''))throw Error('Invalid native Cubism2 bundle policy');
 const pattern=new RegExp(config.pattern),files=new Map(tree.filter(f=>f.type==='blob').map(f=>[f.path,f]));
 const discovered=[...files.values()].filter(f=>pattern.test(f.path));
 if(!discovered.length)throw Error('Empty native Cubism2 bundle scope');
 const paths=new Set(discovered.map(f=>f.path));
 for(const key of Object.keys(config.models))if(!paths.has(key))throw Error('Stale native bundle declaration: '+key);
 const result=[...settings],used=new Set();
 for(const file of discovered){
  const declared=config.models[file.path];
  if(!declared||!file.path.endsWith('.moc')||file.size<1)throw Error('Missing native bundle declaration: '+file.path);
  if(declared.settingsPath){
   if(declared.settings||path.posix.dirname(declared.settingsPath)!==path.posix.dirname(file.path)||used.has(declared.settingsPath))throw Error('Ambiguous native bundle manifest: '+file.path);
   const index=result.findIndex(s=>s.path===declared.settingsPath);
   if(index<0)throw Error('Native bundle source manifest absent: '+declared.settingsPath);
   result[index]={...result[index],nativeBundleMoc:file.path};used.add(declared.settingsPath);
  }else{
   const data=declared.settings;
   if(!data||data.model!==path.posix.basename(file.path)||!Array.isArray(data.textures)||!data.textures.length||!Object.values(data.motions||{}).some(group=>Array.isArray(group)&&group.length))throw Error('Incomplete native bundle manifest: '+file.path);
   // Keep every declared texture index, including an intentional blank layer.
   const refs=[...data.textures,...Object.values(data.motions).flat().map(m=>m.file)];
   if(new Set(data.textures).size!==data.textures.length)throw Error('Duplicate native bundle texture');
   for(const ref of refs){
    if(typeof ref!=='string'||!ref||ref.includes('\\')||ref.split('/').includes('..')||ref.startsWith('/')||/^[a-z]+:/i.test(ref))throw Error('Native bundle reference escapes model');
    const target=path.posix.join(path.posix.dirname(file.path),ref);
    if(!(files.get(target)?.size>0))throw Error('Native bundle reference absent: '+target);
   }
   result.push({...file,nativeBundleMoc:file.path,derivedSettings:structuredClone(data)});
  }
 }
 return result;
}

export function validateNativeBundleSettings(file,settings){
 if(file.nativeBundleMoc&&path.posix.join(path.posix.dirname(file.path),settings.model||'')!==file.nativeBundleMoc)throw Error('Native source manifest references a different MOC');
 return settings;
}
