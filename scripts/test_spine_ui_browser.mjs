// Browser checks for the gallery player UX: selection, deep links, overlays,
// advanced controls, and seamless version switches without reloading the document.
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
  // The desktop layout is a fixed one-screen workspace, never a page scroller.
  // The card grid remains independently scrollable even with hundreds of skins.
  const layout=await page.evaluate(()=>{
   const box=id=>{const r=document.querySelector(id).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,width:r.width}};
   const list=document.querySelector('#characterCards');
   const sidebar=document.querySelector('.side');
   const nav=document.querySelector('.side-sitebar');
   return {
    viewportH:innerHeight,viewportW:innerWidth,
    documentH:document.documentElement.scrollHeight,
    bodyH:document.body.scrollHeight,
    scrollY:window.scrollY,
    navInSidebar:sidebar.contains(nav),
    side:box('.side'),stage:box('.stage'),player:box('#player'),
    listClientH:list.clientHeight,listScrollH:list.scrollHeight,
    bodyOverflowY:getComputedStyle(document.body).overflowY
   };
  });
  if(!layout.navInSidebar)throw Error('Top navigation did not move into the left sidebar');
  if(viewport.width>=851){
   if(layout.documentH>layout.viewportH+2||layout.bodyH>layout.viewportH+2)
    throw Error('Desktop still has document scrolling: '+JSON.stringify(layout));
   if(layout.side.bottom>layout.viewportH+1||layout.stage.bottom>layout.viewportH+1)
    throw Error('Desktop sidebar or stage escaped the viewport: '+JSON.stringify(layout));
   if(layout.player.height<220)
    throw Error('Desktop stage player has insufficient remaining height: '+JSON.stringify(layout));
   if(layout.bodyOverflowY!=='hidden')
    throw Error('Desktop document scrolling was not locked: '+JSON.stringify(layout));
  }else if(layout.player.height<290){
   throw Error('Mobile animation stage was collapsed: '+JSON.stringify(layout));
  }
  if(await page.locator('.advanced-tools').evaluate(el=>el.open))throw Error('Advanced tools are expanded by default');
  await page.selectOption('#gameFilter','browndust2');
  if(await page.locator('#nikke').count())throw Error('Main play button must not exist');
  const pilotCard=page.locator('#characterCards .character-card').filter({hasText:'戴安娜'});
  await page.selectOption('#gameFilter','browndust2');
  await pilotCard.waitFor({timeout:15000});
  if((await pilotCard.locator('.nm').textContent())!=='戴安娜')throw Error('BD2 card shows bulky unformatted bilingual name');
  if((await pilotCard.locator('small').textContent()).includes('bd2-char'))throw Error('Raw model ID is cluttering the character card');
  const cards=page.locator('#characterCards .character-card');
  if(await cards.count()!==209)throw Error('Expected all 209 BD2 costumes, got '+await cards.count());
  // Catch the CSS-grid regression where 240+ buttons shrink to 16px
  // inside a flex-column sidebar, hiding all thumbnails and text.
  const tileMetrics=await cards.first().evaluate(card=>{
   const img=card.querySelector('img, .fallback');
   const name=card.querySelector('.nm');
   const cardBox=card.getBoundingClientRect();
   const imageBox=img?.getBoundingClientRect();
   const labelBox=name?.getBoundingClientRect();
   const grid=card.parentElement;
   return {height:cardBox.height,imageHeight:imageBox?.height,labelHeight:labelBox?.height,
    labelVisible:!!labelBox&&labelBox.top>=cardBox.top-1&&labelBox.bottom<=cardBox.bottom+1,
    autoRows:getComputedStyle(grid).gridAutoRows,scrollHeight:grid.scrollHeight,clientHeight:grid.clientHeight};
  });
  if(tileMetrics.height<145||tileMetrics.imageHeight<85||!tileMetrics.labelVisible||!tileMetrics.autoRows.includes('max-content'))
   throw Error('Character cards collapsed, clipped or lost their thumbnails: '+JSON.stringify(tileMetrics));

  if(viewport.width>=851){
   const scroller=await page.locator('#characterCards').evaluate(el=>({
    height:el.clientHeight,total:el.scrollHeight,overflow:getComputedStyle(el).overflowY
   }));
   if(scroller.total<=scroller.height+30||!['auto','scroll'].includes(scroller.overflow))
    throw Error('Character gallery does not have its own scroll region: '+JSON.stringify(scroller));
  }

  const imgs=page.locator('#characterCards img');
  if(await imgs.count()!==209)throw Error('All 209 costumes must show exact-model thumbnails, not placeholders');
  for(const index of [0,1,2,3,4,50,104,153,201,208]){
   const img=imgs.nth(index);
   await img.scrollIntoViewIfNeeded();
   await img.evaluate(el=>new Promise((resolve,reject)=>{
    if(el.complete){el.naturalWidth>60?resolve():reject(Error('Thumbnail failed to decode'));return}
    el.addEventListener('load',()=>resolve(),{once:true});
    el.addEventListener('error',()=>reject(Error('Thumbnail request failed')),{once:true});
   }));
   if(!await img.evaluate(el=>el.naturalHeight>60))throw Error('Blank thumbnail '+index);
  }
  await page.selectOption('#bd2CharacterFilter','Diana');
  const roleCount=await cards.count();
  if(roleCount<1||roleCount>=209)throw Error('BD2 role selector failed to group costumes');
  await page.selectOption('#bd2CharacterFilter','');
  await page.selectOption('#gameFilter','browndust2');
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
  await page.locator('#characterCards .character-card').filter({hasText:'日蚀'}).click();
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
  // Never navigate on a Spine runtime boundary. This synthetic cache test
  // proves the same DOM, filters, advanced tools and selected role survive.
  // Real asset playback is separately covered by test_spine_browser.mjs.
  let navigations=0;
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++});
  const switchResult=await page.evaluate(async()=>{
   const root=document.body,stage=document.querySelector('#stage');
   const previous={SpinePlayer:class Mock38{}},next={SpinePlayer:class Mock41{}};
   runtimeCache.set('3.8',{namespace:previous,stylesheet:'./vendor/spine38/spine-player.css'});
   runtimeCache.set('4.1',{namespace:next,stylesheet:'./vendor/spine38/spine-player.css'});
   loadedVersion='3.8';window.spine=previous;
   const beforeScroll=window.scrollY;
   setVersion('4.1');
   await ensureRuntime('4.1');
   const to41=loadedVersion==='4.1'&&window.spine===next;
   setVersion('3.8');
   await ensureRuntime('3.8');
   return {
    to41, back38:loadedVersion==='3.8'&&window.spine===previous,
    sameDOM:document.body===root&&document.querySelector('#stage')===stage,
    sameSelection:document.querySelector('#characters').value==='bd2-char000201',
    sameGame:document.querySelector('#gameFilter').value==='browndust2',
    advancedOpen:document.querySelector('.advanced-tools').open,
    scrollStable:Math.abs(window.scrollY-beforeScroll)<=1
   };
  });
  if(navigations||Object.values(switchResult).some(x=>x!==true))
   throw Error('Runtime switch reloaded or lost UI state: '+JSON.stringify({navigations,switchResult}));
  if(errors.length)throw Error('Browser JavaScript errors: '+errors.join('; '));
  console.log('PASS Spine UI continuity',viewport.width+'x'+viewport.height,'selected',selected.selected);
  await page.close();
 }
}finally{await browser.close()}
