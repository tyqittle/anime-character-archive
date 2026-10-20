// Automated real-browser playback across the ENTIRE catalog in parallel CI shards.
// Does not claim the catalog works based on 1-2 representative examples.
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';

const root=new URL('../',import.meta.url);
const catalog=JSON.parse(fs.readFileSync(new URL('data/spine-characters.json',root),'utf8')).characters;
const shard=Number(process.argv[2]??0),count=Number(process.argv[3]??10);
if(!Number.isInteger(shard)||!Number.isInteger(count)||count<1||shard<0||shard>=count)throw Error('Invalid shard arguments');
const todo=catalog.filter((_,i)=>i%count===shard);
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!chrome)throw Error('No browser installed');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1366,height:900}});
const page=await context.newPage(),results=[];
const pageErrors=[];
page.on('pageerror',err=>pageErrors.push(String(err)));
const FAIL=/加载失败|资源下载失败|播放失败|加载超时|版本.*不支持|无法解析|初始化失败|自动播放动作失败|没有找到可播放的动作|下载失败|加载超时/;
function compare(a,b){
 const first=PNG.sync.read(a),second=PNG.sync.read(b);
 if(first.width!==second.width||first.height!==second.height)return {visible:0,moving:0};
 const bg=[first.data[0],first.data[1],first.data[2]];
 let visible=0,moving=0;
 for(let i=0;i<first.data.length;i+=4){
  const dist=Math.abs(first.data[i]-bg[0])+Math.abs(first.data[i+1]-bg[1])+Math.abs(first.data[i+2]-bg[2]);
  const change=Math.abs(first.data[i]-second.data[i])+Math.abs(first.data[i+1]-second.data[i+1])+Math.abs(first.data[i+2]-second.data[i+2]);
  if(dist>100)visible++;
  if(change>45)moving++;
 }
 return {visible,moving};
}
try {
 for(const c of todo){
  let state='timeout',message='',visible=null,moving=null,canvas=false;
  const started=Date.now();
  try {
   await page.goto('http://127.0.0.1:8765/spine.html?id='+encodeURIComponent(c.id),
     {waitUntil:'domcontentloaded',timeout:30000});
   const deadline=Date.now()+60000;
   while(Date.now()<deadline){
    message=await page.locator('#status').innerText().catch(()=>'(page navigation)');
    if(message.includes('正在播放：')||message.includes('播放成功')){state='reported-playing';break}
    if(FAIL.test(message)){state='reported-failure';break}
    await page.waitForTimeout(500);
   }
   canvas=(await page.locator('#player canvas').count())>0;
   if(state==='reported-playing'&&canvas){
    const first=await page.locator('#player canvas').screenshot({timeout:15000});
    await page.waitForTimeout(1700);
    const second=await page.locator('#player canvas').screenshot({timeout:15000});
    const pixels=compare(first,second);visible=pixels.visible;moving=pixels.moving;
    if(visible<300)state='blank';
    else if(moving<60)state='static';
    else state='animated';
   }else if(state==='reported-playing'){
    state='no-canvas';
   }
  }catch(e){state='test-error';message=(message+'\n'+String(e)).slice(0,500)}
  const result={id:c.id,name:c.name,gameId:c.gameId,state,visible,moving,canvas,
    elapsedMs:Date.now()-started,message:message.slice(0,400)};
  results.push(result);console.log('FULL_SPINE_RESULT '+JSON.stringify(result));
 }
}finally{
 await browser.close();
 const summary={shard,count,checked:results.length,animated:results.filter(x=>x.state==='animated').length,
   failed:results.filter(x=>x.state!=='animated').length,results,pageErrors:pageErrors.slice(0,20)};
 fs.writeFileSync('/tmp/spine-full-'+shard+'.json',JSON.stringify(summary,null,2));
 console.log('FULL_SPINE_SUMMARY '+JSON.stringify({shard,count,checked:summary.checked,animated:summary.animated,failed:summary.failed}));
}
if(results.some(x=>x.state!=='animated'))process.exitCode=1;
