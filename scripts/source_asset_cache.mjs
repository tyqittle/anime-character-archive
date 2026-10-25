// Optional test/capture acceleration using the exact source bytes downloaded by
// the importer. This never substitutes previews or another model's assets.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
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
