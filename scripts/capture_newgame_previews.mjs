// Sharded real-browser capture: successful, nonblank model screenshots only.
// Rebuild missing exact-model preview frames after 2026-10-22 catalog/UI fixes.
// Usage: node scripts/capture_newgame_previews.mjs SHARD SHARDS
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {selectPending} from './preview_capture_queue.mjs';

const shard=Number(process.argv[2]||0),shards=Number(process.argv[3]||24);
if(!Number.isInteger(shard)||!Number.isInteger(shards)||shard<0||shard>=shards)throw Error('Invalid shard');
// Catalog and output directory are parameters, not game-specific forks.
const catalogPath=process.argv[4]||'data/spine-newgames.json';
const root=process.argv[5]||'tmp/newgame-output';
const characters=selectPending(catalogPath,shard,shards);
fs.mkdirSync(path.join(root,'frames'),{recursive:true});
fs.mkdirSync(path.join(root,'reports'),{recursive:true});
const bin=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!bin)throw Error('Chrome/Chromium not installed');
const browser=await chromium.launch({headless:true,executablePath:bin,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const pass=[],fail=[];
try{
 for(const c of characters){
  const page=await browser.newPage({viewport:{width:1366,height:850},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message.slice(0,180)));
  try{
   await page.goto('http://127.0.0.1:8765/spine.html?id='+encodeURIComponent(c.id),{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(id=>document.querySelector('#characters')?.value===id,c.id,{timeout:30000});
   await page.waitForFunction(()=>{
    const s=document.querySelector('#status')?.textContent||'';
    return s.startsWith('正在播放：')||s.includes('失败')||s.includes('超时')||s.includes('未通过来源校验');
   },null,{timeout:60000});
   const status=await page.locator('#status').textContent();
   if(!status.startsWith('正在播放：'))throw Error(status);
   const canvas=c.engine==='cubism'
    ?page.frameLocator('iframe.azurlane-live2d-frame').locator('#live2dCanvas')
    :page.locator('#player canvas').first();
   await canvas.waitFor({state:'visible',timeout:15000});
   await page.waitForTimeout(1150);
   const file=path.join(root,'frames',c.gameId+'-'+c.id+'.png');
   await canvas.screenshot({path:file,timeout:20000});
   const png=PNG.sync.read(fs.readFileSync(file));
   let n=0,sum=0,sum2=0;
   const skip=Math.max(1,Math.floor(png.width*png.height/1800));
   for(let i=0;i<png.width*png.height;i+=skip){
    const p=i*4,lum=.2126*png.data[p]+.7152*png.data[p+1]+.0722*png.data[p+2];
    sum+=lum;sum2+=lum*lum;n++;
   }
   const deviation=Math.sqrt(Math.max(0,sum2/n-(sum/n)**2));
   if(deviation<8){fs.unlinkSync(file);throw Error('Blank/tiny pixel variance '+deviation.toFixed(2))}
   pass.push({id:c.id,game:c.gameId,model:c.sourcePath,stdev:+deviation.toFixed(2)});
   console.log('NEWGAME_FRAME_PASS',c.gameId,c.id,deviation.toFixed(2));
  }catch(e){
   fail.push({id:c.id,game:c.gameId,error:String(e.message||e).slice(0,240),jsErrors:errors.slice(-2)});
   console.log('NEWGAME_FRAME_FAIL',c.gameId,c.id,fail.at(-1).error);
  }finally{await page.close()}
 }
}finally{
 await browser.close();
 fs.writeFileSync(path.join(root,'reports','shard-'+shard+'.json'),JSON.stringify({shard,shards,attempted:characters.length,pass,fail},null,2));
}
console.log('NEWGAME_SHARD_RESULT',shard,pass.length+'/'+characters.length);
