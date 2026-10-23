// Non-destructive visual triage of every Daiblos Core model. A moving frame
// is not proof of a correctly assembled character.
// Run in CI shards: node scripts/audit_daiblos_visual_browser.mjs 0 10
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
const catalog=JSON.parse(fs.readFileSync('data/spine-daiblos-core.json','utf8')).characters;
const shard=Number(process.argv[2]??0),shards=Number(process.argv[3]??10);
if(!Number.isInteger(shard)||!Number.isInteger(shards)||shards<1||shard<0||shard>=shards)throw Error('Invalid shard');
const executable=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!executable)throw Error('Chrome/Chromium missing');
const browser=await chromium.launch({headless:true,executablePath:executable,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const folder='/tmp/daiblos-visual-'+shard;
const frameFolder=folder+'/frames';
fs.mkdirSync(frameFolder,{recursive:true});
function inspect(buffer){
 const im=PNG.sync.read(buffer),{width:w,height:h,data}=im;
 const corners=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]].map(([x,y])=>{const i=(y*w+x)*4;return [data[i],data[i+1],data[i+2]]});
 const bg=[0,1,2].map(k=>corners.map(c=>c[k]).sort((a,b)=>a-b)[2]);
 const mask=new Uint8Array(w*h);let total=0;
 for(let p=0;p<w*h;p++){const i=p*4;if(data[i+3]<32)continue;
  if(Math.max(Math.abs(data[i]-bg[0]),Math.abs(data[i+1]-bg[1]),Math.abs(data[i+2]-bg[2]))>35){mask[p]=1;total++;}
 }
 const sizes=[];const queue=new Int32Array(w*h);
 for(let seed=0;seed<mask.length;seed++){if(!mask[seed])continue;mask[seed]=0;let head=0,tail=1,count=0;queue[0]=seed;
  while(head<tail){const p=queue[head++];count++;const x=p%w,y=(p-x)/w;
   for(const n of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(n>=0&&mask[n]){mask[n]=0;queue[tail++]=n;}
  }sizes.push(count);
 }
 sizes.sort((a,b)=>b-a);
 const largestShare=total?sizes[0]/total:0;
 const majorComponents=sizes.filter(v=>v>=Math.max(40,total*.055)).length;
 return {width:w,height:h,foregroundFraction:+(total/(w*h)).toFixed(4),largestShare:+largestShare.toFixed(4),majorComponents,
  suspicious:largestShare<.55&&majorComponents>=3&&total/(w*h)>=.025};
}
// Asset-level measurements explain why a rendered character may be fragmented.
// These readings do NOT mark an image as visually correct.
async function inspectRuntime(page){
 return page.evaluate(()=>{
  const p=eval('player');
  if(!p?.skeleton)return {error:'No active Spine skeleton'};
  const atlas=p.assetManager?.get(p.config?.atlasUrl);
  const regions=atlas?.regions||[];
  const rotations={};
  let invalidRegions=0;
  for(const r of regions){
   const deg=String(((Number(r.degrees)||0)%360+360)%360);
   rotations[deg]=(rotations[deg]||0)+1;
   const values=[r.u,r.v,r.u2,r.v2];
   if(values.some(v=>!Number.isFinite(v)||v<-.001||v>1.001))invalidRegions++;
  }
  const slots=p.skeleton.slots||[];
  let mesh=0,region=0,invalidUVAttachments=0;
  const invalidUVNames=[];
  for(const slot of slots){
   const attachment=slot.attachment;
   if(!attachment)continue;
   const isMesh=attachment instanceof window.spine.MeshAttachment;
   const isRegion=attachment instanceof window.spine.RegionAttachment;
   if(isMesh)mesh++;
   if(isRegion)region++;
   if(!isMesh&&!isRegion)continue;
   const uvs=attachment.uvs||[];
   if(uvs.some(v=>!Number.isFinite(v)||v<-.001||v>1.001)){
    invalidUVAttachments++;
    if(invalidUVNames.length<12)invalidUVNames.push(attachment.name);
   }
  }
  const pageDimensions=(atlas?.pages||[]).map(x=>{
   const img=x.texture?.getImage?.();
   return {name:x.name,width:x.width,height:x.height,
    imageWidth:img?.naturalWidth||img?.width||null,imageHeight:img?.naturalHeight||img?.height||null,coordinateSize:x._archiveCoordinateSize||null};
  });
  let declaredAtlasSize=null;
  try{
   const uri=p.config?.rawDataURIs?.[p.config.atlasUrl]||'';
   const comma=uri.indexOf(',');
   if(comma>=0){
    const raw=decodeURIComponent(uri.slice(comma+1));
    const m=raw.match(/size:\s*(\d+)\s*,\s*(\d+)/);
    if(m)declaredAtlasSize=[Number(m[1]),Number(m[2])];
   }
  }catch(e){}
  return {exportVersion:p.skeleton?.data?.version||null,
   skin:p.skeleton?.skin?.name||null,rotationCounts:rotations,
   atlasRegions:regions.length,invalidRegions,meshAttachments:mesh,
   regionAttachments:region,invalidUVAttachments,invalidUVNames,
   declaredAtlasSize,pageDimensions,coordinatePolicy:p._archiveAtlasCoordinateDiagnostics||null};
 });
}
const results=[];try{
 for(let i=shard;i<catalog.length;i+=shards){
  const c=catalog[i],page=await browser.newPage({viewport:{width:1366,height:850}});
  let result={id:c.id,skinCode:c.skinCode,source:c.skeletonUrl,state:'timeout'};
  try{
   await page.goto('http://127.0.0.1:8765/spine.html?id='+encodeURIComponent(c.id),{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(()=>/正在播放：|加载失败|下载失败|播放器初始化失败|播放失败/.test(document.querySelector('#status')?.textContent||''),null,{timeout:95000});
   const status=await page.locator('#status').innerText();result.status=status.slice(0,350);
   if(!status.startsWith('正在播放：')){result.state='playback-error';continue;}
   await page.waitForTimeout(1000);
   const canvas=page.locator('#player canvas').first();
   const png=await canvas.screenshot({timeout:15000});
   const metric=inspect(png);Object.assign(result,metric);
   result.runtime=await inspectRuntime(page).catch(e=>({error:String(e)}));
   // Always retain the corresponding frame, including heuristic false negatives.
   const frameName=c.id.replace(/[^a-z0-9_-]/gi,'_')+'.png';
   fs.writeFileSync(frameFolder+'/'+frameName,png);
   result.frame='frames/'+frameName;
   result.state=metric.suspicious?'visual-suspect':'rendered-unverified';
  }catch(error){result.state='error';result.error=String(error).slice(0,400)}
  finally{results.push(result);console.log('DAIBLOS_VISUAL',JSON.stringify(result));await page.close();}
 }
}finally{await browser.close();fs.writeFileSync(folder+'/results.json',JSON.stringify({shard,shards,checked:results.length,visualSuspects:results.filter(x=>x.state==='visual-suspect').length,
 errors:results.filter(x=>x.state==='error'||x.state==='playback-error').length,results,
 note:'Automated connectivity triage: rendered-unverified is NOT a verified coherent character. All rendered frames are retained for visual review. No automatic exclusions.'},null,2));}
