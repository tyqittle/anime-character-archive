// Exact user-reported Sirius skin, real source clips and native Cubism clock.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {launchArchiveBrowser} from './archive_browser.mjs';
const base=process.env.MODULE_TEST_BASE_URL||'http://127.0.0.1:8765';
const output='tmp/rich-interactions';fs.mkdirSync(output,{recursive:true});
const browser=await launchArchiveBrowser(chromium);
const report={id:'al-tianlangxing_5',errors:[],actions:[],checks:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',error=>report.errors.push(error.message));
 await page.goto(base+'/spine.html?id='+report.id,{waitUntil:'domcontentloaded'});
 console.log('RICH_MODEL_LOADING',report.id);
 await page.waitForFunction(()=>azurlanePlayingId==='al-tianlangxing_5'&&document.getElementById('status').textContent.startsWith('正在播放：'),null,{timeout:110000});
 const child=page.frames().find(frame=>frame.url().includes('azurlane-stage.html'));
 await child.waitForFunction(()=>model?._archiveFraming?.source==='rendered-pixels');
 console.log('RICH_MODEL_READY');
 await page.locator('#stageSettings').click();
 await page.locator('#interactionActionPanel summary').click();
 report.source=await child.evaluate(()=>({id:readyId,initial:frameMotionController.initialKey,actions:frameMotionController.entries.length,
  interactions:frameInteractionPlan.actions.length,mode:frameInteractionPlan.mode,sourceAreas:frameInteractionPlan.sourceAreas}));
 assert.equal(report.source.actions,51);assert.equal(report.source.initial,'idle');
 assert.equal(report.source.mode,'source');assert.ok(report.source.sourceAreas.includes('TouchHead'));
 assert.equal(await page.locator('#interactionActionList button').count(),report.source.interactions);
 assert.ok(report.source.interactions>25);
 await page.screenshot({path:output+'/all-interactions.png'});
 // Every source interaction is selectable and actually starts, including drag
 // and special clips that cannot be assigned original hitboxes from this export.
 await child.evaluate(()=>app.ticker.stop());
 for(const key of await child.evaluate(()=>frameInteractionPlan.actions.map(x=>x.key))){
  await page.locator('#interactionActionSearch').fill(key);
  await page.locator('#interactionActionList button[data-motion="'+key+'"]').click();
  await child.waitForFunction(key=>model.internalModel.motionManager.state.currentGroup===key,key,{timeout:25000});
  const state=await child.evaluate(async key=>{
   const e=frameMotionController.entries.find(x=>x.key===key),m=model.internalModel.motionManager,clip=m.motionGroups[e.group][e.index];
   model.update(100);app.renderer.render(app.stage);
   const result={key,sourceLoop:clip._motionData?.loop,runtimeLoop:clip.isLoop?.(),mode:clip._archivePlaybackMode,seconds:clip.getLoopDuration()};
   for(let i=0;i<Math.ceil((result.seconds+2)*10);i++){
    model.update(100);app.renderer.render(app.stage);if(i%10===0)await new Promise(resolve=>setTimeout(resolve,0));
   }
   await new Promise(resolve=>setTimeout(resolve,50));model.update(100);app.renderer.render(app.stage);
   return {...result,endGroup:m.state.currentGroup,restoredLoop:clip.isLoop()};
  },key);
  assert.equal(state.runtimeLoop,false,key+' must play once');assert.equal(state.sourceLoop,true,key+' must retain original metadata');
  assert.equal(state.endGroup,'__archive_idle',key+' must return to standby');assert.equal(state.restoredLoop,true);
  report.actions.push(state);
  if(report.actions.length%5===0)console.log('RICH_COMPLETED_AND_RECOVERED',report.actions.length);
 }
 console.log('RICH_ACTIONS_STARTED',report.actions.length);
 await page.locator('#interactionActionSearch').fill('');
 report.checks.push('all-source-interactions-start-once');
 report.checks.push('all-29-source-interactions-complete-and-return-to-standby');
 // Same-action repeats restart rather than silently succeeding without playback.
 const repeats=await child.evaluate(async()=>{
  const m=model.internalModel.motionManager;let n=0;const listener=g=>{if(g==='touch_head')n++};m.on('motionStart',listener);
  await motion('touch_head');model.update(100);app.renderer.render(app.stage);await motion('touch_head');
  m.off('motionStart',listener);return n;
 });assert.equal(repeats,2);report.checks.push('same-action-restarts');
 // Looping is an explicit preview choice, not an interaction's implicit default.
 await page.locator('#motionLoop').check();await page.selectOption('#animationPicker','touch_idle2');
 await child.waitForFunction(()=>model.internalModel.motionManager.state.currentGroup==='touch_idle2');
 assert.equal(await child.evaluate(()=>model.internalModel.motionManager.motionGroups.touch_idle2[0].isLoop()),true);
 await page.locator('#returnIdle').click();await child.waitForFunction(()=>model.internalModel.motionManager.state.currentGroup==='idle');
 await page.locator('#motionLoop').uncheck();report.checks.push('explicit-loop-and-return-idle');
 // Hit coordinates use named deformed source meshes, excluding stage scenery.
 await page.locator('#stageSettings').click();
 await page.waitForTimeout(200);
 const taps=await child.evaluate(()=>{
  app.resize();
  zoom=1.25;offsetX=65;offsetY=35;fit();model.update(100);app.renderer.render(app.stage);
  const im=model.internalModel;
  const box=document.getElementById('live2dCanvas').getBoundingClientRect();
  const point=(name,x=.5,y=.5)=>{
   const b=im.getDrawableBounds(im.hitAreas[name].index);
   const p=model.worldTransform.apply(im.localTransform.apply({x:b.x+b.width*x,y:b.y+b.height*y}));
   return {x:p.x*box.width/app.screen.width,y:p.y*box.height/app.screen.height};
  };
  return {head:point('TouchHead'),body:point('TouchBody',.8,.8),drag:point('TouchDrag11')};
 });
 report.hitAudit=await child.evaluate(points=>({points,screen:{width:app.screen.width,height:app.screen.height},
  head:model.hitTest(points.head.x,points.head.y),body:model.hitTest(points.body.x,points.body.y)}),taps);
 console.log('RICH_HIT_AUDIT',JSON.stringify(report.hitAudit));
 await page.screenshot({path:output+'/hit-audit.png'});
 const canvas=child.locator('#live2dCanvas');
 await canvas.click({position:taps.head});await child.waitForFunction(()=>model._archiveLastInteraction?.key==='touch_head');
 await canvas.click({position:taps.body});
 await child.waitForFunction(()=>model._archiveLastInteraction?.key==='touch_body');
 report.checks.push('source-head-body-hits-after-pan-zoom');
 await page.locator('#stageSettings').click();
 await page.selectOption('#interactionMode','interact');
 await child.waitForFunction(()=>frameDragInteraction);
 await page.locator('#stageSettings').click();
 const before=await child.evaluate(()=>({x:offsetX,y:offsetY})),box=await canvas.boundingBox();
 await page.mouse.move(box.x+taps.drag.x,box.y+taps.drag.y);await page.mouse.down();
 await page.mouse.move(box.x+taps.drag.x+25,box.y+taps.drag.y,{steps:6});await page.mouse.up();
 await child.waitForFunction(()=>model._archiveLastInteraction?.key==='touch_drag11');
 assert.deepEqual(await child.evaluate(()=>({x:offsetX,y:offsetY})),before);
 report.checks.push('source-drag-gesture-does-not-pan');
 await child.evaluate(()=>{app.ticker.start()});
 await page.locator('#stageSettings').click();await page.screenshot({path:output+'/verified.png'});
 assert.deepEqual(report.errors,[]);
}finally{
 fs.writeFileSync(output+'/results.json',JSON.stringify(report,null,2)+'\n');await browser.close();
}
console.log(JSON.stringify(report));
