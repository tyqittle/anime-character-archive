// Rebuild the encyclopedia backlog from registered models and actual source audits.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {readCharacters,sourceIdentity} from './catalog_registry.mjs';
export function buildCoverage(records,inventories,spineScopes,spineAudits,hostedAudits=[]){
 const games=[...new Set(records.map(c=>c.gameId))];
 return {schemaVersion:1,scope:'All dynamic character portraits and all skins; no static fallbacks',
  note:'Source settings may include aliases or scenes. A complete public directory does not establish current-game completeness. Missing source assets and pending browser previews remain unresolved.',
  games:games.map(gameId=>{
   const all=records.filter(c=>c.gameId===gameId),portraits=all.filter(c=>c.assetType!=='battle-spine');
   const scopes=inventories.filter(s=>s.gameId===gameId).map(s=>({sourceRepo:s.sourceRepo,sourceCommit:s.sourceCommit,directory:s.directory,
    discoveredSettings:s.sourceModelSettings??null,indexedSettings:s.indexedModelSettings??null,
    unindexedSettings:s.unindexedSourceSettings||[],error:s.error||null,sourceDirectoryComplete:!!s.scopeComplete}));
   for(const scope of spineScopes.filter(s=>s.gameId===gameId)){
    const audit=spineAudits[scope.id];
    scopes.push({sourceRepo:scope.sourceRepo,sourceCommit:scope.sourceCommit,directory:scope.treePrefix+scope.directory,
     wholeDirectoryDiscovered:!!scope.includeAllModels,discoveredSettings:audit?.selected??null,indexedSettings:audit?.checked??null,
     failures:audit?.failed||[],unresolvedExclusions:audit?.qualityExclusions||[],
     sourceDirectoryComplete:!!scope.includeAllModels&&!!audit&&audit.failed.length===0&&audit.qualityExclusions.length===0});
   }
   for(const audit of hostedAudits.filter(s=>s.gameId===gameId))scopes.push({sourceUrl:audit.source,metadataSnapshot:audit.metadataSnapshot,
    metadataSha256:audit.metadataSha256,discoveredSettings:audit.discovered,indexedSettings:audit.indexed,
    failures:audit.failures,staticSources:audit.staticSources||[],...(audit.scopeExcluded?.length?{scopeExcluded:audit.scopeExcluded,declaredPortraitScopeComplete:audit.declaredPortraitScopeComplete}:{}),sourceDirectoryComplete:audit.sourceScopeComplete});
   return {gameId,indexedPortraits:portraits.length,battleModels:all.length-portraits.length,
    matchingPreviewMetadata:portraits.filter(c=>c.previewSha256&&JSON.stringify(c.previewSourceIdentity)===JSON.stringify(sourceIdentity(c))).length,
    gameCompleteness:'not-verified',sourceScopes:scopes};
  })};
}
export function main(args=process.argv.slice(2)){
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const spine=read('data/spine-source-scopes.json').scopes;
 const audits=Object.fromEntries(spine.map(s=>{const p='data/spine-source-audit-'+s.id+'.json';return [s.id,fs.existsSync(p)?read(p):null]}));
 const inventoryPaths=['data/live2d-full-inventory.json',...fs.readdirSync('data').filter(name=>name.endsWith('-full-inventory.json')&&name!=='live2d-full-inventory.json').sort().map(name=>'data/'+name)];
 for(let i=0;i<args.length;i++){
  if(args[i]!=='--inventory'||!args[i+1])throw Error('Expected --inventory FILE');
  inventoryPaths.push(args[++i]);
 }
 const inventories=new Map();
 for(const file of inventoryPaths)for(const scope of read(file).scopes){
  const identity=JSON.stringify([scope.gameId,scope.sourceRepo,scope.sourceCommit,scope.directory]);
  inventories.set(identity,scope);
 }
 const hostedPath='data/hosted-spine-source-scopes.json';
 const hosted=fs.existsSync(hostedPath)?read(hostedPath).scopes.flatMap(scope=>{const p='data/hosted-spine-source-audit-'+scope.id+'.json';return fs.existsSync(p)?[read(p)]:[]}):[];
 const report=buildCoverage(readCharacters(),[...inventories.values()],spine,audits,hosted);
 fs.writeFileSync('data/dynamic-encyclopedia-coverage.json',JSON.stringify(report,null,2)+'\n');
 const lines=['# 动态立绘图鉴覆盖与缺项','',
  '用户范围：每款游戏的全部动态角色立绘及全部皮肤，不用静态图片补数，不以精选样本代替完整图鉴。',
  '', '下表中的模型数与源配置数不是角色总数。公开资源仓库可能落后于游戏、含重复配置或场景；尚无一款因本报告而被认定为游戏全集完整。', '',
  '| 游戏 ID | 已索引角色立绘 | 对应来源的预览元数据 | 已核对源配置 / 源中已索引配置 |',
  '| --- | ---: | ---: | --- |'];
 for(const g of report.games){
  const scope=g.sourceScopes.map(s=>(s.discoveredSettings??'?')+' / '+(s.indexedSettings??'?')).join('; ')||'尚未核对完整来源';
  lines.push('| '+g.gameId+' | '+g.indexedPortraits+' | '+g.matchingPreviewMetadata+' | '+scope+' |');
 }
 lines.push('', '完整缺项路径、源缺失和原始错误见 [覆盖数据](../data/dynamic-encyclopedia-coverage.json)。预览状态与源目录覆盖是两项独立验收。', '',
  '复现：先执行 `node scripts/live2d_sources.mjs --inventory-only --whole-directory --output data/live2d-full-inventory.json`，再执行 `node scripts/dynamic_encyclopedia_coverage.mjs`。', '',
  '现有精选范围和无法获得的资源仍属于待办，不因完成某一批导入就关闭整个图鉴补全目标。');
 fs.writeFileSync('docs/DYNAMIC_ENCYCLOPEDIA_COVERAGE.md',lines.join('\n')+'\n');
 console.log('DYNAMIC_ENCYCLOPEDIA_GAMES',report.games.length);
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main();
