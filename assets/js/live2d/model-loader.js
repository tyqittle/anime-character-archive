'use strict';
function motion(name){
 if(!model||typeof name!=='string')return;
 try{
  if(name.startsWith('@motion:')){
   const i=Number(name.slice(8));
   if(!Number.isSafeInteger(i)||!model.internalModel?.motionManager?.definitions?.['']?.[i])return;
   model.motion('',i,PIXI.live2d.MotionPriority.NORMAL);
  }else if(name)model.motion(name,0,PIXI.live2d.MotionPriority.NORMAL);
  else return;
  notify('motion',{name});
 }catch(e){notify('error',{error:'无法播放动作 '+name+'：'+e.message})}
}
async function load(name,id,modelUrl){
 if(!verifyName(name)||!/^(?:al|gf|ks)-[a-z0-9_-]+$/.test(id)||(id.startsWith('al-')&&id!=='al-'+name.toLowerCase())){notify('error',{error:'无效的 Live2D 模型编号'});return}
 const generation=++currentGeneration;
 currentId=id;readyId='';loadStartedAt=performance.now();
 zoom=1;offsetX=0;offsetY=0;
 if(model){try{app.stage.removeChild(model);model.destroy()}catch(e){}model=null}
 if(!app){notify('error',{error:initError||'Live2D 渲染库尚未加载'});return}
 message('正在加载 '+name+' 的 Cubism 模型与动作…');
 if(app?.ticker)app.ticker.stop();
 const url=modelUrlFor(name,modelUrl,id);
 if(!url){message('模型来源未被收录');notify('error',{error:'模型地址未通过来源校验'});return}
 let next;
 try{
  // Many skins define dozens of idle motions. Preloading all of them floods
  // the network and delays textures. Fetch motions only when actually selected.
  next=PIXI.live2d.Live2DModel.fromSync(url,{motionPreload:'NONE'});
  if(!next||!next.once)throw Error('Live2D 模型加载器未初始化');
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('模型加载超时（90 秒）')),90000);
   next.once('load',()=>{clearTimeout(timer);resolve()});
   next.once('error',e=>{clearTimeout(timer);reject(e instanceof Error?e:Error(String(e)))});
  });
  if(generation!==currentGeneration){next.destroy();return}
  model=next;readyId=id;app.stage.addChild(model);
  model.interactive=true;
  fit();
  const defs=model.internalModel?.motionManager?.definitions||{};
  const actions=[],motionLabels={};
  for(const [group,items] of Object.entries(defs)){
   if(!Array.isArray(items)||!items.length)continue;
   if(group===''){
    items.forEach((m,index)=>{
     const key='@motion:'+index;
     actions.push(key);
     motionLabels[key]=String(m.File||m.file||('动作 '+(index+1))).split('/').pop().replace(/\.motion3\.json$/,'');
    });
   }else{actions.push(group);motionLabels[group]=group;}
  }
  const initial=actions.find(x=>/^(idle|home|login|main_1)$/i.test(x))
   ||actions.find(x=>/^(?:00_Wait|idle|daiji)/i.test(motionLabels[x]||''))||actions[0]||'';
  if(model.internalModel?.motionManager&&defs.idle)model.internalModel.motionManager.groups.idle='idle';
  if(initial){
   if(initial.startsWith('@motion:'))model.motion('',Number(initial.slice(8)),PIXI.live2d.MotionPriority.FORCE);
   else model.motion(initial,0,PIXI.live2d.MotionPriority.FORCE);
  }
  model.on('hit',areas=>{if(Array.isArray(areas)&&areas.length){const a=areas[0];if(actions.includes(a))motion(a)}});
  const p=(evt)=>{if(!model)return;const pt=evt?.data?.global;if(!pt)return;model.dragging=true;model.dragX=pt.x-model.x;model.dragY=pt.y-model.y};
  model.on('pointerdown',p);
  model.on('pointermove',evt=>{if(model?.dragging&&evt?.data?.global){model.x=evt.data.global.x-model.dragX;model.y=evt.data.global.y-model.dragY}});
  for(const ev of ['pointerup','pointerupoutside'])model.on(ev,()=>{if(model)model.dragging=false});
  warn.hidden=true;
  if(!document.hidden&&app?.ticker)app.ticker.start();
  notify('playing',{motions:actions,motionLabels,selectedMotion:initial,zoom,loadMs:Math.round(performance.now()-loadStartedAt),fpsCap:targetFPS,graphics:graphicsReport()});
 }catch(e){try{next?.destroy()}catch(_){}if(generation!==currentGeneration)return;model=null;readyId='';message('模型加载失败：'+(e?.message||String(e)));notify('error',{error:'模型加载失败：'+(e?.message||String(e))})}
}
