// Source diagnostics for generic Cubism playback, alpha and original geometry.
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {readCharacters} from './catalog_registry.mjs';
const chars=readCharacters(),ids=[
 'gf-live2dnew_ak12_2402_normal_normal-e834d86',
 'gf-live2dnew_airborne_1_1-f60af2c',
 'gc-girl02-l2d04','gc-girl01-l2d00','fh-ruri_miko'
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
   if(!item.status.startsWith('正在播放：'))continue;
   const child=page.frames().find(f=>f.url().includes('azurlane-stage.html'));
   await child.waitForFunction(()=>model&&readyId);
   await page.waitForTimeout(500);
   item.info=await child.evaluate(()=>{
    const gl=app.renderer.gl,im=model.internalModel,cm=im.coreModel,draw=cm._model?.drawables;
    const local=model.getLocalBounds();
    const drawables=(im.getDrawableIDs?.()||[]).map((id,i)=>({id,i,bounds:{...im.getDrawableBounds(i)},alpha:draw?.opacities?.[i]}));
    return {pixi:PIXI.VERSION,context:gl.getContextAttributes(),renderer:{transparent:app.renderer.transparent,backgroundAlpha:app.renderer.backgroundAlpha,clearBeforeRender:app.renderer.clearBeforeRender,backgroundColor:app.renderer.backgroundColor},
     css:{html:getComputedStyle(document.documentElement).backgroundColor,body:getComputedStyle(document.body).backgroundColor},
     local:{x:local.x,y:local.y,width:local.width,height:local.height},position:[model.x,model.y],scale:model.scale.x,
     framing:model._archiveFraming,definitions:im.motionManager.definitions,
     drawableCount:drawables.length,largest:drawables.sort((a,b)=>b.bounds.width*b.bounds.height-a.bounds.width*a.bounds.height).slice(0,6),
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
   await page.waitForTimeout(7000);
   item.after=await child.evaluate(()=>({playing:model.internalModel.motionManager.playing,finished:model.internalModel.motionManager.isFinished(),
    idle:model.internalModel.motionManager.groups.idle,state:model.internalModel.motionManager.state}));
  }catch(e){item.error=e.message}
  console.log('CUBISM_DIAGNOSTIC '+JSON.stringify(item));
 }
}finally{fs.writeFileSync('/tmp/cubism-behavior-diagnostics.json',JSON.stringify(report,null,2));await browser.close()}
