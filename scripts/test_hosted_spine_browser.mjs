import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {compareRenderedFrames} from './animation_frame_check.mjs';
import {installSourceCache} from './source_asset_cache.mjs';
import {readCharacters} from './catalog_registry.mjs';
const executablePath=[process.env.CHROME_BIN,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean).find(fs.existsSync);
const base=process.env.MODULE_TEST_BASE_URL||'http://127.0.0.1:8765',output='tmp/hosted-spine-browser';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await installSourceCache(context,process.env.ARCHIVE_PREVIEW_SOURCE_CACHE);
const records=readCharacters(),report={cases:[],errors:[],networkFailures:[],consoleErrors:[]};
try{
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 page.on('requestfailed',r=>report.networkFailures.push({url:r.url(),error:r.failure()?.errorText}));
 page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text().slice(0,1000))});
 const scopes=JSON.parse(fs.readFileSync('data/hosted-spine-source-scopes.json','utf8')).scopes;
 for(const id of scopes.filter(s=>!process.env.ARCHIVE_PREFLIGHT_SCOPE||s.id===process.env.ARCHIVE_PREFLIGHT_SCOPE).flatMap(s=>s.preflightIds||[])){
  const record=records.find(c=>c.id===id);assert.ok(record,'Missing full-catalog representative '+id);
  console.log('HOSTED_PORTRAIT_LOAD',id);
  await page.goto(base+'/spine.html?id='+id,{waitUntil:'domcontentloaded'});
  try{
   await page.waitForFunction(id=>document.querySelector('#status').classList.contains('error')||chosen()?.id===id&&!!player?.skeleton&&player._archiveFitPending===0&&document.querySelector('#status').textContent.startsWith('正在播放：'),id,{timeout:(record.downloadPolicy?.totalMs||95000)+15000});
   assert.ok((await page.locator('#status').textContent()).startsWith('正在播放：'),'Source playback failed: '+await page.locator('#status').textContent());
  }catch(error){
   report.failure={id,message:error.message,state:await page.evaluate(()=>({status:document.querySelector('#status')?.textContent,chosen:chosen()?.id,version:typeof loadedVersion==='undefined'?null:loadedVersion,fitPending:typeof player==='undefined'?null:player?._archiveFitPending})),networkFailures:report.networkFailures,consoleErrors:report.consoleErrors};
   console.error('HOSTED_PORTRAIT_FAILURE',JSON.stringify(report.failure));
   await page.screenshot({path:output+'/failed-'+id+'.png'});throw error;
  }
  assert.equal(await page.locator('#gameFilter option[value="'+record.gameId+'"]').count(),1);
  if(record.spineSkinLayers)assert.deepEqual(await page.evaluate(()=>player._archiveSkinLayers),record.spineSkinLayers,'Body and neutral face must be present together');
  if(typeof record.premultipliedAlpha==='boolean')assert.equal(await page.evaluate(()=>player.config.premultipliedAlpha),record.premultipliedAlpha,'Use the declared source texture alpha convention');
  assert.deepEqual(await page.evaluate(()=>{const sk=player.skeleton;const idle=sk.data.findAnimation('idle');return (idle?.timelines||[]).filter(t=>Array.isArray(t.attachmentNames)).flatMap(t=>t.attachmentNames.filter(Boolean).filter(name=>!sk.getAttachment(t.slotIndex,name)).map(name=>sk.slots[t.slotIndex].data.name+':'+name))}),[],'Every timed idle attachment must resolve, including blinking faces');
  await page.addStyleTag({content:'.stage-chrome,#toggleLeftPanel,#toggleRightPanel{visibility:hidden!important}'});
  const canvas=page.locator('#player canvas');await page.waitForTimeout(500);
  const first=PNG.sync.read(await canvas.screenshot());await page.waitForTimeout(1700);
  const second=PNG.sync.read(await canvas.screenshot({path:output+'/'+id+'.png'}));
  const pixels=compareRenderedFrames(first,second);assert.ok(pixels.visible>300&&pixels.moving>25,'Dynamic portrait must actually move: '+id+' '+JSON.stringify(pixels));
  if(record.gameId==='shadowverse')assert.ok(pixels.visible>50000,'Parked source effects must not shrink the portrait: '+id);
  await page.addStyleTag({content:'.stage-chrome,#toggleLeftPanel,#toggleRightPanel{visibility:visible!important}'});
  await page.locator('#stageZoomIn').click();
  const before=await page.evaluate(()=>({zoom:viewZoom,x:viewOffsetX,y:viewOffsetY}));
  if(await page.locator('#stageSettings').getAttribute('aria-expanded')!=='true')await page.locator('#stageSettings').click();
  const action=record.sourceAnimations.find(x=>!/^idle$/i.test(x))||record.sourceAnimations[0];
  await page.selectOption('#animationPicker',action);await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>({zoom:viewZoom,x:viewOffsetX,y:viewOffsetY})),before);
  await page.locator('#returnIdle').click();
  assert.equal(await page.evaluate(()=>player.animationState.getCurrent(0).animation.name===player._archiveIdleAnimation),true);
  const state=await page.evaluate(()=>({id:chosen().id,animations:player.skeleton.data.animations.length,version:loadedVersion}));
  report.cases.push({...state,name:record.name,visible:pixels.visible,moving:pixels.moving,checks:['source-byte-locks','actual-motion','zoom-preserved-on-action','return-idle']});
  console.log('HOSTED_PORTRAIT_PASS',JSON.stringify(report.cases.at(-1)));
 }
 assert.deepEqual(report.errors,[]);
}finally{fs.writeFileSync(output+'/results.json',JSON.stringify(report,null,2));await browser.close()}
