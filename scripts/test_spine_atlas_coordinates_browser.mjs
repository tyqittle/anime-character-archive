// Exercise source-declared atlas borders through the production loading path.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {readCharacters} from './catalog_registry.mjs';
import {launchArchiveBrowser} from './archive_browser.mjs';
import {compareRenderedFrames} from './animation_frame_check.mjs';

const base=process.env.MODULE_TEST_BASE_URL||'http://127.0.0.1:8765';
const output='tmp/atlas-coordinates-browser';
const records=readCharacters().filter(c=>c.atlasEdgeExtrusion!==undefined);
assert.ok(records.length,'Expected registered source border declarations');
fs.mkdirSync(output,{recursive:true});
const browser=await launchArchiveBrowser(chromium),report={cases:[],errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',error=>report.errors.push(error.message));
 for(const record of records){
  await page.goto(base+'/spine.html?id='+record.id+'&variant=exact',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(id=>document.querySelector('#status').classList.contains('error')||
   chosen()?.id===id&&!!player?.skeleton&&player._archiveFitPending===0&&
   document.querySelector('#status').textContent.startsWith('正在播放：'),record.id,{timeout:110000});
  assert.ok((await page.locator('#status').textContent()).startsWith('正在播放：'),await page.locator('#status').textContent());
  const declared=await page.evaluate(()=>player._archiveAtlasCoordinateDiagnostics);
  assert.equal(declared.mode,record.atlasCoordinateSpace);
  assert.equal(declared.edgeExtrusion,record.atlasEdgeExtrusion,'Source declaration must reach the real runtime');
  const canvas=page.locator('#player canvas');
  await page.addStyleTag({content:'.stage-chrome,#toggleLeftPanel,#toggleRightPanel{visibility:hidden!important}'});
  await page.waitForTimeout(300);
  const first=PNG.sync.read(await canvas.screenshot());
  await page.waitForTimeout(1700);
  const second=PNG.sync.read(await canvas.screenshot({path:output+'/'+record.id+'.png'}));
  const motion=compareRenderedFrames(first,second);
  assert.ok(motion.visible>300&&motion.moving>25,JSON.stringify({id:record.id,motion}));
  await page.addStyleTag({content:'.stage-chrome,#toggleLeftPanel,#toggleRightPanel{visibility:visible!important}'});
  await page.locator('#stageZoomIn').click();
  const before=await page.evaluate(()=>({zoom:viewZoom,x:viewOffsetX,y:viewOffsetY}));
  if(await page.locator('#stageSettings').getAttribute('aria-expanded')!=='true')await page.locator('#stageSettings').click();
  const action=await page.evaluate(()=>player.skeleton.data.animations.find(a=>a.name!==player._archiveIdleAnimation)?.name||player._archiveIdleAnimation);
  await page.selectOption('#animationPicker',action);
  assert.deepEqual(await page.evaluate(()=>({zoom:viewZoom,x:viewOffsetX,y:viewOffsetY})),before);
  await page.locator('#returnIdle').click();
  assert.equal(await page.evaluate(()=>player.animationState.getCurrent(0).animation.name===player._archiveIdleAnimation),true);
  report.cases.push({id:record.id,declared,motion,checks:['native-motion','declared-border','camera-preserved','return-idle']});
  console.log('ATLAS_COORDINATES_PASS',JSON.stringify(report.cases.at(-1)));
 }
 assert.deepEqual(report.errors,[]);
}finally{
 fs.writeFileSync(output+'/results.json',JSON.stringify(report,null,2)+'\n');
 await browser.close();
}
