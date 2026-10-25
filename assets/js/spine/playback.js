'use strict';
async function playCharacter(c){
 window.ArchiveDesktopBridge?.loading();
 if(c.engine==='cubism'||c.gameId==='azurlane'){playAzurLane(c);return}
 const budget=spineDownloadBudget(c);
 cancelCharacterDownload();
 const current=sequence,controller=new AbortController();
 activeCharacterAbort=controller;
 const deadline=setTimeout(()=>{
  if(current!==sequence)return;
  cancelCharacterDownload();clearPlayer();
  status('加载超过 '+Math.ceil(budget.totalMs/1000)+' 秒，请点击“重试”或稍后再试。',true);
 },budget.totalMs);
 window.ArchiveTheaterUI.setHeading((c.zh?c.zh+' · ':'')+c.name);
 window.ArchiveTheaterUI.setContext(c.gameId==='browndust2'?'棕色尘埃2 · 全身角色':c.gameId==='bluearchive'?'蔚蓝档案 · 回忆大厅':c.gameId==='konosuba'?'为美好的世界献上祝福！· 战斗动画':c.gameId==='arknights'?'明日方舟 · '+(c.assetType==='battle-spine'?'战斗小人':'干员动态立绘'):(c.collectionName||c.game||'胜利女神：妮姬')+' · Spine');
 // Do not leave the previously selected character playing while downloading
 // a different skeleton; the stage now shows a dedicated loading notice.
 clearPlayer();
 if(c.versionUnverified)status('尝试播放尚未确认版本的动画；如果失败将报告实际加载错误。');
 // Read the .skel header before choosing the matching runtime.
 const packId=(c.gameId||'nikke')+'-'+c.id;
 status((c.versionUnverified?'该资源骨骼版本尚未验证，可能无法播放。':'')+'正在查找 '+c.name+' 的本地缓存…');
 try{
  let pack=recentSpinePack(packId);
  if(!pack)pack=await dbAction('readonly',s=>s.get(packId)).catch(()=>null);
  if(pack&&!isCachedPackFor(c,pack)){
   // Source revisions and pack schema changes must invalidate old disk/RAM data.
   await dbAction('readwrite',store=>store.delete(packId)).catch(()=>{});
   pack=null;
  }
  if(pack){
   if(current!==sequence)return;
   status('已找到经版本检测的本地缓存：Spine '+pack.exportVersion);
   rememberSpinePack(pack);
   try{await playPack(pack);return}
   catch(e){
    if(current!==sequence)return;
    forgetSpinePack(packId);
    await dbAction('readwrite',store=>store.delete(packId)).catch(()=>{});
    pack=null;
   }
  }
  let failure='';
  for(const mirror of (c.gameId==='nikke'?['github','legacy']:['github'])){
   if(current!==sequence)return;
   try{
    status('正在从 '+(mirror==='github'?'原始素材目录':'备用镜像')+'读取 '+c.name+' 的完整动画文件…');
    pack=await downloadPack(c,mirror,controller.signal,()=>current===sequence);
    if(current!==sequence)return;
    // Display immediately, then retain only a bounded in-memory hot pack.
    await playPack(pack);
    if(current!==sequence)return;
    rememberSpinePack(pack);
    if(current!==sequence)return;
    const saveForRepeat=()=>dbAction('readwrite',s=>s.put(pack)).then(()=>refreshSaved())
      .catch(e=>console.warn('缓存写入失败（不会影响当前播放）',e));
    if('requestIdleCallback' in window)requestIdleCallback(saveForRepeat,{timeout:6000});
    else setTimeout(saveForRepeat,1800);
    return;
   }catch(e){forgetSpinePack(packId);failure+=mirror+'：'+(e.message||e)+'；';if(controller.signal.aborted)break;}
  }
  if(current===sequence)status('角色资源下载失败。'+failure+'可点击“重试”或选择本地导入已获得的动画文件。',true);
 }catch(e){if(current===sequence)status('播放失败：'+(e.message||String(e)),true)}
 finally{clearTimeout(deadline);if(activeCharacterAbort===controller)activeCharacterAbort=null}
}

