// Browser checks for the gallery player UX: selection, deep links, overlays,
// advanced controls, and version-boundary navigation without losing the model.
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const executablePath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!executablePath)throw Error('Chromium is not installed');
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/spine.html',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>typeof allCharacters!=='undefined'&&allCharacters.some(x=>x.id==='bd2-char000201'),null,{timeout:20000});
  if(await page.locator('.advanced-tools').evaluate(el=>el.open))throw Error('Advanced tools are expanded by default');
  await page.selectOption('#gameFilter','browndust2');
  if(await page.locator('#nikke').count())throw Error('Main play button must not exist');
  if(await page.locator('#playSaved, #local').count())throw Error('Advanced play buttons still exist');
  await page.selectOption('#characters','bd2-char000201');
  const selected=await page.evaluate(()=>({
   url:new URL(location.href).searchParams.get('id'),
   selected:document.querySelector('#characters').value,
   active:[...document.querySelectorAll('#characterCards button[aria-pressed="true"]')].length,
   autoStarted:sequence>0
  }));
  if(selected.url!=='bd2-char000201'||selected.selected!=='bd2-char000201'||selected.active!==1||!selected.autoStarted)
   throw Error('Dropdown did not auto-play and sync the selection: '+JSON.stringify(selected));
  const firstAttempt=await page.evaluate(()=>sequence);
  await page.locator('#characterCards .character-card').filter({hasText:'bd2-char000701'}).click();
  await page.waitForFunction(n=>sequence>n,firstAttempt,{timeout:10000});
  if(await page.locator('#characters').inputValue()!=='bd2-char000701')throw Error('Card did not select its character');
  await page.selectOption('#characters','bd2-char000201');
  await page.waitForFunction(()=>new URL(location.href).searchParams.get('id')==='bd2-char000201'&&sequence>=3,null,{timeout:10000});
  // Isolate the synthetic loading-overlay assertion from any genuine asynchronous fetch updates.
  await page.evaluate(()=>{cancelCharacterDownload();status('正在读取角色测试数据…')});
  if(await page.locator('#loadNotice').evaluate(el=>el.hidden))throw Error('Loading notice did not appear');
  await page.evaluate(()=>status('正在播放：测试',false));
  if(!(await page.locator('#loadNotice').evaluate(el=>el.hidden)))throw Error('Loading notice remained after playback');
  await page.locator('.advanced-tools summary').click();
  if(!(await page.locator('.advanced-tools').evaluate(el=>el.open)))throw Error('Cannot open advanced tools');
  // Force a simulated runtime mismatch. Real 3.8/4.x runtime globals
  // cannot coexist safely, so a page navigation is expected, but the
  // selected model must be restored after it.
  await page.evaluate(()=>{
   loadedVersion='3.8';
   document.querySelector('#version').value='3.8';
   setVersion('4.1','browndust2-bd2-char000201');
  });
  await page.waitForURL(url=>url.searchParams.get('v')==='4.1'&&url.searchParams.get('id')==='bd2-char000201',{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#characters').value==='bd2-char000201'&&document.querySelector('#gameFilter').value==='browndust2',null,{timeout:25000});
  if(errors.length)throw Error('Browser JavaScript errors: '+errors.join('; '));
  console.log('PASS Spine UI continuity',viewport.width+'x'+viewport.height,'selected',selected.selected);
  await page.close();
 }
}finally{await browser.close()}
