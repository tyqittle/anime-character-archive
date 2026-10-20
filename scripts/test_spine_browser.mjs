// Browser acceptance test for both animation sources. Requires: npm install playwright-core.
// On GitHub Actions, use the preinstalled Chrome browser. Does not fake a successful animation.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { PNG } from 'pngjs';
const url='http://127.0.0.1:8765/spine.html';
const executable=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!executable)throw new Error('No installed Chrome/Chromium executable');
const browser=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1366,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',msg=>{if(msg.type()==='error')errors.push('CONSOLE: '+msg.text())});
page.on('response',response=>{if(response.status()>=400)errors.push('HTTP '+response.status()+' '+response.url())});
page.on('requestfailed',request=>errors.push('REQUEST '+request.url()+' '+request.failure()?.errorText));
const outcomes=[];
try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>document.querySelectorAll('#characters option').length>5,{timeout:20000});
 console.log('INITIAL_OPTION_COUNT',await page.locator('#characters option').count());
 for(const [game,id] of [['nikke','c010'],['bluearchive','ba-ch0058_home'],['bluearchive','ba-ch0060_home']]){
  await page.selectOption('#gameFilter',game);
  await page.waitForTimeout(300);
  await page.selectOption('#characters',id);
  await page.click('#nikke');
  const deadline=Date.now()+130000;
  let state='timeout',message='';
  while(Date.now()<deadline){
   if(page.isClosed()){state='page-closed';break}
   message=await page.locator('#status').innerText().catch(()=>'(navigating)');
   if(message.includes('正在播放：')||message.includes('播放成功')){state='playback-success';break}
   if(/加载失败|资源下载失败|播放失败|超时|版本.*不支持|无法解析|初始化失败|自动播放动作失败|没有找到可播放的动作/.test(message)){state='playback-failure';break}
   await page.waitForTimeout(900);
  }
  const canvas=await page.locator('#player canvas').count().catch(()=>0);
  let visiblePixels=null,changedPixels=null;
  if(state==='playback-success'&&canvas){
   const first=PNG.sync.read(await page.locator('#player canvas').screenshot());
   await page.waitForTimeout(1700);
   const second=PNG.sync.read(await page.locator('#player canvas').screenshot());
   visiblePixels=0;changedPixels=0;
   const bg=[first.data[0],first.data[1],first.data[2]];
   for(let i=0;i<first.data.length;i+=4){
    let richness=0,motion=0;
    for(let q=0;q<3;q++){richness+=Math.abs(first.data[i+q]-bg[q]);motion+=Math.abs(second.data[i+q]-first.data[i+q]);}
    if(richness>100)visiblePixels++;
    if(motion>45)changedPixels++;
   }
   if(visiblePixels<300)state='playback-blank';
   else if(changedPixels<100)state='playback-static';
   else state='playback-animated';
  }
  outcomes.push({game,id,state,message,canvas,visiblePixels,changedPixels});
  console.log('PLAYBACK_OUTCOME',JSON.stringify(outcomes[outcomes.length-1]));
 }
}finally{console.log('BROWSER_ERRORS',JSON.stringify(errors.slice(0,25)));await browser.close()}
fs.writeFileSync('/tmp/spine-browser-results.json',JSON.stringify({outcomes,errors},null,2));
if(outcomes.some(x=>x.state!=='playback-animated'))process.exitCode=1;
