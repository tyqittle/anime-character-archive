(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ArchiveCubismMotions=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function filename(def){return String(def?.File||def?.file||'').split('/').pop().replace(/\.motion3?\.json$|\.mtn$/i,'')}
 function idleScore(group,def){
  const exported=filename(def).toLowerCase(),name=exported.replace(/\.anim$/,''),tokens=(group+' '+name).toLowerCase().split(/[^a-z0-9]+/);
  const ranks={idle:100,daiji:100,stand:90,breath:85,breathe:85,wait:80,default:70,normal:65,home:60,main:50};
  let score=0;for(const token of tokens)score=Math.max(score,ranks[token]||0);
  if(/(?:^|_)(?:idle|stand|breath|wait)$/.test(name))score+=4;
  if(exported.endsWith('.anim')&&['idle','stand','breath','wait'].includes(name))score+=20;
  return score;
 }
 function plan(definitions={}){
  const entries=[],byKey=new Map();
  for(const [group,items] of Object.entries(definitions)){
   if(!Array.isArray(items))continue;
   const seen=new Set();
   items.forEach((definition,index)=>{
    const file=definition?.File||definition?.file;
    if(typeof file!=='string'||!file)return;
    // Equal texture/motion paths can carry different sound or fade metadata.
    const signature=JSON.stringify(Object.fromEntries(Object.entries(definition).sort(([a],[b])=>a.localeCompare(b))));
    if(seen.has(signature))return;seen.add(signature);
    const key=group===''?'@motion:'+index:index===0?group:'@motion:'+encodeURIComponent(group)+':'+index;
    const entry={key,group,index,definition,label:filename(definition)||group,score:idleScore(group,definition)};
    if(byKey.has(key))throw Error('Ambiguous Cubism motion key: '+key);
    entries.push(entry);byKey.set(key,entry);
   });
  }
  const initial=entries.reduce((best,e)=>!best||e.score>best.score?e:best,null);
  return {entries,byKey,initial};
 }
 function install({manager,priorities={IDLE:1,NORMAL:2,FORCE:3},isCurrent=()=>true,onChange=()=>{},onError=()=>{},timeoutMs=20000}){
  const originalDefinitions=manager.definitions||{},originalCreate=manager.createMotion;
  const selection=plan(originalDefinitions),alias='__archive_idle';
  if(Object.hasOwn(originalDefinitions,alias))throw Error('Reserved motion group: '+alias);
  const initial=selection.initial,previousIdle=manager.groups?.idle;
  let disposed=false,serial=0,cancelPending=null,playbackOverride=null;
  function restorePlayback(){
   if(!playbackOverride)return;
   const {clip,loop}=playbackOverride;playbackOverride=null;
   clip.setIsLoop(loop);delete clip._archivePlaybackMode;
  }
  const current=()=>!disposed&&!manager.destroyed&&isCurrent();
  function applyLoop(motion,data){
   // The pinned Cubism renderer parses Meta.Loop but never copies it to
   // CubismMotion._isLoop. Honor the source flag through the public runtime API.
   const loop=data?.Meta?.Loop??motion?._motionData?.loop;
   const duration=data?.Meta?.Duration??motion?._motionData?.duration;
   // Empty expression clips can declare Loop=true with Duration=0. Looping
   // them makes the native Cubism time-wrap loop subtract zero indefinitely.
   if(typeof loop==='boolean'&&typeof motion?.setIsLoop==='function')motion.setIsLoop(loop&&!(typeof duration==='number'&&duration<=0));
   return motion;
  }
  function create(data,group,definition){return applyLoop(originalCreate.call(this,data,group,definition),data)}
  if(typeof originalCreate==='function')manager.createMotion=create;
  for(const list of Object.values(manager.motionGroups||{}))for(const m of list||[])if(m)applyLoop(m);
  if(initial){
   const idleDefinition={...initial.definition};delete idleDefinition.Sound;delete idleDefinition.sound;
   manager.definitions={...originalDefinitions,[alias]:[idleDefinition]};
   manager.motionGroups=manager.motionGroups||{};manager.motionGroups[alias]=[];
   manager.groups=manager.groups||{};manager.groups.idle=alias;
  }
  const started=(group,index)=>{
   if(!current())return;
   if(playbackOverride?.group===group&&playbackOverride.index===index)playbackOverride.started=true;
   if(group===alias&&playbackOverride?.started)restorePlayback();
   const entry=group===alias?initial:selection.entries.find(e=>e.group===group&&e.index===index);
   if(entry)onChange(entry.key);
  };
  const finished=()=>{if(playbackOverride?.started)restorePlayback()};
  manager.on?.('motionStart',started);
  manager.on?.('motionFinish',finished);
  return {
   entries:selection.entries,initialKey:initial?.key||'',idleKind:initial?(initial.score>0?'identified':'fallback'):'none',
   async play(key,priority=priorities.FORCE??3,{mode='source',restart=false}={}){
    const entry=selection.byKey.get(key);if(!entry||!current())return false;
    cancelPending?.();const ticket=++serial;
    let timer,cancel,expired=false;
    const canceled=new Promise(resolve=>{cancel=()=>resolve(false);cancelPending=cancel});
    if(!restart&&mode==='source'&&manager.state?.currentGroup===entry.group&&manager.state?.currentIndex===entry.index){cancelPending=null;return true}
    try{
     const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{
      expired=true;
      if(current()&&ticket===serial)manager.stopAllMotions?.();
      reject(Error('动作请求超时'));
     },timeoutMs)});
     const start=async()=>{
      // Load without reserving native playback. Only the latest request may
      // commit, even when an older motion download finishes successfully late.
      const clip=typeof manager.loadMotion==='function'?await manager.loadMotion(entry.group,entry.index):null;
      if(!current()||ticket!==serial||expired)return false;
      restorePlayback();
      if(restart&&manager.state?.currentGroup===entry.group&&manager.state?.currentIndex===entry.index)manager.stopAllMotions?.();
      if(clip&&typeof clip.setIsLoop==='function'&&typeof clip.isLoop==='function'&&['once','loop'].includes(mode)){
       const duration=clip.getLoopDuration?.()??clip._motionData?.duration;
       playbackOverride={clip,loop:clip.isLoop(),group:entry.group,index:entry.index,started:false};clip.setIsLoop(mode==='loop'&&!(typeof duration==='number'&&duration<=0));clip._archivePlaybackMode=mode;
      }
      const ok=await manager.startMotion(entry.group,entry.index,priority);
      if(!ok&&current()&&ticket===serial)restorePlayback();
      return ok;
     };
     const ok=await Promise.race([start(),canceled,timeout]);
     if(current()&&ticket===serial&&!ok)onError('动作未能启动：'+entry.label);
     return current()&&ticket===serial&&!!ok;
    }catch(error){if(current()&&ticket===serial){restorePlayback();onError('动作加载失败：'+entry.label+'：'+error.message)}return false}
    finally{clearTimeout(timer);if(cancelPending===cancel)cancelPending=null}
   },
   async start(){return initial?this.play(initial.key,priorities.IDLE??1):false},
   dispose(){
    if(disposed)return;disposed=true;++serial;cancelPending?.();cancelPending=null;restorePlayback();manager.off?.('motionStart',started);manager.off?.('motionFinish',finished);
    if(manager.createMotion===create)manager.createMotion=originalCreate;
    if(initial&&manager.definitions?.[alias]){
     manager.definitions=originalDefinitions;delete manager.motionGroups?.[alias];
     if(manager.groups?.idle===alias)manager.groups.idle=previousIdle;
    }
   }
  };
 }
 return {plan,idleScore,install};
});
