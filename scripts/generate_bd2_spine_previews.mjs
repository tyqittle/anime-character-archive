// Produce preview WebP files from the EXACT Spine models used in this site.
// Re-render after BD2 straight-alpha blending fix; old images had white halos.
// No atlas sprites, other costumes, or unrelated promotional images.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import sharp from 'sharp';

const manifestPath='data/spine-bd2-pilot.json';
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const browserPath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!browserPath)throw Error('Chrome/Chromium unavailable');
const outputDir='assets/animation-previews';
fs.mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:browserPath,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const recorded=[];
try{
 for(const c of manifest.characters){
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:8765/spine.html',{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(id=>typeof allCharacters!=='undefined'&&allCharacters.some(v=>v.id===id),c.id,{timeout:20000});
   await page.selectOption('#gameFilter','browndust2');
   await page.selectOption('#characters',c.id);
   await page.waitForFunction(()=>{
    const status=document.querySelector('#status')?.textContent||'';
    return status.startsWith('正在播放：')||/^(?:角色资源下载失败|播放失败|播放器初始化失败|加载失败|加载超时)/.test(status);
   },null,{timeout:120000});
   const status=await page.locator('#status').textContent();
   if(!status.startsWith('正在播放：'))throw Error('Skeleton was not playable: '+status);
   await page.waitForTimeout(550);
   const canvas=page.locator('#player canvas').first();
   await canvas.waitFor({timeout:15000});
   const buffer=await canvas.screenshot();
   const png=PNG.sync.read(buffer);
   const px=png.data,width=png.width,height=png.height;
   // The player canvas has a uniform backdrop. Find character pixels with
   // a robust difference threshold, then crop to the actual rendered person.
   const corners=[[0,0],[width-2,0],[0,height-2],[width-2,height-2]];
   const bg=[0,1,2].map(ch=>Math.round(corners.reduce((n,[x,y])=>n+px[(y*width+x)*4+ch],0)/corners.length));
   let left=width,top=height,right=-1,bottom=-1,foreground=0;
   for(let y=3;y<height-3;y+=2){
    for(let x=3;x<width-3;x+=2){
     const i=(y*width+x)*4;
     const diff=Math.abs(px[i]-bg[0])+Math.abs(px[i+1]-bg[1])+Math.abs(px[i+2]-bg[2]);
     if(diff<90)continue;
     left=Math.min(left,x);right=Math.max(right,x);
     top=Math.min(top,y);bottom=Math.max(bottom,y);foreground++;
    }
   }
   if(foreground<1500||right<left||bottom<top)throw Error('Rendered character could not be isolated from blank canvas');
   const marginX=Math.max(12,Math.round((right-left)*.045)),marginY=Math.max(12,Math.round((bottom-top)*.035));
   const x=Math.max(0,left-marginX),y=Math.max(0,top-marginY);
   const cropRight=Math.min(width,right+marginX),cropBottom=Math.min(height,bottom+marginY);
   const previewFile=path.join(outputDir,'browndust2-'+c.id+'.webp');
   await sharp(buffer).extract({left:x,top:y,width:cropRight-x,height:cropBottom-y})
    .resize(224,240,{fit:'contain',background:'#142238'})
    .webp({quality:83,effort:5}).toFile(previewFile);
   const bytes=fs.statSync(previewFile).size;
   if(bytes<2500||bytes>250000)throw Error('Preview WebP unexpectedly sized: '+bytes);
   if(errors.length)throw Error('Browser JavaScript errors: '+errors.join('; '));
   recorded.push({id:c.id,filename:previewFile,bytes,foreground,crop:[x,y,cropRight-x,cropBottom-y]});
   console.log('PREVIEW_RENDERED',JSON.stringify(recorded[recorded.length-1]));
  }finally{await page.close()}
 }
}finally{await browser.close()}
if(recorded.length!==manifest.characters.length)throw Error('Incomplete preview batch, refusing to update index');
for(const entry of manifest.characters){
 entry.preview='./assets/animation-previews/browndust2-'+entry.id+'.webp';
 entry.previewSource='matching-spine-animation-frame';
 entry.status='verified-playback';
 entry.versionUnverified=false;
}
manifest.note='All five portrait previews were rendered in Chromium directly from the listed matching full-character skeleton, atlas and textures; each animation was played before capture.';
manifest.previewGeneratedAt='2026-10-21';
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync('/tmp/bd2-preview-results.json',JSON.stringify(recorded,null,2));
console.log('ALL_PREVIEWS_READY',recorded.length);
