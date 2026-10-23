// Source diagnostics for generic Cubism playback, alpha and original geometry.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {readCharacters} from './catalog_registry.mjs';
const strict=process.argv.includes('--check');
const chars=readCharacters(),ids=[
 'gf-live2dnew_ak12_2402_normal_normal-e834d86',
 'gf-live2dnew_airborne_1_1-f60af2c',
 'gc-girl02-l2d04','gc-girl01-l2d00','fh-ruri_miko',
 ...chars.filter(c=>c.gameId==='foxhimezero'&&c.id!=='fh-ruri_miko').map(c=>c.id),
 'al-bulaimodun_2','gd-001-c_0005'
];
const executablePath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 for(const id of ids){
  const c=chars.find(c=>c.id===id);if(!c)throw Error('Missing '+id);
  const item={id};report.push(item);
  try{
   await page.goto('http://127.0.0.1:8765/spine.html?id='+id,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>/正在播放：|失败|超时/.test(document.querySelector('#status')?.textContent||''),null,{timeout:100000});
   item.status=await page.locator('#status').textContent();
   if(!item.status.startsWith('正在播放：')){if(strict)throw Error(item.status);continue;}
   const child=page.frames().find(f=>f.url().includes('azurlane-stage.html'));
   await child.waitForFunction(()=>model&&readyId);
   await page.waitForTimeout(500);
   if(strict)await child.waitForFunction(()=>model._archiveFraming?.source==='rendered-pixels',null,{timeout:10000});
   item.info=await child.evaluate(()=>{
    const gl=app.renderer.gl,im=model.internalModel,cm=im.coreModel,draw=cm._model?.drawables;
    const local=model.getLocalBounds();
    const drawables=(im.getDrawableIDs?.()||[]).map((id,i)=>({id,i,bounds:{...im.getDrawableBounds(i)},alpha:draw?.opacities?.[i]}));
    return {pixi:PIXI.VERSION,context:gl.getContextAttributes(),renderer:{transparent:app.renderer.transparent,backgroundAlpha:app.renderer.backgroundAlpha,clearBeforeRender:app.renderer.clearBeforeRender,backgroundColor:app.renderer.backgroundColor},
     css:{html:getComputedStyle(document.documentElement).backgroundColor,body:getComputedStyle(document.body).backgroundColor},
     local:{x:local.x,y:local.y,width:local.width,height:local.height},position:[model.x,model.y],scale:model.scale.x,
     framing:model._archiveFraming,definitions:im.motionManager.definitions,
     drawableCount:drawables.length,largest:drawables.sort((a,b)=>b.bounds.width*b.bounds.height-a.bounds.width*a.bounds.height).slice(0,6),
     motionPolicy:model._archiveMotionPolicy,geometry:portraitGeometryBounds,
     motionGroups:im.motionManager.groups,loops:Object.entries(im.motionManager.motionGroups||{}).map(([g,list])=>({g,loaded:list.map((m,i)=>m?{i,sourceLoop:m._motionData?.loop,runtimeLoop:m.isLoop?.(),duration:m.getLoopDuration?.()}:null).filter(Boolean)}))};
   });
   item.pixels=await child.evaluate(()=>new Promise(resolve=>{
    app.ticker.addOnce(()=>{
     const gl=app.renderer.gl,p=new Uint8Array(16);
     gl.readPixels(0,0,2,2,gl.RGBA,gl.UNSIGNED_BYTE,p);
     const c=document.createElement('canvas');c.width=app.view.width;c.height=app.view.height;c.getContext('2d').drawImage(app.view,0,0);
     resolve({corner:Array.from(p),image:c.toDataURL('image/jpeg',.45).split(',')[1]});
    },null,-200);
   }));
   const data=item.pixels.image;delete item.pixels.image;
   console.log('CUBISM_IMAGE_START '+id);
   for(let i=0;i<data.length;i+=12000)console.log('CUBISM_IMAGE_CHUNK '+data.slice(i,i+12000));
   console.log('CUBISM_IMAGE_END');
   if(strict){
    assert.equal(item.info.renderer.backgroundAlpha,1,'Web mode must clear the canvas explicitly');
    assert.deepEqual(item.pixels.corner.slice(0,4),[20,34,56,255],'Opaque stage clear must match the page theme, including masked rigs');
    for(const group of item.info.loops)for(const motion of group.loaded)
     if(typeof motion.sourceLoop==='boolean')assert.equal(motion.runtimeLoop,motion.sourceLoop,'Dropped source loop flag '+id);
    item.continuity=await child.evaluate(async()=>{
     const m=model,manager=m.internalModel.motionManager,p=manager.state;
     const starts=[];const onStart=(g,i)=>starts.push([g,i]);manager.on('motionStart',onStart);
     app.ticker.stop();
     const current=manager.motionGroups[p.currentGroup]?.[p.currentIndex];
     const duration=Number(current?.getLoopDuration?.())||2;
     // Advance the actual model clock through two full source cycles. These
     // are real Cubism updates/renders, with no mocked successful animation.
     const frames=Math.min(800,Math.ceil((duration*2+1)*10));
     for(let i=0;i<frames;i++){
      m.update(100);app.renderer.render(app.stage);
      if(i%10===0)await new Promise(r=>setTimeout(r,0));
     }
     const result={duration,advancedSeconds:frames/10,finished:manager.isFinished(),playing:manager.playing,
      starts,actionCount:frameMotionController.entries.length,zoom,offsetX,offsetY};
     manager.off('motionStart',onStart);app.ticker.start();return result;
    });
    if(item.continuity.actionCount)assert.ok(item.continuity.playing&&!item.continuity.finished,'Model froze after source cycles '+id+' '+JSON.stringify(item.continuity));
    const actions=await page.locator('#animationPicker option').count();
    if(actions>1){
     await page.locator('#zoomIn').click();
     await child.waitForFunction(()=>zoom>1,null,{timeout:5000});
     const before=await child.evaluate(()=>({zoom,offsetX,offsetY}));
     await page.locator('#animationPicker').selectOption({index:1});
     await page.waitForTimeout(200);
     await page.locator('#animationPicker').selectOption({index:0});
     await page.waitForTimeout(200);
     const after=await child.evaluate(()=>({zoom,offsetX,offsetY}));
     assert.deepEqual(after,before,'Actions changed the portrait camera');
     const selected=await page.locator('#animationPicker').inputValue();
     const actual=await child.evaluate(()=>{
      const manager=model.internalModel.motionManager,entry=frameMotionController.entries.find(e=>e.group===manager.state.currentGroup&&e.index===manager.state.currentIndex);
      return entry?.key||frameMotionController.initialKey;
     });
     assert.equal(actual,selected,'A second user action was rejected by motion priority');
    }
   }else{
    await page.waitForTimeout(7000);
    item.after=await child.evaluate(()=>({playing:model.internalModel.motionManager.playing,finished:model.internalModel.motionManager.isFinished(),
     idle:model.internalModel.motionManager.groups.idle,state:model.internalModel.motionManager.state}));
   }
  }catch(e){item.error=e.message}
  console.log('CUBISM_DIAGNOSTIC '+JSON.stringify(item));
  if(strict&&item.error)throw Error(item.id+': '+item.error);
 }
}finally{fs.writeFileSync('/tmp/cubism-behavior-diagnostics.json',JSON.stringify(report,null,2));await browser.close()}
