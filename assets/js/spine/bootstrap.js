'use strict';
// A single engine-based validation and merge path for every game catalog.
// Fetch all manifests concurrently; each game contributes records, not bespoke
// front-end initialization logic.
function isPlayableAnimationEntry(c){
 if(!c||typeof c!=='object'||typeof c.id!=='string'||!c.id||
    typeof c.name!=='string'||!c.name||typeof c.gameId!=='string'||!c.gameId)return false;
 if(c.engine==='cubism')return typeof c.modelUrl==='string'&&/^https:\/\//.test(c.modelUrl);
 return typeof c.base==='string'&&/^https:\/\//.test(c.base)&&
   (c.skeletonFormat!=='json'||(typeof c.skeletonUrl==='string'&&typeof c.atlasUrl==='string'));
}
// Catalogs can change after background imports. Revalidate their HTTP cache
// so restored art and previews appear without a manual hard refresh.
// A stalled manifest must never block the other games indefinitely.
async function fetchAnimationManifest(url){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(url,{cache:'no-cache',signal:controller.signal});
  if(!response.ok)throw Error('HTTP '+response.status);
  const payload=await response.json();
  if(!Array.isArray(payload.characters))throw Error('目录结构不完整');
  return payload.characters;
 }catch(error){
  if(error?.name==='AbortError')throw Error('目录加载超过 12 秒');
  throw error;
 }finally{
  clearTimeout(timeout);
 }
}
(async()=>{
 try{
  const entries=[
   {name:'主要动画',url:manifestUrl},
   {name:'碧蓝航线',url:azurlaneCatalogUrl},
   {name:'棕色尘埃2',url:bd2CatalogUrl},
   {name:'扩展游戏',url:newGamesCatalogUrl},
   {name:'明日方舟干员动态立绘',url:arknightsIllustCatalogUrl}
  ];
  const results=location.protocol==='file:'?[]:
   await Promise.allSettled(entries.map(entry=>fetchAnimationManifest(entry.url)));
  const primary=results[0]?.status==='fulfilled'?results[0].value:[];
  const merged=primary.length?[]:[...embeddedCharacters];
  const known=new Set(merged.map(c=>c.id));
  const accepted={};
  for(let i=0;i<results.length;i++){
   const outcome=results[i],name=entries[i].name;
   if(outcome.status!=='fulfilled'){
    console.warn(name+'目录不可用，其他游戏仍正常载入',outcome.reason);
    continue;
   }
   for(const c of outcome.value){
    if(!isPlayableAnimationEntry(c)||known.has(c.id))continue;
    merged.push(c);
    known.add(c.id);
    accepted[c.gameId]=(accepted[c.gameId]||0)+1;
   }
  }
  allCharacters=uniqueAnimationEntries(merged);
  const roles=[...new Set(allCharacters.filter(c=>c.gameId==='browndust2').map(c=>c.characterName).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'en'));
  $('bd2CharacterFilter').replaceChildren(new Option('全部角色（'+roles.length+' 人）',''),
    ...roles.map(name=>new Option(name,name)));
  refreshCharacters();
  const requested=params.get('id');
  const hit=requested&&allCharacters.find(c=>c.id===requested);
  if(hit){
   $('gameFilter').value=animationCollection(hit);
   refreshCharacters();
   selectCharacter(hit);
   refreshCardSelection();
  }
  status('已载入 '+allCharacters.length+' 条动画索引，覆盖 '+Object.keys(accepted).length+
    ' 个在线游戏目录。点击角色即可播放，模型按需下载。');
  if(hit&&chosen())playCharacter(chosen());
 }catch(e){
  status('角色索引初始化失败：'+(e.message||String(e))+'。可重新加载或通过本地文件导入。',true);
 }
})();
if(['3.8','4.0','4.1','4.2'].includes(params.get('v')))$('version').value=params.get('v');
refreshSaved().then(async()=>{
 const packId=params.get('pack');if(!packId||params.get('id'))return;
 const current=sequence;
 try{
  const pack=await dbAction('readonly',s=>s.get(packId));
  if(current!==sequence)return;
  if(pack){
   $('savedPacks').value=packId;
   await $('savedPacks').onchange();
  }else status('本地缓存中找不到 '+packId,true);
 }catch(e){if(current===sequence)status('读取本地缓存失败：'+e.message,true)}
});

