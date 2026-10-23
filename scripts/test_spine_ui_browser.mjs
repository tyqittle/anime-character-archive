// Browser checks for the gallery player UX: selection, deep links, overlays,
// advanced controls, and seamless version switches without reloading the document.
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readCharacters} from './catalog_registry.mjs';
const require=createRequire(import.meta.url);
const {uniqueAnimationEntries}=require('../assets/js/spine/animation-identity.js');
const expectedCharacters=uniqueAnimationEntries(readCharacters());
const expectedInventory={byGame:{},byEngine:{}};
for(const c of expectedCharacters){
 const game=c.gameId||'nikke',engine=game+'/'+(c.engine==='cubism'?'cubism':'spine');
 expectedInventory.byGame[game]=(expectedInventory.byGame[game]||0)+1;
 expectedInventory.byEngine[engine]=(expectedInventory.byEngine[engine]||0)+1;
}
const expectedBd2Count=expectedInventory.byGame.browndust2;
const expectedOptions=collection=>Math.min(640,expectedCharacters.filter(c=>(c.collectionId||c.gameId)===collection).length)+1;
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
  // Mobile is an immersive stage too: open the left drawer for catalog tests.
  if(viewport.width<=850){
   await page.locator('#toggleLeftPanel').click();
   if(await page.locator('#toggleLeftPanel').getAttribute('aria-expanded')!=='true')
    throw Error('Mobile catalog drawer did not open');
  }
  // Engine-driven merge regression: no game should disappear because its
  // entries arrived in a different manifest or use Cubism instead of Spine.
  const inventory=await page.evaluate(()=>{
   const byGame={},byEngine={};
   for(const c of allCharacters){
    byGame[c.gameId||'nikke']=(byGame[c.gameId||'nikke']||0)+1;
    const key=(c.gameId||'nikke')+'/'+(c.engine==='cubism'?'cubism':'spine');
    byEngine[key]=(byEngine[key]||0)+1;
   }
   return {byGame,byEngine};
  });
  assert.deepEqual(inventory,expectedInventory,'Browser merge must preserve every canonical registered model');
  // The all-games auxiliary select is hidden; it must never allocate every
  // option on a gallery with 2,000+ dynamic models.
  const allOptions=await page.locator('#characters option').count();
  if(allOptions>641)throw Error('All-games selector allocated too many options: '+allOptions);
  await page.selectOption('#gameFilter','arknights');
  if((await page.locator('#characters option').count())!==expectedOptions('arknights'))
    throw Error('Expected 92 animated Arknights illustrations; battle rigs leaked into main list');
  await page.selectOption('#gameFilter','arknights-battle');
  if((await page.locator('#characters option').count())!==expectedOptions('arknights-battle'))
    throw Error('Expected 359 separate BattleFront sprites');
  await page.selectOption('#gameFilter','all');
  // A non-first-page deep-link must still be selectable with a limited dropdown.
  const deepLinkModel=await page.evaluate(()=>allCharacters.find((c,i)=>i>maxCharacterSelectOptions+20)?.id);
  if(deepLinkModel){
    await page.evaluate(id=>{
      const c=allCharacters.find(x=>x.id===id);
      selectCharacter(c);refreshCardSelection();
    },deepLinkModel);
    if(await page.locator('#characters').inputValue()!==deepLinkModel)
      throw Error('Selected model was lost after hidden select windowing');
  }
  await page.selectOption('#gameFilter','all');
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
    side:box('.side'),stage:box('.stage'),player:box('#player'),inspector:box('.theater-inspector'),
    toolbar:box('.stage-toolbar'),friends:box('.stage-friends-drawer'),voiceLanguage:box('#voiceLanguage'),
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
   if(layout.player.top>2||layout.player.bottom<layout.viewportH-2||Math.abs(layout.player.height-layout.viewportH)>3)
    throw Error('Desktop model canvas must span from viewport top to bottom: '+JSON.stringify(layout));
   if(layout.inspector.height<layout.viewportH-2)
    throw Error('Right control pane must be full-height: '+JSON.stringify(layout));
   const structure=await page.evaluate(()=>({
    toolbarInsideRight:document.querySelector('.theater-inspector').contains(document.querySelector('.stage-toolbar')),
    statusInsideRight:document.querySelector('.theater-inspector').contains(document.querySelector('#status')),
    linksInsideRight:document.querySelector('.theater-inspector').contains(document.querySelector('.stage-friends-drawer')),
    stageOnlyPlayer:!document.querySelector('.stage').contains(document.querySelector('.stage-toolbar'))
   }));
   if(Object.values(structure).some(x=>!x))
    throw Error('Player controls are not in the right drawer: '+JSON.stringify(structure));
   if(layout.bodyOverflowY!=='hidden')
    throw Error('Desktop document scrolling was not locked: '+JSON.stringify(layout));
  }else if(Math.abs(layout.player.height-layout.viewportH)>3||layout.player.top>2){
   throw Error('Mobile animation stage must span the full viewport: '+JSON.stringify(layout));
  }
  if(viewport.width>=851){
   // Expand on demand, then collapse without losing the original player height.
   const drawer=page.locator('.stage-friends-drawer');
   await drawer.locator('summary').click();
   const opened=await page.evaluate(()=>({
    isOpen:document.querySelector('.stage-friends-drawer').open,
    links:document.querySelectorAll('.stage-friends-drawer a').length,
    playerHeight:document.querySelector('#player').getBoundingClientRect().height
   }));
   if(!opened.isOpen||opened.links<3||Math.abs(opened.playerHeight-layout.viewportH)>3)
    throw Error('Opening friend links must never shrink the stage: '+JSON.stringify(opened));
   await drawer.locator('summary').click();
   const restored=await page.locator('#player').evaluate(el=>el.getBoundingClientRect().height);
   if(Math.abs(restored-layout.player.height)>3)
    throw Error('Collapsing friend links changed the model height');
   const startWidth=layout.player.width;
   await page.locator('#toggleRightPanel').click();
   const withoutRight=await page.locator('#player').evaluate(el=>el.getBoundingClientRect().width);
   if(withoutRight<startWidth+200||await page.locator('#toggleRightPanel').getAttribute('aria-expanded')!=='false')
    throw Error('Collapsing right control pane did not widen the player');
   await page.locator('#toggleLeftPanel').click();
   const withoutBoth=await page.locator('#player').evaluate(el=>el.getBoundingClientRect().width);
   if(withoutBoth<withoutRight+200||await page.locator('#toggleLeftPanel').getAttribute('aria-expanded')!=='false')
    throw Error('Collapsing left catalog pane did not widen the player');
   await page.locator('#toggleRightPanel').click();
   await page.locator('#toggleLeftPanel').click();
   const recovered=await page.locator('#player').evaluate(el=>el.getBoundingClientRect());
   if(Math.abs(recovered.width-startWidth)>3||Math.abs(recovered.height-layout.viewportH)>3)
    throw Error('Expanding side panes did not restore the original stage geometry');
   // Reproduce the 1700 × 864 layout shown in the report.
   await page.setViewportSize({width:1700,height:864});
   const wide=await page.evaluate(()=>({
    player:document.querySelector('#player').getBoundingClientRect().toJSON(),
    stage:document.querySelector('.stage').getBoundingClientRect().toJSON()
   }));
   if(wide.player.height<862||wide.player.top>2||wide.player.bottom<862||wide.stage.width<800)
    throw Error('Wide theater still clips the full-height stage: '+JSON.stringify(wide));
   await page.setViewportSize(viewport);
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
  if(await cards.count()!==96)throw Error('Expected a bounded first page of 96 costumes, got '+await cards.count());
  while(await page.locator('#characterCards .load-more-characters').count())
   await page.locator('#characterCards .load-more-characters').click();
  if(await cards.count()!==expectedBd2Count)throw Error('Pagination must expose all canonical BD2 costumes, got '+await cards.count());
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
  if(await imgs.count()!==expectedBd2Count)throw Error('All canonical costumes must show exact-model thumbnails, not placeholders');
  for(const index of [0,1,2,3,4,50,104,153,201,expectedBd2Count-1]){
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
  if(roleCount<1||roleCount>=expectedBd2Count)throw Error('BD2 role selector failed to group costumes');
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
