// Browser smoke tests for additional game formats, not proof that every model works.
// CI: python3 -m http.server 8765 & node scripts/test_additional_game_animations.mjs
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
const browserPath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!browserPath)throw Error('Chrome or Chromium missing');
const manifest=JSON.parse(fs.readFileSync('data/spine-newgames.json','utf8'));
const pick=(game,path)=>manifest.characters.find(c=>c.gameId===game&&c.sourcePath===path);
const more=JSON.parse(fs.readFileSync('data/live2d-moregames.json','utf8'));
const high=JSON.parse(fs.readFileSync('data/live2d-highquality.json','utf8'));
const mature=JSON.parse(fs.readFileSync('data/live2d-mature.json','utf8'));
const daiblos=JSON.parse(fs.readFileSync('data/spine-daiblos-core.json','utf8'));
const cases=[
 {type:'spine',game:'daibloscore',character:daiblos.characters.find(c=>c.resourceStem==='10010_skin_Alps03')},
 {type:'cubism',game:'tokyonecro',character:mature.characters.find(c=>c.id==='tn-l2d00055')},
 {type:'cubism',game:'maidslife',character:mature.characters.find(c=>c.id==='ml-ele_a0')},
 {type:'cubism',game:'lovecube',character:mature.characters.find(c=>c.id==='lc-akira_st01_w'),allowNoMotions:true},
 {type:'cubism',game:'foxhimezero',character:mature.characters.find(c=>c.id==='fh-ruri_miko')},
 {type:'cubism',game:'girldimension',character:high.characters.find(c=>c.id==='gd-001-c_0005')},
 {type:'cubism',game:'sinsevendeadlysins',character:high.characters.find(c=>c.id==='sds-xch001_01')},
 {type:'cubism',game:'touhoucannonball',character:more.characters.find(c=>c.id==='tc-reimu')},
 {type:'cubism',game:'girlscafegun',character:more.characters.find(c=>c.id==='gc-girl01-l2d00')},
 {type:'cubism',game:'girlsfrontline',character:pick('girlsfrontline','少女前线 girls Frontline/live2dnew/79type_1402/normal/normal.model3.json')},
 {type:'cubism',game:'konosuba',character:pick('konosuba','为美好的世界献上祝福！Fantastic Days/1003104/1003104.model3.json')},
 {type:'spine',game:'arknights',character:manifest.characters.find(c=>c.gameId==='arknights'&&c.resourceStem==='char_002_amiya')}
];
if(cases.some(c=>!c.character))throw Error('Known verified source-directory cases missing from new catalog');
const browser=await chromium.launch({headless:true,executablePath:browserPath,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 const page=await browser.newPage({viewport:{width:1366,height:850},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const test of cases){
  const start=Date.now();
  await page.goto('http://127.0.0.1:8765/spine.html?id='+encodeURIComponent(test.character.id),{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(id=>document.querySelector('#characters')?.value===id,test.character.id,{timeout:35000});
  await page.waitForFunction(()=>{
   const text=document.querySelector('#status')?.textContent||'';
   return text.startsWith('正在播放：')||text.includes('失败')||text.includes('超时')||text.includes('未通过来源校验');
  },null,{timeout:120000});
  const data=await page.evaluate(()=>({
   status:document.querySelector('#status')?.textContent||'',
   game:document.querySelector('#gameFilter')?.value,
   enabled:!document.querySelector('#animationPicker')?.disabled,
   animations:[...(document.querySelector('#animationPicker')?.options||[])].filter(option=>option.value).length,
   frame:!!document.querySelector('iframe.azurlane-live2d-frame'),
   canvas:!!document.querySelector('#player canvas')
  }));
  results.push({game:test.game,id:test.character.id,elapsedMs:Date.now()-start,...data});
  console.log('NEW_GAME_RESULT',JSON.stringify(results.at(-1)));
  const collection=test.character.collectionId||test.character.gameId;
  if(!data.status.startsWith('正在播放：')||data.game!==collection||(!test.allowNoMotions&&(!data.enabled||!data.animations)))
   throw Error('New model not playable: '+JSON.stringify(results.at(-1))+' page errors: '+errors.join('; '));
  if(test.game==='lovecube'||test.game==='foxhimezero'){
   const thumb=page.locator('.character-card[data-character-id="'+test.character.id+'"] img');
   await thumb.waitFor({state:'visible',timeout:15000});
   const preview=await thumb.evaluate(async image=>{try{await image.decode()}catch(e){}return {width:image.naturalWidth,height:image.naturalHeight,src:image.currentSrc}});
   if(preview.width<100||preview.height<100)throw Error('Missing or stale matching-model WebP: '+JSON.stringify(preview));
  }
  const canvas=test.type==='cubism'
   ?page.frameLocator('iframe.azurlane-live2d-frame').locator('#live2dCanvas')
   :page.locator('#player canvas').first();
  await canvas.waitFor({state:'visible',timeout:12000});
  await page.waitForTimeout(900);
  const filename='/tmp/newgames-'+test.game+'.png';
  await canvas.screenshot({path:filename,timeout:18000});
  const png=PNG.sync.read(fs.readFileSync(filename));
  const dataBytes=png.data,stride=Math.max(1,Math.floor(png.width*png.height/1500));
  let n=0,sum=0,sum2=0;
  for(let i=0;i<png.width*png.height;i+=stride){
   const pos=i*4;
   const luminance=.2126*dataBytes[pos]+.7152*dataBytes[pos+1]+.0722*dataBytes[pos+2];
   sum+=luminance;sum2+=luminance*luminance;n++;
  }
  const deviation=Math.sqrt(Math.max(0,sum2/n-(sum/n)**2));
  console.log('NEW_GAME_RENDER_FRAME',test.game,png.width,png.height,'deviation',deviation.toFixed(2));
  if(deviation<8)throw Error('No discernible animated character pixels for '+test.game+' (stddev '+deviation.toFixed(2)+')');
  if(test.type==='cubism'){
   if(!data.frame)throw Error('Missing Cubism stage: '+test.character.id);
   if(!test.allowNoMotions){
    if(data.animations<1)throw Error('Unnamed motion group was ignored');
    await page.locator('#animationPicker').selectOption({index:Math.min(1,data.animations-1)});
   }else if(data.animations>0)throw Error('LOVE³ advertised motions absent upstream');
  }else if(!data.canvas)throw Error('Spine model missing actual canvas: '+test.character.id);
 }
 if(errors.length)throw Error('Browser JS errors: '+errors.join('; '));
}finally{
 fs.writeFileSync('/tmp/newgames-animation-results.json',JSON.stringify(results,null,2));
 await browser.close();
}
