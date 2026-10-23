// Compare the patched Spine 3.8 atlas handling against the original vendor runtime.\n// Keep included Daiblos rigs only; excluded Alps04 and Hades03 cannot load from the current catalog.
// Diagnostic only: no application monkeypatch is committed or enabled for users.
import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const browserPath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!browserPath)throw Error('No Chromium browser');
const all=JSON.parse(fs.readFileSync('data/spine-daiblos-core.json','utf8')).characters;
const picks=['10010_skin_Alps03','10010_skin_Alps05','30320_skin_Pelorovis03'];
const output='/tmp/daiblos-uv-diagnostic';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:browserPath,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const stem of picks){
  const entry=all.find(c=>c.resourceStem===stem);
  if(!entry){console.log('UV_DIAGNOSTIC_MISSING',stem);continue;}
  for(const variant of ['patched','declared']){
   const page=await browser.newPage({viewport:{width:1366,height:850}});
   try{
    if(variant==='native')await page.route('**/assets/js/spine/spine-runtime.js?*',async route=>{
     const response=await route.fetch();
     const body=await response.text();
     const previous='if(legacy){patchSpine38AtlasRotations();patchSpine38HighDPI()}';
     if(!body.includes(previous))throw Error('No runtime atlas patch anchor');
     await route.fulfill({response,body:body.replace(previous,'if(legacy){patchSpine38HighDPI()}')});
    });
    await page.goto('http://127.0.0.1:8765/spine.html?id='+encodeURIComponent(entry.id),{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.startsWith('正在播放：'),null,{timeout:120000});
    await page.waitForTimeout(1200);
   const dimensions=await page.evaluate(apply=>{
    const p=eval('player'),atlas=p.assetManager.get(p.config.atlasUrl);
    const uri=p.config.rawDataURIs[p.config.atlasUrl];
    const text=decodeURIComponent(uri.slice(uri.indexOf(',')+1));
    const m=text.match(/size:\s*(\d+)\s*,\s*(\d+)/);
    if(!m)throw Error('Missing declared page size');
    const width=Number(m[1]),height=Number(m[2]);
    const original=atlas.pages.map(p=>({width:p.width,height:p.height}));
    if(apply){
     for(const r of atlas.regions){
      const rotated=[90,270].includes(((r.degrees%360)+360)%360);
      r.u=r.x/width;r.v=r.y/height;
      r.u2=(r.x+(rotated?r.height:r.width))/width;
      r.v2=(r.y+(rotated?r.width:r.height))/height;
     }
     const attachments=new Set(p.skeleton.slots.map(s=>s.attachment).filter(Boolean));
     for(const skin of p.skeleton.data.skins)for(const item of skin.getAttachments())attachments.add(item.attachment);
     for(const a of attachments){
      const r=a.region;if(!r)continue;
      if(a instanceof window.spine.MeshAttachment){
       a.updateUVs();
       const image=r.texture.getImage();
       for(let i=0;i<a.uvs.length;i+=2){
        a.uvs[i]=r.u+(a.uvs[i]-r.u)*image.width/width;
        a.uvs[i+1]=r.v+(a.uvs[i+1]-r.v)*image.height/height;
       }
      }else if(a instanceof window.spine.RegionAttachment)a.setRegion(r);
     }
    }
    return {declared:[width,height],original};
   },variant==='declared');
   await page.waitForTimeout(350);
   console.log('UV_DIMENSION_DIAGNOSTIC',JSON.stringify({stem,variant,dimensions}));
    const canvas=page.locator('#player canvas').first();
    const filename=path.join(output,stem+'-'+variant+'.png');
    await canvas.screenshot({path:filename,timeout:12000});
    // Small JPEG evidence lets remote reviewers inspect the actual public-source
   // frame when their environment cannot download Actions ZIP artifacts.
   const evidence=await canvas.screenshot({type:'jpeg',quality:45,timeout:12000});
   const encoded=evidence.toString('base64');
   console.log('UV_IMAGE_START '+JSON.stringify({stem,variant,bytes:evidence.length}));
   for(let i=0;i<encoded.length;i+=12000)console.log('UV_IMAGE_CHUNK '+encoded.slice(i,i+12000));
   console.log('UV_IMAGE_END');
   console.log('UV_DIAGNOSTIC_CAPTURE',JSON.stringify({stem,variant,filename,status:await page.locator('#status').innerText()}));
   }catch(error){console.log('UV_DIAGNOSTIC_ERROR',JSON.stringify({stem,variant,error:String(error)}))}
   finally{await page.close()}
  }
 }
}finally{await browser.close()}
