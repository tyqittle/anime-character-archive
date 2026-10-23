// Browser regression for Arknights illustration vs BattleFront classification.
// Tests an actual high-res source model, not the game catalogue alone.
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const bin=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!bin)throw Error('Chromium executable missing');
const browser=await chromium.launch({headless:true,executablePath:bin,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});
 const id='ak-illust-1012-skadi2';
 await p.goto('http://127.0.0.1:8765/spine.html?id='+id,{waitUntil:'domcontentloaded',timeout:30000});
 await p.waitForFunction(id=>document.querySelector('#characters')?.value===id,id,{timeout:30000});
 const chosen=await p.evaluate(()=>({filter:document.querySelector('#gameFilter').value,asset:allCharacters.find(c=>c.id==='ak-illust-1012-skadi2')?.assetType}));
 if(chosen.filter!=='arknights'||chosen.asset!=='dynamic-illustration-spine')throw Error('Wrong deep-link collection: '+JSON.stringify(chosen));
 await p.waitForFunction(()=>{
  const s=document.querySelector('#status')?.textContent||'';
  return s.startsWith('正在播放：')||/(失败|超时|缺少|不支持)/.test(s);
 },null,{timeout:120000});
 const msg=await p.locator('#status').textContent();
 if(!msg.startsWith('正在播放：'))throw Error('Illustration skeleton did not animate: '+msg);
 const canvas=p.locator('#player canvas').first();
 await canvas.waitFor({state:'visible',timeout:20000});
 // Regression: legacy Spine 3.8 used a 1x framebuffer even at retina DPR.
 const size=await canvas.evaluate(el=>({
  width:el.width,height:el.height,
  displayWidth:el.clientWidth,displayHeight:el.clientHeight,
  transform:el.style.transform
 }));
 const ratio=size.width/Math.max(1,size.displayWidth);
 if(!(ratio>=1.8&&ratio<=2.05))throw Error('Arknights model rendered below retina resolution: '+JSON.stringify(size));
 const nativeCamera=await p.evaluate(()=>player?._archiveNativeView===true);
 if(!nativeCamera)throw Error('Arknights 3.8 model is not using native camera zoom');
 await p.locator('#zoomIn').click();
 await p.waitForTimeout(300);
 const zoomState=await p.evaluate(()=>({
  zoom:viewZoom,transform:player?.canvas?.style.transform||''
 }));
 if(zoomState.zoom<=1||!/scale\\(1\\)/.test(zoomState.transform)){
  throw Error('Zoom is still CSS-upscaling the canvas: '+JSON.stringify(zoomState));
 }
 console.log('ARKNIGHTS_ILLUST_RETINA_NATIVE_ZOOM_PASS',id,JSON.stringify({size,ratio,zoomState}));
 console.log('ARKNIGHTS_ILLUST_REAL_MODEL_PASS',id,msg,JSON.stringify(size));
 await p.close();
}finally{await browser.close();}
