// Compare the patched Spine 3.8 atlas handling against the original vendor runtime.\n// Keep included Daiblos rigs only; excluded Alps04 and Hades03 cannot load from the current catalog.
// Diagnostic only: no application monkeypatch is committed or enabled for users.
import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const browserPath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!browserPath)throw Error('No Chromium browser');
const all=JSON.parse(fs.readFileSync('data/spine-daiblos-core.json','utf8')).characters;
const picks=['10010_skin_Alps03','10010_skin_Alps05','30320_skin_Pelorovis03'];
const output='/tmp/daiblos-uv-diagnostic';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:browserPath,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const stem of picks){
  const entry=all.find(c=>c.resourceStem===stem);
  if(!entry){console.log('UV_DIAGNOSTIC_MISSING',stem);continue;}
  for(const variant of ['patched','native']){
   const page=await browser.newPage({viewport:{width:1366,height:850}});
   try{
    if(variant==='native')await page.route('**/assets/js/spine/spine-runtime.js?*',async route=>{
     const response=await route.fetch();
     const body=await response.text();
     const previous='if(legacy){patchSpine38AtlasRotations();patchSpine38HighDPI()}';
     if(!body.includes(previous))throw Error('No runtime atlas patch anchor');
     await route.fulfill({response,body:body.replace(previous,'if(legacy){patchSpine38HighDPI()}')});
    });
    await page.goto('http://127.0.0.1:8765/spine.html?id='+encodeURIComponent(entry.id),{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.startsWith('正在播放：'),null,{timeout:120000});
    await page.waitForTimeout(1200);
    const canvas=page.locator('#player canvas').first();
    const filename=path.join(output,stem+'-'+variant+'.png');
    await canvas.screenshot({path:filename,timeout:12000});
    console.log('UV_DIAGNOSTIC_CAPTURE',JSON.stringify({stem,variant,filename,status:await page.locator('#status').innerText()}));
   }catch(error){console.log('UV_DIAGNOSTIC_ERROR',JSON.stringify({stem,variant,error:String(error)}))}
   finally{await page.close()}
  }
 }
}finally{await browser.close()}
