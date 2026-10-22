// Smoke-verify real Azur Lane Cubism rendering in the existing Spine theater.
// Run with: python3 -m http.server 8765 & node scripts/test_azurlane_live2d_browser.mjs
import {chromium} from 'playwright-core';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import {PNG} from 'pngjs';
import {compareRenderedFrames} from './animation_frame_check.mjs';

const browserPath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!browserPath)throw Error('Chromium is not installed');
const audioCases=['al-bulaimodun_2','al-aierdeliqi_4','al-banerwei_3'];
const cases=[...audioCases,'al-z13_2','al-beilaosenlin_2','al-aersasi_3'];
const browser=await chromium.launch({headless:true,executablePath:browserPath,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 const page=await browser.newPage({viewport:{width:1366,height:850},deviceScaleFactor:1.5});
 // Record real native playback promises in both parent and iframe.
 await page.addInitScript(()=>{
  window.__voiceStarted=[];
  const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(...args){
   const url=this.currentSrc||this.src;
   return Promise.resolve(play.apply(this,args)).then(result=>{window.__voiceStarted.push(url);return result});
  };
 });
 const errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 for(const id of cases){
  await page.goto('http://127.0.0.1:8765/spine.html?id='+id,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(id=>document.getElementById('characters')?.value===id, id,{timeout:30000});
  await page.waitForFunction(()=>{const s=document.querySelector('#status')?.textContent||'';return s.startsWith('正在播放：')||s.includes('失败')||s.includes('超时')},{timeout:110000});
  if(await page.locator('#player .azurlane-loading-cover').count())throw Error('Loading cover was not cleared after model startup: '+id);
  const stage=await page.evaluate(()=>({
   game:document.querySelector('#gameFilter')?.value,
   status:document.querySelector('#status')?.textContent,
   frame:!!document.querySelector('#player iframe.azurlane-live2d-frame'),
   canSelectAction:!document.querySelector('#animationPicker')?.disabled,
   navStable:document.querySelector('.side-sitebar')!==null,
   docHeight:document.documentElement.scrollHeight,
   viewportH:innerHeight
  }));
  if(!stage.status.startsWith('正在播放：')||stage.game!=='azurlane'||!stage.frame||!stage.canSelectAction)
    throw Error('Cubism model did not reach playable stage: '+id+' '+JSON.stringify(stage)+' browserErrors='+errors.join('; '));
  if(stage.docHeight>stage.viewportH+3)throw Error('Azur Lane introduced desktop scrolling: '+JSON.stringify(stage));
  const frame=page.frameLocator('iframe.azurlane-live2d-frame');
  const hasPixi=await frame.locator('#live2dCanvas').evaluate(el=>({
   width:el.width,height:el.height,cssWidth:el.getBoundingClientRect().width,cssHeight:el.getBoundingClientRect().height,hasContext:!!el.getContext('webgl2')||!!el.getContext('webgl')
  }));
  if(hasPixi.width<hasPixi.cssWidth*1.4||hasPixi.height<hasPixi.cssHeight*1.4||!hasPixi.hasContext)
    throw Error('No actual WebGL Live2D canvas: '+id+' '+JSON.stringify(hasPixi));
  const performanceSettings=await frame.locator('#live2dCanvas').evaluate(()=>({fpsCap:app?.ticker?.maxFPS}));
  if(![30,60].includes(performanceSettings.fpsCap))
    throw Error('Live2D FPS limiter missing: '+JSON.stringify(performanceSettings));
  const nativeCore=await frame.locator('#live2dCanvas').evaluate(()=>Live2DCubismCore.Version.csmGetLatestMocVersion());
  if(nativeCore<5)throw Error('Cubism core cannot decode version 5 MOC files');
  const first=PNG.sync.read(await frame.locator('#live2dCanvas').screenshot());
  await page.waitForTimeout(1400);
  const second=PNG.sync.read(await frame.locator('#live2dCanvas').screenshot());
  const pixels=compareRenderedFrames(first,second);
  if(pixels.visible<300||pixels.moving<60)throw Error('Model is blank or not animated: '+id+' '+JSON.stringify(pixels));
  console.log('PASS_CUBISM5_ANIMATION',JSON.stringify({id,...pixels}));
  if(audioCases.includes(id)){
  // Regression: enabling via the test button must also enable iframe interaction.
  await page.locator('#voiceTest').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#voiceTest')?.disabled,null,{timeout:20000});
  await page.locator('#voiceTest').click();
  await page.waitForFunction(()=>window.__voiceStarted.length>0,null,{timeout:45000});
  const child=page.frames().find(f=>f.url().includes('azurlane-stage.html'));
  await child.waitForFunction(()=>frameVoiceEnabled&&frameVoiceCharacter===readyId,null,{timeout:10000});
  const before=await child.evaluate(()=>window.__voiceStarted.length);
  await frame.locator('#live2dCanvas').click({position:{x:25,y:25}});
  await child.waitForFunction(n=>window.__voiceStarted.length>n,before,{timeout:45000});
  const audio=await child.evaluate(()=>window.__voiceStarted.at(-1));
  console.log('PASS_INTERACTION_AUDIO',JSON.stringify({id,audio}));
  // Disabling must silence interaction again.
  await page.locator('#voiceEnabled').uncheck();
  await child.waitForFunction(()=>!frameVoiceEnabled);
  const stopped=await child.evaluate(()=>window.__voiceStarted.length);
  await frame.locator('#live2dCanvas').click({position:{x:25,y:25}});
  await page.waitForTimeout(150);
  if(await child.evaluate(()=>window.__voiceStarted.length)!==stopped)throw Error('Muted interaction played audio: '+id);
  }
  const actions=await page.locator('#animationPicker option').count();
  if(actions<2)throw Error('Cubism motions were not registered: '+id);
  await page.locator('#animationPicker').selectOption({index:Math.min(1,actions-1)});
  await page.locator('#zoomIn').click();
  await page.waitForFunction(()=>document.querySelector('#zoomValue')?.textContent!=='100%',{timeout:10000});
  const zoom=await page.locator('#zoomValue').textContent();
  results.push({id,actions,zoom,status:stage.status,canvas:hasPixi});
  console.log('PASS_LIVE2D_MODEL',JSON.stringify({id,actions,zoom}));
 }
 await page.close();
 fs.writeFileSync('/tmp/azurlane-live2d-test-results.json',JSON.stringify({results,errors},null,2));
 if(errors.length)throw Error('Page errors: '+errors.join('; '));
}finally{await browser.close();}

