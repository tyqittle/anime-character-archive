// Reusable orchestration for a pinned source-import batch.
// Source validation and catalog merging are owned by live2d_sources.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const manifest=read('data/live2d-import-batch.json');
const scopes=read('data/live2d-source-scopes.json').scopes;
const catalogPath=manifest.catalog||'data/live2d-games-wave3.json';
const auditPath=manifest.audit||'data/live2d-games-wave3-source-audit.json';
if(!/^data\/live2d-games-wave[0-9]+\.json$/.test(catalogPath)||!/^data\/live2d-games-wave[0-9]+-source-audit\.json$/.test(auditPath)||catalogPath.replace(/\.json$/, '-source-audit.json')!==auditPath)throw Error('Invalid batch catalog and audit destinations');
if(manifest.schemaVersion!==1||!Array.isArray(manifest.scopes)||!manifest.scopes.length||new Set(manifest.scopes).size!==manifest.scopes.length)throw Error('Invalid source import batch');
const reports=[];
fs.mkdirSync(new URL('../tmp',import.meta.url),{recursive:true});
for(const id of manifest.scopes){
 if(!/^[a-z0-9-]+$/.test(id))throw Error('Invalid scope ID');
 const scope=scopes.find(s=>s.id===id&&s.import);
 if(!scope||scope.catalog!==catalogPath)throw Error('Scope not in selected shared catalog: '+id);
 const reportPath='tmp/new-game-source-'+id+'.json';
 const result=spawnSync(process.execPath,['scripts/live2d_sources.mjs','--scope',id,'--import',id,'--output',reportPath],{cwd:new URL('../',import.meta.url),stdio:'inherit',timeout:900000});
 const report=fs.existsSync(new URL(reportPath,root))?read(reportPath).scopes[0]:null;
 reports.push({scope:id,gameId:scope.gameId,sourceRepo:scope.sourceRepo,sourceCommit:scope.sourceCommit,
  selectedModelSettings:report?.sourceModelSettings||0,checkedModels:report?.checkedModels||0,
  rejectedModels:report?.failedModels||[],error:report?.error||result.error?.message||null,
  importerExitCode:result.status,completeWithinSelectedScope:report?.scopeComplete||false});
}
const catalog=read(catalogPath);
const games=Object.fromEntries([...new Set(reports.map(x=>x.gameId))].map(gameId=>[gameId,catalog.characters.filter(c=>c.gameId===gameId).length]));
const audit={schemaVersion:1,scope:'Pinned source checks for '+manifest.batch+' (not WebGL playback)',games,total:catalog.characters.length,reports};
fs.writeFileSync(new URL(auditPath,root),JSON.stringify(audit,null,2)+'\n');
console.log('NEW_GAME_SOURCE_IMPORT',JSON.stringify({games,total:audit.total,rejected:reports.reduce((n,x)=>n+x.rejectedModels.length,0),errors:reports.filter(x=>x.error)}));
const minModels=manifest.minimumModels??20;
if(!Number.isInteger(minModels)||minModels<1||minModels>1000)throw Error('Invalid batch minimum model count');
if(reports.some(x=>x.error)||reports.some(x=>x.importerExitCode!==0&&x.completeWithinSelectedScope!==true)||Object.values(games).some(n=>n<1)||audit.total<minModels)throw Error('Source import failed minimum batch checks; do not publish');
