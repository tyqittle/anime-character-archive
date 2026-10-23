// Verify the patched Spine 3.8 player actually interprets the atlas UV mapping
// for all four standard rotations, not merely that pixels change over time.
import {chromium} from 'playwright-core';
import fs from 'node:fs';
import {PNG} from 'pngjs';
const executable=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!executable)throw Error('Chrome/Chromium not installed');
const browser=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1366,height:900}});
const results=[];
try{
 for(const id of ['ba-ch0145_home','ba-ch0058_home','ba-ch0069_home','ba-ch0218_home']){
  await page.goto('http://127.0.0.1:8765/spine.html?id='+id,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>/正在播放：|加载失败|播放器初始化失败|资源下载失败/.test(document.querySelector('#status')?.innerText||''),null,{timeout:90000});
  const inspection=await page.evaluate(()=>{
   const runtime=window.spine;
   const p=eval('player');
   const atlas=p?.assetManager?.get(p.config.atlasUrl);
   const regions=atlas?.regions||[];
   const counts={};
   for(const r of regions){
    const d=((Number(r.degrees)||0)%360+360)%360;
    counts[d]=(counts[d]||0)+1;
   }
   const rotations={};
   for(const degrees of [0,90,180,270]){
    const a=new runtime.RegionAttachment('uv-test');
    // TextureAtlas sets rotate for odd quarter turns; preserve that real contract.
    a.setRegion({u:0.1,v:0.2,u2:0.7,v2:0.8,degrees,rotate:degrees===90||degrees===270});
    rotations[degrees]=Array.from(a.uvs).map(x=>Math.round(x*1000)/1000);
   }
   const fixed=Boolean(runtime.TextureAtlas.prototype.__fixedFullRotations);
   const rotated270=regions.filter(r=>r.degrees===270);
   const uvValid=rotated270.every(r=>r.rotate===true &&
      Math.abs(r.u2-(r.x+r.height)/r.page.width)<1e-6 &&
      Math.abs(r.v2-(r.y+r.width)/r.page.height)<1e-6);
   const bounds={};
   if(p?.skeleton){
    const off=new runtime.Vector2(),size=new runtime.Vector2();
    p.skeleton.getBounds(off,size);
    bounds.x=off.x;bounds.y=off.y;bounds.width=size.x;bounds.height=size.y;
   }
   return {status:document.querySelector('#status')?.innerText,rotations,counts,fixed,uvValid,bounds,regionCount:regions.length,premultipliedAlpha:p.config?.premultipliedAlpha};
  });
  const expected={
   0:[.1,.8,.1,.2,.7,.2,.7,.8],
   90:[.7,.8,.1,.8,.1,.2,.7,.2],
   180:[.7,.2,.7,.8,.1,.8,.1,.2],
   270:[.1,.2,.7,.2,.7,.8,.1,.8]
  };
  if(!inspection.fixed)throw Error('Spine 3.8 rotation patch did not load for '+id);
  if(inspection.premultipliedAlpha!==false)throw Error('Blue Archive should use straight-alpha texture blending: '+id);
  if(!inspection.status?.includes('正在播放：'))throw Error('No animation for '+id+': '+inspection.status);
  if(!inspection.uvValid||(id!=='ba-ch0218_home'&&(!inspection.counts[270]||!inspection.counts[180])))throw Error('Atlas regions still incorrect: '+id+' '+JSON.stringify(inspection));
  for(const degrees of [0,90,180,270]){
   const actual=inspection.rotations[degrees];
   if(actual?.some((x,i)=>Math.abs(x-expected[degrees][i])>.001))throw Error('Incorrect region UV mapping for '+degrees+' on '+id+': '+actual);
  }
  if(!(inspection.bounds.width>100&&inspection.bounds.height>100))throw Error('Character geometry missing: '+id);
  if(id==='ba-ch0145_home'){
   const bytes=await page.locator('#player canvas').screenshot({path:'/tmp/ba-ch0145-after-fix.png'});
   const png=PNG.sync.read(bytes);
   let white=0;
   for(let i=0;i<png.data.length;i+=4){
    if(png.data[i]>238&&png.data[i+1]>238&&png.data[i+2]>215)white++;
   }
   const fraction=white/(png.width*png.height);
   inspection.blowoutFraction=fraction;
   // Previously bad PMA config generated ~18% white pixels on Miyu's scene;
   // correct straight-alpha config brings this below ~2%.
   if(fraction>0.06)throw Error('Blue Archive scene is still visibly blown out: '+fraction);
  }
  results.push({id,...inspection});
  console.log('BA_ATLAS_ROTATION_PASS '+JSON.stringify({id,counts:inspection.counts,regionCount:inspection.regionCount,bounds:inspection.bounds,uvValid:inspection.uvValid}));
 }
}finally{
 fs.writeFileSync('/tmp/ba-rotation-results.json',JSON.stringify(results,null,2));
 await browser.close();
}
