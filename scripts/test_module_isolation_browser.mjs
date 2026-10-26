import {openTheaterInspector} from './theater_browser_helpers.mjs';
// Real engines with deliberate failures in optional modules and an old request.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {launchArchiveBrowser} from './archive_browser.mjs';
import {PNG} from 'pngjs';
import {compareRenderedFrames} from './animation_frame_check.mjs';
const base=process.env.MODULE_TEST_BASE_URL||'http://127.0.0.1:8765';
const output='tmp/module-isolation-browser';fs.mkdirSync(output,{recursive:true});
const results=[],errors=[];
const browser=await launchArchiveBrowser(chromium);
try{
 const context=await browser.newContext({viewport:{width:1366,height:850}});
 await context.addInitScript(()=>Object.defineProperty(window,'indexedDB',{get(){throw Error('fixture: cache unavailable')}}));
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 const completed=new Map();page.on('requestfinished',request=>completed.set(request,'finished'));page.on('requestfailed',request=>completed.set(request,'cancelled'));
 await page.route('**/data/live2d-games-wave3.json*',route=>route.fulfill({status:503,body:'fixture: one catalog unavailable'}));
 async function select(id){
  await page.evaluate(id=>{
   const c=allCharacters.find(c=>c.id===id);if(!c)throw Error('Missing test model: '+id);
   document.getElementById('gameFilter').value=animationCollection(c);refreshCharacters();selectCharacter(c);refreshCardSelection();
   void playCharacter(c);
  },id);
 }
 async function playing(id){
  await page.waitForFunction(id=>chosen()?.id===id&&(azurlaneFrame?azurlanePlayingId===id:player?.skeleton)&&document.getElementById('status').textContent.startsWith('正在播放：'),id,{timeout:110000});
  const frame=page.frames().find(frame=>frame.url().includes('azurlane-stage.html'));
  const canvas=frame?frame.locator('#live2dCanvas'):page.locator('#player canvas').first();
  if(frame)assert.equal(await frame.evaluate(()=>readyId),id);
  await page.waitForTimeout(600);
  const first=PNG.sync.read(await canvas.screenshot());await page.waitForTimeout(550);
  const second=PNG.sync.read(await canvas.screenshot()),motion=compareRenderedFrames(first,second);
  assert.ok(motion.visible>300&&motion.moving>15,JSON.stringify({id,motion}));
  await page.locator('#zoomIn').click();
  await page.waitForFunction(()=>document.getElementById('zoomValue').textContent==='120%');
  await page.locator('#resetView').click();
  results.push({id,motion,zoomControls:true,cacheDisabled:await page.locator('#savedPacks').isDisabled()});
  return frame;
 }
 await page.goto(base+'/spine.html?id=ec-60010003',{waitUntil:'domcontentloaded'});
 await openTheaterInspector(page);
 await playing('ec-60010003');assert.equal(results.at(-1).cacheDisabled,true);
 results.at(-1).catalogFailureIsolated=true;
 // A broken optional voice UI must not interrupt engine teardown/switching.
 await page.evaluate(()=>{window.selectedVoiceChanged=()=>{throw Error('fixture: voice UI failed')}});
 await select('al-abeikelongbi_3');await playing('al-abeikelongbi_3');results.at(-1).voiceFailureIsolated=true;
 await select('ec-60010003');await playing('ec-60010003');
 // Hold one old setup request, switch away, then let its response arrive late.
 let held=null;await page.route('**/*.moc3',route=>{if(!held)held=route;else void route.continue()});
 await select('gc-girl01-l2d00');
 const deadline=Date.now()+25000;while(!held&&Date.now()<deadline)await page.waitForTimeout(50);
 assert.ok(held,'Expected a real old-model MOC request');
 await select('al-abeikelongbi_3');const active=await playing('al-abeikelongbi_3');
 await held.continue();
 const oldDeadline=Date.now()+35000;while(!completed.has(held.request())&&Date.now()<oldDeadline)await page.waitForTimeout(50);
 assert.ok(completed.has(held.request()),'Old request must finish or be cancelled');
 await page.waitForTimeout(1200);
 assert.equal(await active.evaluate(()=>readyId),'al-abeikelongbi_3');
 results.at(-1).lateOldRequestIsolated=true;
 results.at(-1).oldRequestOutcome=completed.get(held.request());
 assert.deepEqual(errors,[]);
 await context.close();
 // Host disposal is tested in the actual browser desktop bridge, independently
 // of native installer/build validation and without changing protocol payloads.
 const desktop=await browser.newContext({viewport:{width:900,height:900}});
 await desktop.addInitScript(()=>{window.chrome.webview={postMessage(){throw Error('fixture: disposed host')},addEventListener(){}}});
 const surface=await desktop.newPage();surface.on('pageerror',error=>errors.push(error.message));
 await surface.goto(base+'/spine.html?desktop=1&transport=webview2&game=echocalypse&id=ec-60010003&session=fixture',{waitUntil:'domcontentloaded'});
 await openTheaterInspector(surface);
 await surface.waitForFunction(()=>player?.skeleton&&document.getElementById('status').textContent.startsWith('正在播放：'),null,{timeout:110000});
 const first=await surface.evaluate(()=>window.ArchiveDesktopBridge.inspect().renderedFrames);await surface.waitForTimeout(700);
 assert.ok(await surface.evaluate(()=>window.ArchiveDesktopBridge.inspect().renderedFrames)>first);
 results.push({id:'ec-60010003',hostFailureIsolated:true});assert.deepEqual(errors,[]);
 await desktop.close();
}finally{
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({results,errors},null,2)+'\n');
 await browser.close();
}
console.log('MODULE_ISOLATION_BROWSER',JSON.stringify(results));
