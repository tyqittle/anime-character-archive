// Registry/source-scope representatives; the native child identity is mandatory.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {readCatalogRegistry,readCharacters} from './catalog_registry.mjs';
import {compareRenderedFrames} from './animation_frame_check.mjs';
import {launchArchiveBrowser} from './archive_browser.mjs';
const index=process.argv.indexOf('--catalog'),catalog=index<0?'':process.argv[index+1];
const entry=readCatalogRegistry().find(c=>c.id===catalog);if(!entry)throw Error('Use --catalog <registered-id>');
const scopes=JSON.parse(fs.readFileSync('data/live2d-source-scopes.json','utf8')).scopes.filter(s=>s.catalog===entry.path);
const representatives=[...new Set(scopes.flatMap(s=>s.preflightIds||[]))];if(!representatives.length)throw Error('Source representatives absent');
const idIndex=process.argv.indexOf('--id'),selected=idIndex<0?null:process.argv[idIndex+1];
if(idIndex>=0&&!representatives.includes(selected))throw Error('--id must name a declared source representative');
const ids=selected?[selected]:representatives;
const base=process.env.MODULE_TEST_BASE_URL||'http://127.0.0.1:8767',output='tmp/cubism-source-browser/'+catalog,records=readCharacters();
fs.mkdirSync(output,{recursive:true});const report={cases:[],errors:[],failures:[]};
const browser=await launchArchiveBrowser(chromium);
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));
 for(const id of ids){
  const c=records.find(c=>c.id===id);assert.equal(c?.engine,'cubism');console.log('CUBISM_SOURCE_LOAD',id);
  await page.goto(base+'/spine.html?id='+id+'&variant=exact',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(id=>azurlanePlayingId===id||document.querySelector('#status')?.classList.contains('error'),id,{timeout:110000});
  assert.equal(await page.evaluate(()=>azurlanePlayingId),id,await page.locator('#status').textContent());
  const child=page.frames().find(f=>f.url().includes('azurlane-stage.html'));assert.ok(child);assert.equal(await child.evaluate(()=>readyId),id);
  await child.waitForFunction(()=>model&&model._archiveFraming?.source==='rendered-pixels');
  const canvas=child.locator('#live2dCanvas');
  await page.addStyleTag({content:'.stage-chrome,#toggleLeftPanel,#toggleRightPanel{visibility:hidden!important}'});
  const first=PNG.sync.read(await canvas.screenshot());await page.waitForTimeout(1200);
  const second=PNG.sync.read(await canvas.screenshot({path:output+'/'+id+'.png'})),pixels=compareRenderedFrames(first,second);
  assert.ok(pixels.visible>10000&&pixels.moving>25,'Native model must render and move: '+JSON.stringify(pixels));
  await page.addStyleTag({content:'.stage-chrome,#toggleLeftPanel,#toggleRightPanel{visibility:visible!important}'});
  const before=await child.evaluate(()=>zoom);await page.locator('#stageZoomIn').click();await child.waitForFunction(z=>zoom>z,before);
  const camera=await child.evaluate(()=>({zoom,x:offsetX,y:offsetY}));
  const action=await child.evaluate(()=>frameMotionController.entries.find(e=>/^b_diantou/.test(e.key))?.key||frameMotionController.entries.find(e=>/^b_/.test(e.key)&&!/idle/.test(e.key))?.key||frameMotionController.entries.find(e=>!/idle/i.test(e.key))?.key);
  if(action){
   assert.equal(await child.evaluate(key=>motion(key),action),true);await page.waitForTimeout(200);assert.deepEqual(await child.evaluate(()=>({zoom,x:offsetX,y:offsetY})),camera);
   await child.waitForFunction(()=>{const m=model.internalModel.motionManager;return m.state.currentGroup===m.groups.idle},null,{timeout:25000});
  }
  assert.equal(await child.evaluate(()=>returnToFrameIdle()),true);
  const state=await child.evaluate(()=>({id:readyId,actions:frameMotionController.entries.length,idle:frameMotionController.initialKey,idleGroup:frameMotionController.entries.find(e=>e.key===frameMotionController.initialKey)?.group,current:model.internalModel.motionManager.state.currentGroup}));
  assert.equal(state.current,state.idleGroup);assert.ok(state.actions>0);
  report.cases.push({...state,name:c.name,visible:pixels.visible,moving:pixels.moving,action,checks:['exact-child-model','actual-motion','zoom','manual-action','automatic-return-idle','return-idle']});console.log('CUBISM_SOURCE_PASS',JSON.stringify(report.cases.at(-1)));
 }
 assert.deepEqual(report.errors,[]);
}catch(error){report.failures.push(String(error.stack||error));throw error}
finally{fs.writeFileSync(output+'/results.json',JSON.stringify(report,null,2));await browser.close()}
