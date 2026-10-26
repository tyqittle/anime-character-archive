import {openTheaterInspector} from './theater_browser_helpers.mjs';
// Browser validation for five full-character Spine models, not static art.
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {launchArchiveBrowser} from './archive_browser.mjs';
import {PNG} from 'pngjs';

const entries=JSON.parse(fs.readFileSync('data/spine-bd2-pilot.json','utf8')).characters;
const output=process.env.BD2_TEST_OUTPUT||'/tmp';fs.mkdirSync(output,{recursive:true});
const base=process.env.MODULE_TEST_BASE_URL||'http://127.0.0.1:8765';
const browser=await launchArchiveBrowser(chromium);
const results=[];
try{
 for(const character of entries){
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const result={id:character.id,name:character.name,status:'failed',errors:[]};
  results.push(result);
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  try{
   await page.goto(base+'/spine.html',{waitUntil:'domcontentloaded',timeout:30000});
   await openTheaterInspector(page);
   await page.waitForFunction(id=>typeof allCharacters!=='undefined'&&allCharacters.some(c=>c.id===id),character.id,{timeout:20000});
   await page.selectOption('#gameFilter','browndust2');
   await page.selectOption('#characters',character.id);
   if(await page.locator('#nikke').count())throw Error('Main play button still present');
   await page.waitForFunction(()=>{
    const message=document.querySelector('#status')?.textContent||'';
    return message.startsWith('正在播放：')||/^(?:角色资源下载失败|播放失败|播放器初始化失败|加载失败|加载超时|本地素材播放失败)/.test(message);
   },null,{timeout:120000});
   const status=await page.locator('#status').textContent();
   result.playerStatus=status;
   if(!status.startsWith('正在播放：'))throw Error(status);
   // A visible frame can precede the one-time pixel calibration. Measure camera
   // changes only after the current model's explicit framing completion signal.
   result.phase='initial-framing';
   await page.waitForFunction(id=>chosen()?.id===id&&player?._archiveFitPending===0,character.id,{timeout:15000});
   if(await page.locator('#player button').count())throw Error('Embedded Spine player still contains a play button');
   const settings=await page.evaluate(()=>({pma:player?.config?.premultipliedAlpha,hasPlayer:!!player}));
   if(!settings.hasPlayer||settings.pma!==false)throw Error('BD2 straight-alpha renderer not active: '+JSON.stringify(settings));
   const canvas=page.locator('#player canvas').first();
   await canvas.waitFor({timeout:15000});
   const rect=await canvas.evaluate(c=>({width:c.width,height:c.height}));
   result.canvas=rect;
   if(!await page.locator('#zoomIn').isEnabled())throw Error('Zoom controls were not enabled after rendering');
   if(!await page.locator('#animationPicker').isEnabled())throw Error('Animation picker is still disabled');
   await page.waitForTimeout(400); // settle the animation viewport transition
   const initialCamera=await page.evaluate(()=>({zoom:player.sceneRenderer.camera.zoom,native:player._archiveNativeView}));
   if(!initialCamera.native)throw Error('Spine 4.1 should support GPU-native camera zoom');
   result.phase='zoom-in';await page.locator('#zoomIn').click();
   const zoomed=await canvas.evaluate(c=>({transform:c.style.transform,origin:c.style.transformOrigin}));
   await page.waitForFunction(base=>viewZoom>1.1&&player.sceneRenderer.camera.zoom<base*.92,initialCamera.zoom,{timeout:5000});
   const nativeCamera=await page.evaluate(()=>player.sceneRenderer.camera.zoom);
   if(!zoomed.transform.includes('scale(1)')||nativeCamera>=initialCamera.zoom)
    throw Error('Zoom should rerender the Spine camera, not upscale CSS canvas: '+JSON.stringify({zoomed,nativeCamera,initialCamera}));
   result.phase='zoom-reset';await page.locator('#resetView').click();
   const reset=await canvas.evaluate(c=>c.style.transform);
   await page.waitForFunction(base=>viewZoom===1&&player.sceneRenderer.camera.zoom>base*.95,initialCamera.zoom,{timeout:5000});
   if(!reset.includes('scale(1)'))throw Error('Reset-view button failed: '+reset);
   // Real wheel input, no keyboard modifier; it must change the actual art.
   await canvas.hover();
   result.phase='wheel-in';await page.mouse.wheel(0,-250);
   await page.waitForFunction(()=>viewZoom>1.1,null,{timeout:5000});
   const wheelZoom=await canvas.evaluate(c=>c.style.transform);
   if(!wheelZoom.includes('scale('))throw Error('Wheel did not transform the canvas: '+wheelZoom);
   result.phase='wheel-out';await page.mouse.wheel(0,250);
   await page.waitForFunction(()=>viewZoom<1.1,null,{timeout:5000});
   await page.locator('#resetView').click();
   await canvas.evaluate(c=>{
    c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:71,pointerType:'mouse',button:0,clientX:100,clientY:100,bubbles:true}));
    c.dispatchEvent(new PointerEvent('pointermove',{pointerId:71,pointerType:'mouse',button:0,clientX:136,clientY:121,bubbles:true}));
    c.dispatchEvent(new PointerEvent('pointerup',{pointerId:71,pointerType:'mouse',button:0,clientX:136,clientY:121,bubbles:true}));
   });
   const panned=await canvas.evaluate(c=>c.style.transform);
   const nativePan=await page.evaluate(()=>({x:viewOffsetX,y:viewOffsetY,native:player._archiveNativeView}));
   if(nativePan.native ? !(Math.abs(nativePan.x-36)<1&&Math.abs(nativePan.y-21)<1)
     : !/translate\\(36px,\\s*21px\\)/.test(panned))
    throw Error('Dragging did not pan the character: '+JSON.stringify({panned,nativePan}));
   await page.locator('#resetView').click();
   if(rect.width<200||rect.height<200)throw Error('Canvas is too small: '+JSON.stringify(rect));
   await page.waitForTimeout(500);
   const a=PNG.sync.read(await page.locator('#player').screenshot());
   await page.waitForTimeout(1500);
   const b=PNG.sync.read(await page.locator('#player').screenshot());
   if(a.width!==b.width||a.height!==b.height)throw Error('Canvas size changed during animation');
   let changed=0,sampled=0;
   for(let y=Math.floor(a.height*.12);y<Math.floor(a.height*.8);y+=7){
    for(let x=25;x<a.width-25;x+=7){
     const p=(y*a.width+x)*4;
     const d=Math.abs(a.data[p]-b.data[p])+Math.abs(a.data[p+1]-b.data[p+1])+Math.abs(a.data[p+2]-b.data[p+2]);
     sampled++;
     if(d>18)changed++;
    }
   }
   result.movingPixelSamples=changed;result.pixelSamples=sampled;
   await page.screenshot({path:output+'/bd2-'+character.id+'.png',fullPage:true});
   if(changed<8)throw Error('No meaningful character motion detected over 1.5 seconds');
   if(pageErrors.length)throw Error('Page errors: '+pageErrors.join('; '));
   result.status='rendered-and-moving';
   console.log('PASS',character.id,'changed samples',changed,'/',sampled);
  }catch(e){
   result.errors.push(e.message||String(e));
   result.failureState=await page.evaluate(()=>({chosen:chosen()?.id,zoom:viewZoom,fitPending:player?._archiveFitPending,cameraZoom:player?.sceneRenderer?.camera?.zoom,status:document.querySelector('#status')?.textContent})).catch(()=>null);
   console.error('FAIL',character.id,result.errors.join('; '));
   await page.screenshot({path:output+'/bd2-'+character.id+'-failed.png',fullPage:true}).catch(()=>{});
  }finally{await page.close()}
 }
}finally{
 await browser.close();
 fs.writeFileSync(output+'/bd2-spine-browser-results.json',JSON.stringify(results,null,2));
}
if(results.some(x=>x.status!=='rendered-and-moving'))process.exitCode=1;
