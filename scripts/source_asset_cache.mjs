// Optional test/capture acceleration using the exact source bytes downloaded by
// the importer. This never substitutes previews or another model's assets.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {readCharacters} from './catalog_registry.mjs';
export async function warmSourceCache(records,indexPath,{fetcher=fetch,origin='https://tyqittle.github.io'}={}){
 const file=path.resolve(indexPath),root=path.dirname(file);
 fs.mkdirSync(path.join(root,'cache'),{recursive:true});
 const index=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{schemaVersion:1,assets:{}};
 for(const c of records){
  const urls=[c.skeletonUrl,c.atlasUrl,...(c.textures||[]).map(t=>t.url)];
  for(const url of urls){
   const name=decodeURIComponent(new URL(url).pathname.split('/').pop()),lock=c.resourceIntegrity?.find(r=>r.path===name);
   if(!lock||!/^[a-f0-9]{64}$/.test(lock.sha256))throw Error('Missing source byte lock: '+url);
   const cached=index.assets[url],relative='cache/'+lock.sha256,target=path.join(root,relative);
   if(cached?.corsOrigin===origin&&cached.sha256===lock.sha256&&cached.file===relative&&fs.existsSync(target)&&createHash('sha256').update(fs.readFileSync(target)).digest('hex')===lock.sha256)continue;
   const response=await fetcher(url,{headers:{Origin:origin},signal:AbortSignal.timeout(c.downloadPolicy?.assetMs||90000)});
   if(!response.ok)throw Error('Source HTTP '+response.status+': '+url);
   const cors=response.headers.get('access-control-allow-origin');
   if(cors!=='*'&&cors!==origin)throw Error('Source does not allow production origin: '+url);
   const bytes=Buffer.from(await response.arrayBuffer());
   if(createHash('sha256').update(bytes).digest('hex')!==lock.sha256)throw Error('Source bytes changed: '+url);
   fs.writeFileSync(target,bytes);index.assets[url]={file:relative,sha256:lock.sha256,bytes:bytes.length,corsOrigin:origin};
   fs.writeFileSync(file+'.tmp',JSON.stringify(index));fs.renameSync(file+'.tmp',file);
   console.log('SOURCE_CACHE_VERIFIED',c.id,name,bytes.length);
  }
 }
 return index;
}
export async function installSourceCache(context,indexPath){
 if(!indexPath)return;
 const file=path.resolve(indexPath),cache=JSON.parse(fs.readFileSync(file,'utf8'));
 if(cache.schemaVersion!==1||!cache.assets)throw Error('Invalid source cache index');
 await context.route('**/*',async route=>{
  const item=cache.assets[route.request().url()];if(!item)return route.continue();
  if(!/^cache\/[a-f0-9]{64}$/.test(item.file)||item.file!=='cache/'+item.sha256)throw Error('Invalid source cache path');
  const bytes=fs.readFileSync(path.join(path.dirname(file),item.file));
  if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('Cached source bytes changed');
  const name=new URL(route.request().url()).pathname;
  await route.fulfill({status:200,body:bytes,contentType:name.endsWith('.png')?'image/png':name.endsWith('.json')?'application/json':'text/plain',headers:{'access-control-allow-origin':'*'}});
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv[2]!=='--preflight')throw Error('Use --preflight');
 const scopes=JSON.parse(fs.readFileSync('data/hosted-spine-source-scopes.json','utf8')).scopes;
 const ids=new Set(scopes.flatMap(s=>s.preflightIds||[]));
 await warmSourceCache(readCharacters().filter(c=>ids.has(c.id)),'tmp/hosted-spine-browser-source/index.json');
}
