// Browser validation for five full-character Spine models, not static art.
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';

const entries=JSON.parse(fs.readFileSync('data/spine-bd2-pilot.json','utf8')).characters;
const browserPath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!browserPath)throw Error('Chromium executable missing');
const browser=await chromium.launch({headless:true,executablePath:browserPath,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const results=[];
try{
 for(const character of entries){
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const result={id:character.id,name:character.name,status:'failed',errors:[]};
  results.push(result);
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:8765/spine.html',{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(id=>typeof allCharacters!=='undefined'&&allCharacters.some(c=>c.id===id),character.id,{timeout:20000});
   await page.selectOption('#gameFilter','browndust2');
   await page.selectOption('#characters',character.id);
   await page.click('#nikke');
   await page.waitForFunction(()=>{
    const message=document.querySelector('#status')?.textContent||'';
    return message.startsWith('正在播放：')||/^(?:角色资源下载失败|播放失败|播放器初始化失败|加载失败|加载超时|本地素材播放失败)/.test(message);
   },null,{timeout:120000});
   const status=await page.locator('#status').textContent();
   result.playerStatus=status;
   if(!status.startsWith('正在播放：'))throw Error(status);
   const canvas=page.locator('#player canvas').first();
   await canvas.waitFor({timeout:15000});
   const rect=await canvas.evaluate(c=>({width:c.width,height:c.height}));
   result.canvas=rect;
   if(!await page.locator('#zoomIn').isEnabled())throw Error('Zoom controls were not enabled after rendering');
   if(!await page.locator('#animationPicker').isEnabled())throw Error('Animation picker is still disabled');
   await page.locator('#zoomIn').click();
   const zoomed=await canvas.evaluate(c=>({transform:c.style.transform,origin:c.style.transformOrigin}));
   if(!zoomed.transform.includes('scale(1.2)'))throw Error('Zoom controls did not transform the actual canvas: '+JSON.stringify(zoomed));
   await page.locator('#resetView').click();
   const reset=await canvas.evaluate(c=>c.style.transform);
   if(!reset.includes('scale(1)'))throw Error('Reset-view button failed: '+reset);
   if(rect.width<200||rect.height<200)throw Error('Canvas is too small: '+JSON.stringify(rect));
   await page.waitForTimeout(500);
   const a=PNG.sync.read(await page.locator('#player').screenshot());
   await page.waitForTimeout(1500);
   const b=PNG.sync.read(await page.locator('#player').screenshot());
   if(a.width!==b.width||a.height!==b.height)throw Error('Canvas size changed during animation');
   let changed=0,sampled=0;
   for(let y=Math.floor(a.height*.12);y<Math.floor(a.height*.8);y+=7){
    for(let x=25;x<a.width-25;x+=7){
     const p=(y*a.width+x)*4;
     const d=Math.abs(a.data[p]-b.data[p])+Math.abs(a.data[p+1]-b.data[p+1])+Math.abs(a.data[p+2]-b.data[p+2]);
     sampled++;
     if(d>18)changed++;
    }
   }
   result.movingPixelSamples=changed;result.pixelSamples=sampled;
   await page.screenshot({path:'/tmp/bd2-'+character.id+'.png',fullPage:true});
   if(changed<8)throw Error('No meaningful character motion detected over 1.5 seconds');
   if(pageErrors.length)throw Error('Page errors: '+pageErrors.join('; '));
   result.status='rendered-and-moving';
   console.log('PASS',character.id,'changed samples',changed,'/',sampled);
  }catch(e){
   result.errors.push(e.message||String(e));
   console.error('FAIL',character.id,result.errors.join('; '));
   await page.screenshot({path:'/tmp/bd2-'+character.id+'-failed.png',fullPage:true}).catch(()=>{});
  }finally{await page.close()}
 }
}finally{
 await browser.close();
 fs.writeFileSync('/tmp/bd2-spine-browser-results.json',JSON.stringify(results,null,2));
}
if(results.some(x=>x.status!=='rendered-and-moving'))process.exitCode=1;
