import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const shard=Number(process.argv[2]||0),count=Number(process.argv[3]||8);
const all=JSON.parse(fs.readFileSync('data/live2d-azurlane.json','utf8')).characters.filter(c=>c.sourceRepo==='MilkyLan/AzurLane-Live2d');
const characters=all.filter((c,i)=>i%count===shard);
const executablePath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
fs.mkdirSync('tmp/al-frames',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let ok=0;
try{
 for(const c of characters){
  const page=await browser.newPage({viewport:{width:1366,height:850}});
  try{
   await page.goto('http://127.0.0.1:8765/spine.html?id='+encodeURIComponent(c.id),{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(id=>document.querySelector('#characters')?.value===id,c.id,{timeout:30000});
   await page.waitForFunction(()=>{const s=document.querySelector('#status')?.textContent||'';return s.startsWith('正在播放：')||s.includes('加载失败')||s.includes('初始化失败')||s.includes('超时');},null,{timeout:110000});
   const status=await page.locator('#status').textContent();
   if(!status.startsWith('正在播放：'))throw Error(status);
   const canvas=page.frameLocator('iframe.azurlane-live2d-frame').locator('#live2dCanvas');
   await canvas.waitFor({state:'visible'});
   await page.waitForTimeout(1500);
   await canvas.screenshot({path:path.join('tmp/al-frames',c.id+'.png'),timeout:18000});
   console.log('LIVE2D_RENDER_PASS',c.id);
   ok++;
  }catch(e){console.log('LIVE2D_RENDER_FAIL',c.id,String(e.message).slice(0,160))}
  finally{await page.close()}
 }
}finally{await browser.close()}
console.log('RESULT',shard,ok,'/',characters.length);
if(ok===0)process.exitCode=1;
