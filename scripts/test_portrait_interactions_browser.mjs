import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const executablePath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!executablePath)throw Error('Chromium missing');
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',error=>errors.push(error.message));
 async function select(game,id){
  await page.goto('http://127.0.0.1:8765/spine.html?game='+game+'&id='+id,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(id=>chosen()?.id===id&&
   (azurlaneFrame?azurlanePlayingId===id:player?.skeleton&&player._archiveInteractions),id,{timeout:110000});
 }
 await select('azurlane','al-abeikelongbi_3');
 const frame=page.frames().find(f=>f.url().includes('azurlane-stage.html'));
 await frame.waitForFunction(()=>model?._archiveInteractions&&model._archiveFraming);
 await frame.waitForTimeout(200);
 const capability=await frame.evaluate(()=>model._archiveInteractions);
 assert.notEqual(capability.mode,'none','This pinned skin has source touch clips');
 for(const area of ['head','body']){
  const point=await frame.evaluate(area=>{
   const im=model.internalModel,names=Object.keys(im.hitAreas||{}),desired='touch_'+area;
   let candidates=[];
   if(im.hitAreas[desired]){
    const b=im.getDrawableBounds(im.hitAreas[desired].index);
    for(const x of [.2,.5,.8])for(const y of [.2,.5,.8])
     candidates.push(model.worldTransform.apply(im.localTransform.apply({x:b.x+b.width*x,y:b.y+b.height*y})));
   }else if(!names.length){
    const b=model.getBounds();candidates=[{x:b.x+b.width*.5,y:b.y+b.height*(area==='head'?.15:.6)}];
   }
   const box=app.view.getBoundingClientRect();
   for(const p of candidates){
    if(p.x<1||p.x>app.screen.width-1||p.y<1||p.y>app.screen.height-1)continue;
    const hits=model.hitTest(p.x,p.y);
    if(names.length&&(!hits.includes(desired)||area==='body'&&hits.some(x=>x==='touch_head'||x==='touch_special')))continue;
    return {x:p.x*box.width/app.screen.width,y:p.y*box.height/app.screen.height};
   }
   throw Error('No visible click point for '+desired+' '+JSON.stringify({names,bounds:model.getBounds()}));
  },area);
  await frame.locator('#live2dCanvas').click({position:point});
  await frame.waitForFunction(area=>model?._archiveLastInteraction?.key==='touch_'+area,area,{timeout:10000});
  await frame.waitForFunction(area=>model?.internalModel.motionManager.state?.currentGroup==='touch_'+area,area,{timeout:25000});
  results.push({source:'pinned-azurlane-skin',area,capability,actual:await frame.evaluate(()=>model._archiveLastInteraction)});
 }
 await select('girlscafegun','gc-girl01-l2d00');
 const standFrame=page.frames().find(f=>f.url().includes('azurlane-stage.html'));
 await standFrame.waitForFunction(()=>model?._archiveInteractions);
 assert.equal(await standFrame.evaluate(()=>model._archiveInteractions.mode),'none');
 await standFrame.locator('#live2dCanvas').click({position:{x:300,y:200}});
 assert.equal(await standFrame.evaluate(()=>model._archiveLastInteraction??null),null);
 results.push({source:'pinned-girlscafegun-stand-only',capability:await standFrame.evaluate(()=>model._archiveInteractions)});

 await select('browndust2','bd2-char000201');
 await page.waitForFunction(()=>player?._archiveCameraFrame&&!player._archiveFitPending);
 // A short test-only reaction reuses this real rig's timelines. This verifies
 // pointer/Spine completion behavior without inventing source-game capabilities.
 const original=await page.evaluate(()=>{
  const original={mode:player._archiveInteractions.mode,description:player._archiveInteractions.description};
  const base=player.skeleton.data.animations[0];
  player.skeleton.data.animations.push(new spine.Animation('fixture_touch_body',base.timelines,.6));
  initializeSpineInteractions(player,['fixture_touch_body']);
  player._archiveHitBounds=null;
  player._archiveInteractions=ArchivePortraitInteractions.plan({entries:[{key:'fixture_touch_body',group:'fixture_touch_body'}]});
  const option=new Option('fixture_touch_body','fixture_touch_body');document.getElementById('animationPicker').add(option);
  return original;
 });
 const location=()=>page.evaluate(()=>{
  const p=player,b=p._archiveViewBounds,f=p._archiveCameraFrame,r=p.canvas.getBoundingClientRect();
  return {x:r.left+(.5+(b.x+b.width*.5-f.x)/f.worldWidth)*r.width,
   y:r.top+(.5-(b.y+b.height*.5-f.y)/f.worldHeight)*r.height};
 });
 let point=await location();
 await page.mouse.move(point.x,point.y);await page.mouse.down();
 await page.mouse.move(point.x+45,point.y+20,{steps:5});await page.mouse.up();
 assert.equal(await page.evaluate(()=>player._archiveLastInteraction??null),null,'Drag cannot trigger touch');
 await page.waitForTimeout(120);
 point=await location();await page.mouse.click(point.x,point.y);
 await page.waitForFunction(()=>player?._archiveLastInteraction?.key==='fixture_touch_body',null,{timeout:10000});
 await page.waitForFunction(()=>player?.animationState?.getCurrent(0)?.animation?.name===player?._archiveIdleAnimation,null,{timeout:15000});
 results.push({source:'spine-pointer-fixture-on-real-rig',sourceCapability:original,testOnlyReaction:true});
 assert.deepEqual(errors,[]);
 console.log('PORTRAIT_INTERACTIONS_PASS '+JSON.stringify(results));
}finally{
 fs.writeFileSync('/tmp/portrait-interaction-results.json',JSON.stringify({results,errors},null,2));
 await browser.close();
}
