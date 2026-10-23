// One missing-preview renderer for all catalogs and both animation engines.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {compareRenderedFrames} from './animation_frame_check.mjs';
import {readCharacters,sourceIdentity} from './catalog_registry.mjs';
const pending=new Set(JSON.parse(fs.readFileSync('tmp/repair-pending.json','utf8')));
const shard=Number(process.argv[2]??0),count=Number(process.argv[3]??8);
if(!Number.isInteger(shard)||!Number.isInteger(count)||count<1||shard<0||shard>=count)throw Error('Invalid preview shard');
const all=readCharacters();
const todo=all.filter(c=>pending.has(c.id)).filter((_,i)=>i%count===shard);
const root='tmp/repair-output';
for(const name of ['frames','reports'])fs.mkdirSync(path.join(root,name),{recursive:true});
const bin=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!bin)throw Error('Chromium missing');
const browser=await chromium.launch({headless:true,executablePath:bin,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1366,height:850}});
const pass=[],fail=[];
try{
 for(const c of todo){
  const page=await context.newPage();
  try{
   await page.goto('http://127.0.0.1:8765/spine.html?id='+encodeURIComponent(c.id),{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(id=>document.querySelector('#characters')?.value===id,c.id,{timeout:30000});
   await page.waitForFunction(()=>{const node=document.querySelector('#status'),s=node?.textContent||'';return s.startsWith('正在播放：')||node?.classList.contains('error')},null,{timeout:95000});
   const status=await page.locator('#status').textContent();
   if(!status.startsWith('正在播放：'))throw Error(status);
   const canvas=c.engine==='cubism'?page.frameLocator('iframe.azurlane-live2d-frame').locator('#live2dCanvas'):page.locator('#player canvas').first();
   await canvas.waitFor({state:'visible',timeout:10000});
   let frame;const deadline=Date.now()+9000;
   do{
    await page.waitForTimeout(250);frame=await canvas.screenshot({timeout:12000});
   }while(compareRenderedFrames(PNG.sync.read(frame),PNG.sync.read(frame)).visible<300&&Date.now()<deadline);
   if(compareRenderedFrames(PNG.sync.read(frame),PNG.sync.read(frame)).visible<300)throw Error('blank-frame: no rendered character');
   fs.writeFileSync(path.join(root,'frames',c.gameId+'-'+c.id+'.png'),frame);
   pass.push({id:c.id,gameId:c.gameId,sourceIdentity:sourceIdentity(c)});
   console.log('REPAIR_PREVIEW_PASS',c.gameId,c.id);
  }catch(error){fail.push({id:c.id,gameId:c.gameId,sourceIdentity:sourceIdentity(c),error:String(error.message||error).slice(0,600)});console.log('REPAIR_PREVIEW_FAIL',c.id,fail.at(-1).error)}
  finally{await page.close()}
 }
}finally{
 await browser.close();
 fs.writeFileSync(path.join(root,'reports','shard-'+shard+'.json'),JSON.stringify({shard,pass,fail},null,2));
}
console.log('REPAIR_PREVIEW_RESULT',JSON.stringify({shard,passed:pass.length,failed:fail.length}));
