'use strict';
 (async()=>{
 try{
  allCharacters=embeddedCharacters;
  if(location.protocol!=='file:'){try{const r=await fetch(manifestUrl,{cache:'no-store'});if(r.ok){const db=await r.json();if(Array.isArray(db.characters)&&db.characters.length)allCharacters=db.characters}}catch(e){console.warn('使用离线内嵌角色目录',e)}}
  if(location.protocol!=='file:'){
   try{
    const response=await fetch(azurlaneCatalogUrl,{cache:'no-store'});
    if(response.ok){const catalog=await response.json();if(Array.isArray(catalog.characters)){
     const known=new Set(allCharacters.map(c=>c.id));
     for(const c of catalog.characters){
      if(c.gameId==='azurlane'&&c.engine==='cubism'&&/^al-[a-z0-9_]+$/.test(c.id)&&c.modelUrl&&!known.has(c.id)){
       allCharacters.push(c);known.add(c.id);
      }
     }
    }}
   }catch(e){console.warn('碧蓝航线 Live2D 模型目录暂不可用',e)}
  }
  if(location.protocol!=='file:'){
   try{
    const response=await fetch(bd2CatalogUrl,{cache:'no-store'});
    if(response.ok){const catalog=await response.json();if(Array.isArray(catalog.characters)){
     const known=new Set(allCharacters.map(c=>c.id));
     for(const c of catalog.characters){
      if(c.gameId==='browndust2'&&c.assetType==='character-full-spine'&&c.base&&!known.has(c.id)){allCharacters.push(c);known.add(c.id)}
     }
     const roles=[...new Set(catalog.characters.map(c=>c.characterName).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'en'));
     $('bd2CharacterFilter').replaceChildren(new Option('全部角色（'+roles.length+' 人）',''),...roles.map(r=>new Option(r,r)));
    }}
   }catch(e){console.warn('棕色尘埃2完整目录暂不可用',e)}
  }
  if(location.protocol!=='file:'){
   try{
    const response=await fetch(newGamesCatalogUrl,{cache:'default'});
    if(response.ok){const catalog=await response.json();if(Array.isArray(catalog.characters)){
     const known=new Set(allCharacters.map(c=>c.id));
     for(const c of catalog.characters){
      if(!['girlsfrontline','arknights','konosuba'].includes(c.gameId)||known.has(c.id))continue;
      if((c.engine==='cubism'&&c.modelUrl)||(c.gameId==='arknights'&&c.base)){allCharacters.push(c);known.add(c.id)}
     }
    }}
   }catch(e){console.warn('新游戏动态目录暂不可用',e)}
  }
  allCharacters=uniqueAnimationEntries(allCharacters);
  refreshCharacters();
  const requested=params.get('id');if(requested&&allCharacters.some(x=>x.id===requested&&true)){const hit=allCharacters.find(x=>x.id===requested);$('gameFilter').value=hit.gameId||'nikke';refreshCharacters();$('characters').value=requested;refreshCardSelection();}
  status('已载入 '+allCharacters.length+' 条动画索引。按游戏、角色、服装筛选，点击即播放；不会一次下载全部模型。');
  if(chosen()&&params.get('id'))playCharacter(chosen());
 }catch(e){status('角色索引无法加载：'+e.message+'。请在静态服务器中打开网页，或直接导入本地资源。',true)}
})();
if(['3.8','4.0','4.1','4.2'].includes(params.get('v')))$('version').value=params.get('v');
refreshSaved().then(async()=>{const packId=params.get('pack');if(!packId)return;try{const pack=await dbAction('readonly',s=>s.get(packId));if(pack){$('savedPacks').value=packId;$('savedPacks').onchange();playPack(pack)}else status('本地缓存中找不到 '+packId,true)}catch(e){status('读取本地缓存失败：'+e.message,true)}});
