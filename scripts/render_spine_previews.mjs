// Render each indexed Spine animation itself and save its actual first-frame preview.
// This avoids using a base costume, unrelated character portraits, or guessed names.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {chromium} from 'playwright-core';

const root=new URL('../',import.meta.url);
const catalog=JSON.parse(fs.readFileSync(new URL('data/spine-characters.json',root),'utf8')).characters;
const shard=Number(process.argv[2]??0);
const count=Number(process.argv[3]??10);
if(!Number.isInteger(shard)||!Number.isInteger(count)||shard<0||count<1||shard>=count)throw Error('Invalid shard/count');
const list=catalog.filter((_,idx)=>idx%count===shard);
const out=process.env.SPINE_PREVIEW_OUT||'/tmp/spine-previews';
const dest=path.join(out,'assets','animation-previews');
fs.mkdirSync(dest,{recursive:true});
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!chrome)throw Error('Chrome not installed');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1366,height:900},deviceScaleFactor:1});
const page=await context.newPage();
const output=[];
let failures=0;

async function frameToPreview(png){
 const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,channels=info.channels;
 const bg=[data[0],data[1],data[2]];
 let x0=w,y0=h,x1=-1,y1=-1,visible=0;
 for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){
  const i=(y*w+x)*channels;
  const diff=Math.abs(data[i]-bg[0])+Math.abs(data[i+1]-bg[1])+Math.abs(data[i+2]-bg[2]);
  if(diff>76){visible++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
 }
 if(visible<150||x1<=x0||y1<=y0)throw Error('Screenshot is blank or lacks rendered character');
 const pad=Math.round(Math.max(x1-x0,y1-y0)*.06);
 const left=Math.max(0,x0-pad),top=Math.max(0,y0-pad);
 const right=Math.min(w,x1+pad),bottom=Math.min(h,y1+pad);
 if(right-left<20||bottom-top<20)throw Error('Character bounding box too small');
 const transformed=await sharp(png).extract({left,top,width:right-left,height:bottom-top})
  .resize({width:480,height:360,fit:'contain',background:'#142238'})
  .webp({quality:83,effort:4}).toBuffer();
 return {bytes:transformed,width:480,height:360,visible,bounds:{left,top,right,bottom}};
}

try{
 for(const c of list){
  const id=c.id;
  const entry={id,name:c.name,gameId:c.gameId};
  const started=Date.now();
  try{
   if(!/^[a-zA-Z0-9_-]+$/.test(id)||!['nikke','bluearchive'].includes(c.gameId))throw Error('Invalid catalog ID or game');
   await page.goto('http://127.0.0.1:8765/spine.html?id='+encodeURIComponent(id),{waitUntil:'domcontentloaded',timeout:30000});
   const deadline=Date.now()+80000;
   let status='';
   while(Date.now()<deadline){
    status=await page.locator('#status').innerText().catch(()=>'(navigation)');
    if(status.includes('正在播放：'))break;
    if(/加载失败|资源下载失败|播放失败|加载超时|不支持|无法解析|初始化失败|自动播放动作失败|没有找到可播放的动作/.test(status))throw Error(status.slice(0,260));
    await page.waitForTimeout(350);
   }
   if(!status.includes('正在播放：'))throw Error('Timed out waiting for actual Spine animation: '+status.slice(0,120));
   await page.waitForTimeout(950);
   const canvas=page.locator('#player canvas');
   if(await canvas.count()!==1)throw Error('Missing animation canvas');
   const png=await canvas.screenshot({timeout:15000});
   const rendered=await frameToPreview(png);
   const name=c.gameId+'-'+id+'.webp', file=path.join(dest,name);
   fs.writeFileSync(file,rendered.bytes);
   Object.assign(entry,{status:'ok',preview:'./assets/animation-previews/'+name,
     sha256:createHash('sha256').update(rendered.bytes).digest('hex'),
     size:rendered.bytes.length,animation:status.match(/ · ([^ ·（]+)（共/)?.[1]||'',visible:rendered.visible});
   console.log('SPINE_PREVIEW_OK '+JSON.stringify({id,game:c.gameId,name,bytes:entry.size,visible:entry.visible,ms:Date.now()-started}));
  }catch(e){
   failures++;
   Object.assign(entry,{status:'failed',error:String(e),ms:Date.now()-started});
   console.error('SPINE_PREVIEW_FAILED '+JSON.stringify(entry));
  }
  output.push(entry);
 }
}finally{
 fs.writeFileSync(path.join(out,'preview-mapping-'+shard+'.json'),JSON.stringify({shard,count,total:output.length,success:output.filter(x=>x.status==='ok').length,failed:failures,entries:output},null,2));
 await browser.close();
}
console.log('SPINE_PREVIEW_SHARD '+JSON.stringify({shard,total:list.length,failed:failures}));
if(failures)process.exitCode=1;
