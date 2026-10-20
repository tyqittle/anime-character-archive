// Diagnostic snapshots of a problematic Blue Archive lobby for renderer evaluation.
// Generates originals, multiple playback variants and bone/skin metadata.
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const path='/tmp/ba-debug';
fs.mkdirSync(path,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1320,height:850}});
const report={};
try{
 await page.goto('http://127.0.0.1:8765/spine.html?id=ba-ch0145_home',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#status')?.innerText?.includes('正在播放：'),null,{timeout:90000});
 await page.waitForTimeout(700);
 await page.locator('#player canvas').screenshot({path:path+'/01-current.png'});
 const data=await page.evaluate(()=>{
  const p=eval('player');const sk=p.skeleton;
  const a=p.assetManager.get(p.config.atlasUrl);
  const skins=sk.data.skins.map(x=>({name:x.name,attachments:Object.values(x.attachments||{}).length}));
  return {skin:sk.skin?.name,skins,configKeys:Object.keys(p.config),config:{animation:p.config.animation,skin:p.config.skin,premultipliedAlpha:p.config.premultipliedAlpha,alpha:p.config.alpha,viewport:p.config.viewport,animationData:sk.data.animations.map(x=>x.name)},attached:sk.slots.filter(x=>x.attachment).length,slotCount:sk.slots.length,atlasRegions:a.regions.length};
 });
 report.info=data;
 const skins=data.skins.map(x=>x.name);
 const variants=[
  {label:'02-alpha-false-idle',alpha:false,animation:'Idle_01'},
  {label:'03-alpha-true-devidle',alpha:true,animation:'Dev_Idle_01'},
  {label:'04-alpha-false-devidle',alpha:false,animation:'Dev_Idle_01'},
  {label:'05-alpha-true-startidle',alpha:true,animation:'Start_Idle_01'},
  {label:'06-alpha-false-startidle',alpha:false,animation:'Start_Idle_01'},
  {label:'07-alpha-true-devstart',alpha:true,animation:'Dev_Start_Idle_01'},
  {label:'08-alpha-true-dummy',alpha:true,animation:'Dummy'}
 ];
 for(const v of variants){
  const status=await page.evaluate((v)=>{
   try{
    const old=window.__baDebugPlayer||eval('player');
    const next={...old.config,premultipliedAlpha:v.alpha,
      animation:v.animation,success:undefined,error:undefined,skin:old.skeleton.skin?.name};
    old.pause();
    document.getElementById('player').replaceChildren();
    window.__baDebugPlayer=new spine.SpinePlayer('player',next);
    return {ok:true,skin:next.skin,alpha:next.premultipliedAlpha,animation:v.animation};
   }catch(e){return {ok:false,error:String(e)}}
  },v);
  report[v.label]=status;
  if(status.ok){
   await page.waitForTimeout(2000);
   try{await page.locator('#player canvas').screenshot({path:path+'/'+v.label+'.png'})}catch(e){report[v.label].screenshotError=String(e)}
  }
 }
 for(const file of ['CH0145_home.png','CH0145_home2.png']){
  const url='https://raw.githubusercontent.com/kiraio-moe/Schale-Archive/main/Spine_Lobbies/Spr/CH0145_home/'+file;
  try{const res=await fetch(url);if(!res.ok)throw Error('HTTP '+res.status);fs.writeFileSync(path+'/'+file,Buffer.from(await res.arrayBuffer()));report[file]='ok'}catch(e){report[file]=String(e)}
 }
}finally{
 fs.writeFileSync(path+'/report.json',JSON.stringify(report,null,2));
 console.log('BA_RENDER_DIAGNOSIS '+JSON.stringify(report).slice(0,5500));
 await browser.close();
}
