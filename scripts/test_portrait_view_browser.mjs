// End-to-end camera and retired-renderer regression with real source rigs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
const framing=createRequire(import.meta.url)('../assets/js/shared/portrait-framing.js');
const bin=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!bin)throw Error('Chromium missing');
const browser=await chromium.launch({headless:true,executablePath:bin,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
async function captureCanvas(page,type='image/png'){
 // Capture inside the renderer callback, before WebGL discards its backbuffer.
 // Element screenshots include overlapping fixed UI and cannot measure a rig.
 return Buffer.from(await page.evaluate(type=>new Promise(resolve=>{
  const renderer=player.sceneRenderer,previous=renderer.end;
  renderer.end=function(...args){
   const result=previous.apply(this,args);renderer.end=previous;
   const copy=document.createElement('canvas');
   copy.width=player.canvas.width;copy.height=player.canvas.height;
   copy.getContext('2d').drawImage(player.canvas,0,0);
   resolve(copy.toDataURL(type,.55).split(',')[1]);
   return result;
  };
 }),type),'base64');
}
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1.5});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/spine.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>allCharacters.length>1000,null,{timeout:45000});
 await page.evaluate(()=>{window.__retiredPortraits=[]});
 const cases=[
 ['daibloscore','dbcore-10070_skin_cinnabar03b_spine-10070_skin_cinnabar03b'],
 ['daibloscore','dbcore-10010_skin_alps04_spine-10010_skin_alps04'],
 ['daibloscore','dbcore-10010_skin_alps05_spine-10010_skin_alps05'],
 ['daibloscore','dbcore-70050_skin_hades03_spine-70050_skin_hades03'],
 ['bluearchive','ba-ch0145_home'],
 ['browndust2','bd2-char000201']
 ];
 for(const [game,id] of cases){
  await page.evaluate(()=>{if(player)window.__retiredPortraits.push({p:player,draws:player._testDraws||0})});
  await page.selectOption('#gameFilter',game);
  await page.selectOption('#characters',id);
  await page.waitForFunction(id=>player?.skeleton&&chosen()?.id===id&&player._archiveFraming?.source==='rendered-pixels'&&!player._archiveFitPending,id,{timeout:110000});
  await page.waitForTimeout(250);
  const initial=await page.evaluate(()=>{
   const p=player;
   p.pause();
   const draw=p.sceneRenderer.drawSkeleton;
   p._testDraws=0;p.sceneRenderer.drawSkeleton=function(...args){p._testDraws++;return draw.apply(this,args)};
   p._archiveOriginalViewport=()=>{throw Error('Action switch rescanned animation bounds')};
   return {version:loadedVersion,framing:p._archiveFraming,canvas:{w:p.canvas.width,h:p.canvas.height},bounds:p._archiveViewBounds};
  });
  const bytes=await captureCanvas(page);
  const png=PNG.sync.read(bytes),bounds=framing.visibleBounds({pixels:png.data,width:png.width,height:png.height,background:[20,34,56]});
  assert.ok(bounds,'No visible portrait: '+id);
  const occupancy=Math.max(bounds.width/(png.width*.9),bounds.height/(png.height*.88));
  const cx=(bounds.x+bounds.width/2)/png.width,cy=(bounds.y+bounds.height/2)/png.height;
  assert.ok(occupancy>.7&&occupancy<1.25,'Portrait still too small/clipped '+id+' '+JSON.stringify({occupancy,bounds}));
  assert.ok(Math.abs(cx-.5)<.13&&Math.abs(cy-.5)<.13,'Portrait not centered '+id+' '+JSON.stringify({cx,cy}));
  await page.locator('#zoomIn').click();await page.locator('#zoomIn').click();
  await page.evaluate(()=>{viewOffsetX=35;viewOffsetY=-22;syncViewTransform()});
  const before=await page.evaluate(()=>({zoom:viewZoom,x:viewOffsetX,y:viewOffsetY,bounds:{...player._archiveViewBounds}}));
  const options=await page.locator('#animationPicker option').count();
  for(let i=0;i<Math.min(4,options);i++)await page.selectOption('#animationPicker',{index:i});
  await page.waitForTimeout(200);
  const after=await page.evaluate(()=>({zoom:viewZoom,x:viewOffsetX,y:viewOffsetY,bounds:{...player._archiveViewBounds}}));
  assert.deepEqual(after,before,'Action switch changed framing: '+id);
  // A resize may alter aspect ratio, but must preserve the camera's world center
  // and explicit user zoom/pan rather than resetting the model session.
  await page.setViewportSize({width:1700,height:864});await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>viewZoom),before.zoom);
  await page.locator('#resetView').click();
  await page.waitForFunction(()=>!player._archiveFitPending);
  assert.equal(await page.evaluate(()=>viewZoom),1);
  const retired=await page.evaluate(()=>window.__retiredPortraits.map(({p})=>({version:p.config?.binaryUrl?'4.x':'3.8',disposed:!!(p._archiveDisposed||p.disposed),draws:p._testDraws||0})));
  await page.waitForTimeout(300);
  const later=await page.evaluate(()=>window.__retiredPortraits.map(({p})=>p._testDraws||0));
  assert.ok(retired.every((x,i)=>x.disposed&&x.draws===later[i]),'Retired renderers still draw '+JSON.stringify({retired,later}));
  fs.writeFileSync('/tmp/portrait-'+id+'.png',bytes);
  results.push({id,game,initial,occupancy,cx,cy,actions:options,retired});
  console.log('PORTRAIT_VIEW_PASS '+JSON.stringify(results.at(-1)));
  if(game==='daibloscore'){
   const jpeg=await captureCanvas(page,'image/jpeg');
   const b64=jpeg.toString('base64');console.log('PORTRAIT_IMAGE_START '+id);
   for(let i=0;i<b64.length;i+=12000)console.log('PORTRAIT_IMAGE_CHUNK '+b64.slice(i,i+12000));
   console.log('PORTRAIT_IMAGE_END');
  }
  await page.setViewportSize({width:1440,height:900});
 }
 assert.deepEqual(errors,[]);
}finally{
 fs.writeFileSync('/tmp/portrait-view-results.json',JSON.stringify(results,null,2));
 await browser.close();
}
