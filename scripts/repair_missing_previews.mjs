// One missing-preview renderer for all catalogs and both animation engines.
import fs from 'node:fs';
import path from 'node:path';
import {installSourceCache} from './source_asset_cache.mjs';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {compareRenderedFrames} from './animation_frame_check.mjs';
import {readCharacters,sourceIdentity} from './catalog_registry.mjs';
import {rendererIdentity,reusableCapture,saveCaptureReport,sha256} from './preview_capture_state.mjs';
const pending=new Set(JSON.parse(fs.readFileSync(process.env.ARCHIVE_PREVIEW_PENDING||'tmp/repair-pending.json','utf8')));
const shard=Number(process.argv[2]??0),count=Number(process.argv[3]??8);
if(!Number.isInteger(shard)||!Number.isInteger(count)||count<1||shard<0||shard>=count)throw Error('Invalid preview shard');
const all=readCharacters();
const known=new Set(all.map(c=>c.id));
for(const id of pending)if(!known.has(id))throw Error('Unregistered preview model: '+id);
const todo=all.filter(c=>pending.has(c.id)).filter((_,i)=>i%count===shard);
const root=process.env.ARCHIVE_PREVIEW_ROOT||'tmp/repair-output';
const base=process.env.ARCHIVE_PREVIEW_BASE_URL||'http://127.0.0.1:8765';
for(const name of ['frames','reports'])fs.mkdirSync(path.join(root,name),{recursive:true});
const bin=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium',
 'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(fs.existsSync);
if(!bin)throw Error('Chromium missing');
const browser=await chromium.launch({headless:true,executablePath:bin,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1366,height:850}});
// Optional exact-byte source cache from a validated import. This avoids fetching
// each large texture again during every shard; models still use their real URLs,
// native runtime, camera and original downloaded asset bytes.
await installSourceCache(context,process.env.ARCHIVE_PREVIEW_SOURCE_CACHE);
const reportPath=path.join(root,'reports','shard-'+shard+'.json'),renderer=rendererIdentity();
const prior=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath,'utf8')):{pass:[]};
const pass=[],fail=[];
const checkpoint=()=>saveCaptureReport(reportPath,{shard,pass,fail});
try{
 for(const c of todo){
  const framePath=path.join(root,'frames',c.gameId+'-'+c.id+'.png');
  const previous=prior.pass.find(p=>p.id===c.id);
  if(reusableCapture(previous,c,sourceIdentity(c),renderer,framePath)){pass.push(previous);console.log('REPAIR_PREVIEW_REUSED',c.id);checkpoint();continue}
  const page=await context.newPage();
  try{
   await page.goto(base+'/spine.html?id='+encodeURIComponent(c.id)+'&variant=exact',{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(id=>document.querySelector('#characters')?.value===id,c.id,{timeout:30000});
   await page.waitForFunction(()=>{const node=document.querySelector('#status'),s=node?.textContent||'';return s.startsWith('正在播放：')||node?.classList.contains('error')},null,{timeout:95000});
   const status=await page.locator('#status').textContent();
   if(!status.startsWith('正在播放：'))throw Error(status);
   if(c.engine==='cubism'){
    await page.waitForFunction(id=>azurlanePlayingId===id,c.id,{timeout:10000});
    const child=page.frames().find(f=>f.url().includes('azurlane-stage.html'));
    if(!child||await child.evaluate(()=>readyId)!==c.id)throw Error('Rendered Live2D model identity mismatch: '+c.id);
   }
   // Canvas screenshots are composited with overlapping parent-page controls.
   // Exclude the floating pane handles from every game's portrait preview.
   await page.addStyleTag({content:'#toggleLeftPanel,#toggleRightPanel,.stage-chrome,#loadNotice{visibility:hidden!important}'});
   const canvas=c.engine==='cubism'?page.frameLocator('iframe.azurlane-live2d-frame').locator('#live2dCanvas'):page.locator('#player canvas').first();
   await canvas.waitFor({state:'visible',timeout:10000});
   let frame;const deadline=Date.now()+9000;
   do{
    await page.waitForTimeout(250);frame=await canvas.screenshot({timeout:12000});
   }while(compareRenderedFrames(PNG.sync.read(frame),PNG.sync.read(frame)).visible<300&&Date.now()<deadline);
   if(compareRenderedFrames(PNG.sync.read(frame),PNG.sync.read(frame)).visible<300)throw Error('blank-frame: no rendered character');
   fs.writeFileSync(framePath,frame);
   pass.push({id:c.id,gameId:c.gameId,sourceIdentity:sourceIdentity(c),rendererIdentity:renderer,frameSha256:sha256(frame)});
   console.log('REPAIR_PREVIEW_PASS',c.gameId,c.id);
  }catch(error){fail.push({id:c.id,gameId:c.gameId,sourceIdentity:sourceIdentity(c),error:String(error.message||error).slice(0,600)});console.log('REPAIR_PREVIEW_FAIL',c.id,fail.at(-1).error)}
  finally{await page.close();checkpoint()}
 }
}finally{
 await browser.close();
 checkpoint();
}
console.log('REPAIR_PREVIEW_RESULT',JSON.stringify({shard,passed:pass.length,failed:fail.length}));
