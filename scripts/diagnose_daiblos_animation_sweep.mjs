// Compare animation choice vs. atlas corruption on a flagged and a control rig.
// Captures are diagnostic evidence, never replacements for model previews.
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const output='/tmp/daiblos-animation-sweep';
fs.mkdirSync(output,{recursive:true});
const executable=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!executable)throw Error('Chrome/Chromium missing');
const targets=[
 {id:'dbcore-30320_skin_pelorovis03_spine-30320_skin_pelorovis03',label:'pelorovis03-suspect'},
 {id:'dbcore-10010_skin_alps03_spine-10010_skin_alps03',label:'alps03-control'}
];
const browser=await chromium.launch({headless:true,executablePath:executable,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 for(const target of targets){
  const page=await browser.newPage({viewport:{width:1366,height:850}});
  const item={...target,frames:[]};
  try{
   await page.goto('http://127.0.0.1:8765/spine.html?id='+encodeURIComponent(target.id),{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(()=>/正在播放：|加载失败|下载失败|播放器初始化失败|播放失败/.test(document.querySelector('#status')?.textContent||''),null,{timeout:95000});
   item.initialStatus=await page.locator('#status').innerText();
   if(!item.initialStatus.startsWith('正在播放：'))throw Error(item.initialStatus);
   const all=await page.locator('#animationPicker option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));
   item.availableAnimations=all;
   item.initialAnimation=await page.locator('#animationPicker').inputValue();
   await page.locator('#player canvas').first().screenshot({path:output+'/'+target.label+'-initial.png'});
   // Sweep at most 12; include idle-like clips first, then the source order.
   const ranked=[...all].sort((a,b)=>Number(/idle|stand|wait|loop|default|home|breath/i.test(b))-Number(/idle|stand|wait|loop|default|home|breath/i.test(a)));
   for(const [i,name] of ranked.slice(0,12).entries()){
    try{
     await page.selectOption('#animationPicker',name);
     await page.waitForTimeout(1100);
     const file=target.label+'-'+i+'-'+name.replace(/[^a-z0-9_-]/gi,'_').slice(0,38)+'.png';
     await page.locator('#player canvas').first().screenshot({path:output+'/'+file});
     item.frames.push({animation:name,file,status:(await page.locator('#status').innerText()).slice(0,100)});
    }catch(e){item.frames.push({animation:name,error:String(e)})}
   }
  }catch(e){item.error=String(e)}
  finally{results.push(item);await page.close();}
 }
}finally{
 await browser.close();
 fs.writeFileSync(output+'/results.json',JSON.stringify({results,
  note:'Animation-frame comparison only; review screenshots. No claim of corrected atlas/mesh.'},null,2));
}
console.log('DAIBLOS_ANIMATION_SWEEP',JSON.stringify(results.map(({label,error,initialAnimation,availableAnimations,frames})=>({label,error,initialAnimation,availableAnimations,frames:frames.length}))));
