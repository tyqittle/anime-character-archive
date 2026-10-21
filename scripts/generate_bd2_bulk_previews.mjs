// Batch-generate *matching* portraits by rendering each original BD2 Spine model.
// Failed model loads are recorded but NEVER marked playable or given a fake image.
// Usage: BD2_SHARD=0 BD2_SHARDS=12 node scripts/generate_bd2_bulk_previews.mjs
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import sharp from 'sharp';

const shard=Number(process.env.BD2_SHARD??'0');
const shards=Number(process.env.BD2_SHARDS??'12');
if(!Number.isInteger(shard)||!Number.isInteger(shards)||shards<1||shard<0||shard>=shards)throw Error('Invalid shard config');
const all=JSON.parse(fs.readFileSync('data/spine-bd2-characters.json','utf8')).characters;
if(all.length<200)throw Error('The full catalog has not been built yet');
const selected=all.filter((c,i)=>i%shards===shard&&!c.preview);
const root=path.resolve('build','bd2-bulk-shard-'+shard);
const destination=path.join(root,'previews');
fs.mkdirSync(destination,{recursive:true});
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!chrome)throw Error('Chromium is not available');
const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={shard,shards,attempted:selected.length,success:[],failed:[]};
try{
 for(const item of selected){
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const entry={id:item.id,character:item.characterName,costume:item.costume};
  try{
   await page.goto('http://127.0.0.1:8765/spine.html',{waitUntil:'domcontentloaded',timeout:25000});
   await page.waitForFunction(id=>typeof allCharacters!=='undefined'&&allCharacters.some(c=>c.id===id),item.id,{timeout:20000});
   await page.selectOption('#gameFilter','browndust2');
   await page.selectOption('#characters',item.id);
   await page.waitForFunction(()=>{
    const status=document.querySelector('#status')?.textContent||'';
    return status.startsWith('正在播放：')||/^(?:角色资源下载失败|播放失败|播放器初始化失败|加载失败|加载超时)/.test(status);
   },null,{timeout:90000});
   const label=await page.locator('#status').textContent();
   if(!label.startsWith('正在播放：'))throw Error('Playback failed: '+label);
   const correct=await page.evaluate(()=>player?.config?.premultipliedAlpha===false);
   if(!correct)throw Error('Expected BD2 straight-alpha render mode');
   const canvas=page.locator('#player canvas').first();
   await canvas.waitFor({timeout:8000});
   await page.waitForTimeout(450);
   const buf=await canvas.screenshot({timeout:10000});
   const png=PNG.sync.read(buf);
   const {width,height,data:rgba}=png;
   if(width<350||height<350)throw Error('Canvas too small');
   const corners=[[2,2],[width-3,2],[2,height-3],[width-3,height-3]];
   const bg=[0,1,2].map(c=>Math.round(corners.reduce((acc,[x,y])=>acc+rgba[(y*width+x)*4+c],0)/4));
   let l=width,t=height,r=-1,b=-1,count=0;
   for(let y=4;y<height-4;y+=2)for(let x=4;x<width-4;x+=2){
    const i=(y*width+x)*4;
    const delta=Math.abs(rgba[i]-bg[0])+Math.abs(rgba[i+1]-bg[1])+Math.abs(rgba[i+2]-bg[2]);
    if(delta<92)continue;
    count++;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
   }
   if(count<1100||r-l<80||b-t<100)throw Error('No actual full-body character detected in render');
   const marginX=Math.max(14,Math.round((r-l)*.06)),marginY=Math.max(14,Math.round((b-t)*.04));
   const x=Math.max(0,l-marginX),y=Math.max(0,t-marginY);
   const endX=Math.min(width,r+marginX),endY=Math.min(height,b+marginY);
   const name='browndust2-'+item.id+'.webp';
   const out=path.join(destination,name);
   await sharp(buf).extract({left:x,top:y,width:endX-x,height:endY-y})
      .resize(224,240,{fit:'contain',background:'#142238'})
      .webp({quality:82,effort:4}).toFile(out);
   const bytes=fs.statSync(out).size;
   if(bytes<2000||bytes>280000)throw Error('Thumbnail generated unexpected size: '+bytes);
   report.success.push({...entry,bytes,foregroundPixels:count,thumbnail:name});
   console.log('BD2_PREVIEW_PASS',item.id,bytes);
  }catch(err){
   report.failed.push({...entry,error:String(err?.message||err).slice(0,360)});
   console.log('BD2_PREVIEW_FAIL',item.id,String(err?.message||err).slice(0,240));
  }finally{await page.close()}
 }
}finally{await browser.close()}
fs.writeFileSync(path.join(root,'results.json'),JSON.stringify(report,null,2)+'\n');
console.log('BD2_SHARD_RESULT',JSON.stringify({shard,attempted:report.attempted,success:report.success.length,failed:report.failed.length}));
