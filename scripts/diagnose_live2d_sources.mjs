// Diagnose the two remaining Cubism source failures without hiding them.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {compareRenderedFrames} from './animation_frame_check.mjs';
const ids=['al-shengluyisi_3','al-wuqi_3'];
const catalog=JSON.parse(fs.readFileSync('data/live2d-azurlane.json','utf8')).characters;
const root='/tmp/live2d-source-diagnostics';fs.mkdirSync(root,{recursive:true});
const executablePath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 for(const id of ids){
  const c=catalog.find(c=>c.id===id),page=await browser.newPage({viewport:{width:1366,height:850}});
  const errors=[],messages=[],result={id,errors,messages,frames:[]};
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(['error','warning'].includes(m.type()))messages.push(m.text().slice(0,350))});
  try{
   const raw=c.modelUrl.replace(/^https:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^@]+)@([^/]+)\//,'https://raw.githubusercontent.com/$1/$2/$3/');
   const index=await page.request.get(raw,{timeout:20000});const metadata=await index.json();
   const moc=await page.request.get(new URL(metadata.FileReferences.Moc,raw).href,{headers:{Range:'bytes=0-31'},timeout:20000});
   const bytes=await moc.body();
   result.source={url:raw,mocStatus:moc.status(),size:bytes.length,header:bytes.subarray(0,32).toString('hex'),motions:Object.keys(metadata.FileReferences.Motions||{})};
   await page.goto('http://127.0.0.1:8765/spine.html?id='+id,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>/正在播放：|失败|超时/.test(document.querySelector('#status')?.textContent||''),null,{timeout:65000});
   result.status=await page.locator('#status').textContent();
   const child=page.frames().find(f=>f.url().includes('azurlane-stage.html'));
   result.core=await child.evaluate(()=>({version:Live2DCubismCore.Version.csmGetVersion(),moc:Live2DCubismCore.Version.csmGetLatestMocVersion()}));
   if(!result.status.startsWith('正在播放：'))continue;
   result.geometry=await child.evaluate(()=>{
    const core=model.internalModel.coreModel;
    const data=core._model||core;
    return {bounds:model.getLocalBounds(),x:model.x,y:model.y,scale:model.scale.x,
     canvas:[app.screen.width,app.screen.height],drawableCount:data.drawables?.count,
     visibleDrawables:Array.from(data.drawables?.opacities||[]).filter(x=>x>.01).length,
     textures:model.textures.map(t=>({width:t.baseTexture.realWidth,height:t.baseTexture.realHeight,valid:t.baseTexture.valid})),
     textureLimit:app.renderer.gl.getParameter(app.renderer.gl.MAX_TEXTURE_SIZE),
     firstVisible:Array.from(data.drawables?.opacities||[]).map((a,i)=>a>.01?i:-1).filter(i=>i>=0).slice(0,5).map(i=>model.internalModel.getDrawableBounds(i)),
     matrix:model.internalModel.localTransform};
   });
   for(const action of ['idle','login','home','main_1','touch_body']){
    if(!result.source.motions.includes(action))continue;
    await child.evaluate(async name=>{await model.motion(name,0,PIXI.live2d.MotionPriority.FORCE)},action);
    await page.waitForTimeout(1300);
    const canvas=page.frameLocator('iframe.azurlane-live2d-frame').locator('#live2dCanvas');
    const first=await canvas.screenshot();await page.waitForTimeout(900);
    const second=await canvas.screenshot();
    const pixels=compareRenderedFrames(PNG.sync.read(first),PNG.sync.read(second));
    fs.writeFileSync(path.join(root,id+'-'+action+'.png'),second);
    result.frames.push({action,...pixels});
   }
  }catch(error){result.error=error.message}
  finally{results.push(result);console.log('LIVE2D_SOURCE_DIAG',JSON.stringify(result));await page.close()}
 }
}finally{await browser.close();fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(results,null,2))}
