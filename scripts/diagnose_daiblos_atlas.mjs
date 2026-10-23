// A/B the explicit atlas coordinate policy on controls and recovery candidates.
// No catalog entries or source assets are changed by this diagnostic.
import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const executablePath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!executablePath)throw Error('No Chromium browser');
const catalog=JSON.parse(fs.readFileSync('data/spine-daiblos-core.json','utf8'));
const candidates=[{"id":"dbcore-10010_skin_alps04_spine-10010_skin_alps04","gameId":"daibloscore","game":"Daiblos Core","collectionName":"Daiblos Core","engine":"spine","name":"Alps04","characterName":"Alps04","skinCode":"10010_skin_Alps04","resourceStem":"10010_skin_Alps04","spineVersion":"3.8","skeletonFormat":"json","atlasCoordinateSpace":"declared","base":"https://raw.githubusercontent.com/bungaku-moe/DaiblosCoreAssets/3c672a0f11cc70fee35432b1a28522d7d74068c2/spine/10010_skin_alps04_spine/10010_skin_Alps04","skeletonUrl":"https://raw.githubusercontent.com/bungaku-moe/DaiblosCoreAssets/3c672a0f11cc70fee35432b1a28522d7d74068c2/spine/10010_skin_alps04_spine/10010_skin_Alps04.json","atlasUrl":"https://raw.githubusercontent.com/bungaku-moe/DaiblosCoreAssets/3c672a0f11cc70fee35432b1a28522d7d74068c2/spine/10010_skin_alps04_spine/10010_skin_Alps04.atlas","sourceRepo":"bungaku-moe/DaiblosCoreAssets","sourceCommit":"3c672a0f11cc70fee35432b1a28522d7d74068c2","sourcePath":"spine/10010_skin_alps04_spine/10010_skin_Alps04.json","skeletonBytes":2134251,"atlasBytes":27918,"textureBytes":4608027},{"id":"dbcore-70050_skin_hades03_spine-70050_skin_hades03","gameId":"daibloscore","game":"Daiblos Core","collectionName":"Daiblos Core","engine":"spine","name":"Hades03","characterName":"Hades03","skinCode":"70050_skin_Hades03","resourceStem":"70050_skin_Hades03","spineVersion":"3.8","skeletonFormat":"json","atlasCoordinateSpace":"declared","base":"https://raw.githubusercontent.com/bungaku-moe/DaiblosCoreAssets/3c672a0f11cc70fee35432b1a28522d7d74068c2/spine/70050_skin_hades03_spine/70050_skin_Hades03","skeletonUrl":"https://raw.githubusercontent.com/bungaku-moe/DaiblosCoreAssets/3c672a0f11cc70fee35432b1a28522d7d74068c2/spine/70050_skin_hades03_spine/70050_skin_Hades03.json","atlasUrl":"https://raw.githubusercontent.com/bungaku-moe/DaiblosCoreAssets/3c672a0f11cc70fee35432b1a28522d7d74068c2/spine/70050_skin_hades03_spine/70050_skin_Hades03.atlas","sourceRepo":"bungaku-moe/DaiblosCoreAssets","sourceCommit":"3c672a0f11cc70fee35432b1a28522d7d74068c2","sourcePath":"spine/70050_skin_hades03_spine/70050_skin_Hades03.json","skeletonBytes":4789027,"atlasBytes":29926,"textureBytes":3172371},{"id":"dbcore-70310_skin_atum03a_spine-70310_skin_atum03a","gameId":"daibloscore","game":"Daiblos Core","collectionName":"Daiblos Core","engine":"spine","name":"Atum03a","characterName":"Atum03a","skinCode":"70310_skin_Atum03a","resourceStem":"70310_skin_Atum03a","spineVersion":"3.8","skeletonFormat":"json","atlasCoordinateSpace":"declared","base":"https://raw.githubusercontent.com/bungaku-moe/DaiblosCoreAssets/3c672a0f11cc70fee35432b1a28522d7d74068c2/spine/70310_skin_atum03a_spine/70310_skin_Atum03a","skeletonUrl":"https://raw.githubusercontent.com/bungaku-moe/DaiblosCoreAssets/3c672a0f11cc70fee35432b1a28522d7d74068c2/spine/70310_skin_atum03a_spine/70310_skin_Atum03a.json","atlasUrl":"https://raw.githubusercontent.com/bungaku-moe/DaiblosCoreAssets/3c672a0f11cc70fee35432b1a28522d7d74068c2/spine/70310_skin_atum03a_spine/70310_skin_Atum03a.atlas","sourceRepo":"bungaku-moe/DaiblosCoreAssets","sourceCommit":"3c672a0f11cc70fee35432b1a28522d7d74068c2","sourcePath":"spine/70310_skin_atum03a_spine/70310_skin_Atum03a.json","skeletonBytes":5393812,"atlasBytes":49848,"textureBytes":10308390}];
const picks=['10010_skin_Alps03','10010_skin_Alps05','30320_skin_Pelorovis03',...candidates.map(c=>c.resourceStem)];
const output='/tmp/daiblos-uv-diagnostic';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 for(const stem of picks){
  const entry=[...catalog.characters,...candidates].find(c=>c.resourceStem===stem);
  if(!entry)throw Error('Missing diagnostic entry: '+stem);
  for(const variant of ['texture','declared']){
   const page=await browser.newPage({viewport:{width:1366,height:850}});
   const result={stem,variant};
   try{
    await page.route('**/data/spine-daiblos-core.json*',async route=>{
     const response=await route.fetch(),data=await response.json();
     const ids=new Set(data.characters.map(c=>c.id));
     data.characters.push(...candidates.filter(c=>!ids.has(c.id)));
     for(const c of data.characters)c.atlasCoordinateSpace=variant;
     await route.fulfill({response,body:JSON.stringify(data)});
    });
    await page.goto('http://127.0.0.1:8765/spine.html?id='+encodeURIComponent(entry.id),{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.startsWith('正在播放：')||document.querySelector('#status')?.classList.contains('error'),null,{timeout:95000});
    const status=await page.locator('#status').innerText();
    if(!status.startsWith('正在播放：'))throw Error(status);
    await page.waitForTimeout(1000);
    const canvas=page.locator('#player canvas').first();
    const filename=path.join(output,stem+'-'+variant+'.png');
    await canvas.screenshot({path:filename,timeout:12000});
    result.measurement=await page.evaluate(()=>{
     const p=eval('player'),atlas=p.assetManager.get(p.config.atlasUrl);
     return {policy:p._archiveAtlasCoordinateDiagnostics||null,
      invalidRegions:atlas.regions.filter(r=>[r.u,r.v,r.u2,r.v2].some(v=>!Number.isFinite(v)||v<-.001||v>1.001)).length,
      invalidMeshes:p.skeleton.slots.filter(s=>s.attachment?.uvs?.some(v=>!Number.isFinite(v)||v<-.001||v>1.001)).length};
    });
    if(variant==='declared'&&(result.measurement.invalidRegions||result.measurement.invalidMeshes))throw Error('UVs remain outside atlas');
    if(stem!=='10010_skin_Alps03'&&(variant==='declared'||stem==='10010_skin_Alps05')){
     const evidence=await canvas.screenshot({type:'jpeg',quality:45,timeout:12000});
     const encoded=evidence.toString('base64');
     console.log('UV_IMAGE_START '+JSON.stringify({stem,variant,bytes:evidence.length}));
     for(let i=0;i<encoded.length;i+=12000)console.log('UV_IMAGE_CHUNK '+encoded.slice(i,i+12000));
     console.log('UV_IMAGE_END');
    }
    result.state='captured-unverified';result.filename=filename;
   }catch(error){result.state='error';result.error=String(error);}
   finally{results.push(result);console.log('UV_DIAGNOSTIC_RESULT',JSON.stringify(result));await page.close();}
  }
 }
}finally{await browser.close();fs.writeFileSync(output+'/results.json',JSON.stringify({results},null,2));}
if(results.filter(r=>r.variant==='declared').some(r=>r.state==='error'))process.exitCode=1;
