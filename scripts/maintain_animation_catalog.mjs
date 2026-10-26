// Registry-driven maintenance: source import is optional, capture is incremental.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {readCatalogRegistry,readCharacters,sourceIdentity} from './catalog_registry.mjs';
import {rendererIdentity,sha256} from './preview_capture_state.mjs';
export function parseOptions(args){
 const value=(flag,fallback)=>{const i=args.indexOf(flag);if(i<0)return fallback;if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing '+flag);return args[i+1]};
 const catalog=value('--catalog',''),jobs=Number(value('--jobs','1'));
 if(!/^[\w-]+$/.test(catalog)||!Number.isInteger(jobs)||jobs<1||jobs>4)throw Error('Use --catalog <registered-id> [--jobs 1..4]');
 const recapture=args.flatMap((arg,i)=>arg==='--recapture'?[args[i+1]]:[]);
 if(recapture.some(id=>!id||!/^[-\w]+$/.test(id)))throw Error('Invalid --recapture model ID');
 return {catalog,jobs,recapture,importSources:args.includes('--import-sources'),refreshMetadata:args.includes('--refresh-metadata'),refreshAssets:args.includes('--refresh-assets')};
}
// Read completely before responding so interrupted browser requests cannot hold
// catalog files open and block the importer's atomic replace on Windows.
export async function serveWorkspace(root){
 root=path.resolve(root);
 const server=http.createServer(async(req,res)=>{
  try{
   const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
   if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
   const real=await fs.promises.realpath(file);
   if(!real.startsWith(root+path.sep)){res.writeHead(403).end();return}
   const bytes=await fs.promises.readFile(file);
   const type={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.wasm':'application/wasm'}[path.extname(file)]||'application/octet-stream';
   res.writeHead(200,{'content-type':type,'cache-control':'no-store'}).end(bytes);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {base:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})};
}
async function run(command,args,env={},log){
 return new Promise((resolve,reject)=>{
  const stream=log?fs.createWriteStream(log):null;
  const child=spawn(command,args,{env:{...process.env,...env},stdio:stream?['ignore','pipe','pipe']:'inherit',windowsHide:true});
  if(stream){child.stdout.pipe(stream);child.stderr.pipe(stream)}
  child.on('error',reject);child.on('close',code=>{stream?.end();code===0?resolve():reject(Error(command+' failed ('+code+')'+(log?': '+log:'')))});
 });
}
export async function main(args=process.argv.slice(2)){
 const options=parseOptions(args),entry=readCatalogRegistry().find(c=>c.id===options.catalog);
 if(!entry)throw Error('Unknown catalog '+options.catalog);
 const catalogRecords=JSON.parse(fs.readFileSync(entry.path,'utf8')).characters;
 const forced=new Set(options.recapture);
 for(const id of forced)if(!catalogRecords.some(c=>c.id===id))throw Error('Recapture ID is outside selected catalog: '+id);
 const root='tmp/animation-maintenance/'+options.catalog;
 fs.mkdirSync(root,{recursive:true});
 const python=process.env.PYTHON||'python';
 const pipeline=(...args)=>run(python,['-X','utf8','scripts/preview_pipeline.py',...args,'--catalog',options.catalog]);
 const config=JSON.parse(fs.readFileSync('data/hosted-spine-source-scopes.json','utf8'));
 const scopes=config.scopes.filter(s=>(s.catalog||config.catalog)===entry.path);
 const cubismScopes=JSON.parse(fs.readFileSync('data/live2d-source-scopes.json','utf8')).scopes.filter(s=>s.catalog===entry.path&&s.import);
 if(options.importSources){
  if(!scopes.length&&!cubismScopes.length)throw Error('This catalog uses its existing source importer; source import is not configured');
  const flags=[options.refreshMetadata?'--refresh-metadata':null,options.refreshAssets?'--refresh-assets':null].filter(Boolean);
  if(cubismScopes.length&&flags.length)throw Error('Cubism source revisions are commit-pinned; update the declared source commit/snapshot instead of hosted refresh flags');
  for(const scope of scopes)await run(process.execPath,['scripts/import_hosted_spine.mjs','--scope',scope.id,...flags]);
  for(const scope of cubismScopes)await run(process.execPath,['scripts/live2d_sources.mjs','--scope',scope.id,'--import',scope.id,
   ...(scope.sourceTreeSnapshot?['--source-tree',scope.sourceTreeSnapshot]:[]),'--output','data/'+scope.gameId+'-full-inventory.json']);
 }
 const server=await serveWorkspace(process.cwd());
 const sourceCache='tmp/hosted-spine/index.json';
 const env={ARCHIVE_PREVIEW_BASE_URL:server.base,MODULE_TEST_BASE_URL:server.base,ARCHIVE_PREFLIGHT_SCOPE:scopes.map(s=>s.id).join(','),ARCHIVE_PREVIEW_SOURCE_CACHE:fs.existsSync(sourceCache)?sourceCache:''};
 try{
  // Run source representatives before starting expensive full-catalog renders.
  if(scopes.length)await run(process.execPath,['scripts/test_hosted_spine_browser.mjs'],env);
  if(cubismScopes.some(s=>s.preflightIds?.length))await run(process.execPath,['scripts/test_cubism_source_browser.mjs','--catalog',options.catalog],env);
  const batches=[];
  for(let attempt=0;attempt<2;attempt++){
   const pending=root+'/pending.json';
   await pipeline('plan','--pending',pending);
   const ids=[...new Set([...JSON.parse(fs.readFileSync(pending)),...forced])];
   fs.writeFileSync(pending,JSON.stringify(ids));
   if(!ids.length)break;
   const jobs=Math.min(ids.length,options.jobs);
   const records=new Map(readCharacters().map(c=>[c.id,c]));
   const queueIdentity=sha256(JSON.stringify([jobs,rendererIdentity(),ids.map(id=>[id,sourceIdentity(records.get(id))])])).slice(0,20);
   const batch=root+'/batch-'+queueIdentity;
   fs.mkdirSync(batch,{recursive:true});
   console.log('MAINTENANCE_CAPTURE',JSON.stringify({attempt,pending:ids.length,jobs}));
   await Promise.all(Array.from({length:jobs},(_,i)=>run(process.execPath,['scripts/repair_missing_previews.mjs',String(i),String(jobs)],{...env,ARCHIVE_PREVIEW_ROOT:batch,ARCHIVE_PREVIEW_PENDING:pending},batch+'/worker-'+i+'.log')));
   await pipeline('convert','--root',batch);
   await pipeline('publish','--incoming',batch+'/webps');
   const audit=JSON.parse(fs.readFileSync('data/preview-audits/'+options.catalog+'.json'));
   const bad=new Set([...audit.missing.map(c=>c.id),...audit.rejectedCaptures]);
   for(let i=0;i<jobs;i++){
    const report=JSON.parse(fs.readFileSync(batch+'/reports/shard-'+i+'.json'));
    for(const c of report.pass)if(!bad.has(c.id)&&fs.existsSync(batch+'/webps/'+c.gameId+'-'+c.id+'.webp'))forced.delete(c.id);
   }
   batches.push(batch);
  }
  if(!batches.length)await pipeline('publish','--incoming',root+'/empty/webps');
  await run(process.execPath,['scripts/dynamic_encyclopedia_coverage.mjs']);
  await run(process.execPath,['scripts/module_boundaries.mjs']);
  const audit=JSON.parse(fs.readFileSync('data/preview-audits/'+options.catalog+'.json'));
  const report={catalog:options.catalog,batches,missing:[...audit.missing,...[...forced].filter(id=>!audit.missing.some(c=>c.id===id)).map(id=>({id,error:'requested recapture failed'}))],counts:audit.counts};
  fs.writeFileSync(root+'/result.json',JSON.stringify(report,null,2));
  console.log('MAINTENANCE_RESULT',JSON.stringify(report));
  if(report.missing.length)throw Error('Unresolved previews: '+report.missing.length+'; see '+root+'/result.json');
 }finally{await server.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e);process.exitCode=1});
