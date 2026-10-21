// Browser regression for original-art aspect ratio modal, desktop and mobile.
// Verifies actual image decode and its computed rendered containment in Chromium.
import {chromium} from 'playwright-core';
import fs from 'node:fs';

const browserPath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!browserPath)throw Error('Chromium executable missing');
const browser=await chromium.launch({headless:true,executablePath:browserPath,args:['--no-sandbox']});
const cases=[
 {id:'reverse1999-3072-01',label:'tall reverse1999'},
 {id:'zzz-miyabi',label:'ZZZ portrait'},
 {id:'ak-char_002_amiya-2',label:'Arknights E2 splash'},
 {id:'genshin-10000089',label:'Genshin horizontal splash'},
];
const results=[];
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:8765/characters.html',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.items?.length>=540,{timeout:30000});
  // Static and dynamic pages must use the same compact left navigation.
  // On desktop the gallery scrolls internally; on mobile the document scrolls.
  const shell=await page.evaluate(()=>{
    const box=el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,top:r.top,bottom:r.bottom}};
    const rail=document.querySelector('.archive-sidebar');
    const main=document.querySelector('.archive-gallery-main');
    const gallery=document.querySelector('#gallery');
    const nav=rail?.querySelector('.side-nav');
    const doc=document.documentElement;
    const top=main?.querySelector('.top');
    return {
      navLinks:[...(nav?.querySelectorAll('a')||[])].map(x=>x.textContent.trim()),
      activeNav:nav?.querySelector('[aria-current="page"]')?.textContent.trim(),
      docsHeight:doc.scrollHeight,bodyHeight:document.body.scrollHeight,
      viewportHeight:innerHeight,viewportWidth:innerWidth,
      bodyOverflow:getComputedStyle(document.body).overflowY,
      sidebar:box(rail),main:box(main),gallery:box(gallery),
      galleryOverflow:getComputedStyle(gallery).overflowY,
      galleryScrollHeight:gallery.scrollHeight,galleryClientHeight:gallery.clientHeight,
      modal:!!document.querySelector('#viewer'),featured:!!document.querySelector('#featured')
    };
  });
  if(shell.navLinks.join('|')!=='角色图鉴|动态立绘'||shell.activeNav!=='角色图鉴')
    throw Error('Static gallery navigation differs from Spine player: '+JSON.stringify(shell));
  if(!shell.modal||!shell.featured)throw Error('Gallery modal or featured controls were removed');
  if(viewport.width>850){
    if(shell.docsHeight>shell.viewportHeight+2||shell.bodyHeight>shell.viewportHeight+2)
      throw Error('Static workspace causes full-document scrolling: '+JSON.stringify(shell));
    if(shell.sidebar.bottom>shell.viewportHeight+1||shell.main.bottom>shell.viewportHeight+1)
      throw Error('Static workspace escapes viewport: '+JSON.stringify(shell));
    if(!['auto','scroll'].includes(shell.galleryOverflow)||shell.gallery.height<150)
      throw Error('Static gallery needs an internal full-size scroll surface: '+JSON.stringify(shell));
    const first=await page.locator('#gallery .card').first().evaluate(el=>{
      const card=el.getBoundingClientRect(),image=el.querySelector('.card-img')?.getBoundingClientRect();
      return {cardH:card.height,imageH:image?.height};
    });
    if(first.cardH<160||first.imageH<150)throw Error('Static cards were compressed by viewport layout: '+JSON.stringify(first));
  }else if(shell.main.width<290){
    throw Error('Mobile gallery lost usable width: '+JSON.stringify(shell));
  }

  // Favoriting must retain existing thumbnail elements instead of flashing
  // the whole grid. Exercise the real delegated click path.
  const firstFavId=await page.evaluate(()=>{
    const first=document.querySelector('#gallery .card');
    window.__galleryFirstImage=first.querySelector('.card-img img');
    return first.querySelector('button.fav').dataset.id;
  });
  await page.locator('#gallery .card .fav').first().click();
  const stable=await page.evaluate(id=>{
    const first=document.querySelector('#gallery .card');
    return {
      sameImage:first.querySelector('.card-img img')===window.__galleryFirstImage,
      marked:first.querySelector('button.fav').classList.contains('on'),
      persisted:window.favorites.has(id),
    };
  },firstFavId);
  if(!stable.sameImage||!stable.marked||!stable.persisted)
    throw Error('Favorite click rebuilt gallery thumbnails or failed state update: '+JSON.stringify(stable));
  await page.locator('#gallery .card .fav').first().click();
  console.log('PASSED_GALLERY_FAVORITE_STABILITY',viewport.width,firstFavId);
  for(const tc of cases){
   await page.evaluate(id=>window.showOne(id),tc.id);
   await page.waitForFunction(id=>{
     const img=document.querySelector('#viewImg');
     const pic=document.querySelector('#viewPicture');
     return window.activeId===id&&img.complete&&img.naturalWidth>0&&!pic.classList.contains('is-loading');
   },tc.id,{timeout:30000});
   const data=await page.evaluate(()=>{
     const dlg=document.querySelector('#viewer'),body=dlg.querySelector('.view-body'),
     pic=dlg.querySelector('#viewPicture'),img=dlg.querySelector('#viewImg'),
     metadata=dlg.querySelector('.view-meta');
     const rect=x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,right:r.right,bottom:r.bottom,left:r.left}};
     const im=rect(img),p=rect(pic),d=rect(dlg),b=rect(body),m=rect(metadata);
     const style=getComputedStyle(img);
     const availableWidth=im.width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
     const availableHeight=im.height-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
     const scale=Math.min(availableWidth/img.naturalWidth,availableHeight/img.naturalHeight);
     return {
       id:window.activeId,viewport:{w:innerWidth,h:innerHeight},
       dialog:d,stage:p,body:b,info:m,
       natural:{w:img.naturalWidth,h:img.naturalHeight},
       metadataDims:{w:window.items.find(c=>c.id===window.activeId)?.imageWidth,h:window.items.find(c=>c.id===window.activeId)?.imageHeight},
       rendered:{w:img.naturalWidth*scale,h:img.naturalHeight*scale},
       overflow:{stageW:pic.scrollWidth-pic.clientWidth,stageH:pic.scrollHeight-pic.clientHeight,
         bodyW:body.scrollWidth-body.clientWidth,bodyH:body.scrollHeight-body.clientHeight},
       fit:style.objectFit,position:style.position,loading:pic.classList.contains('is-loading'),
     };
   });
   const assert=(condition,why)=>{if(!condition)throw Error(tc.label+' @'+viewport.width+': '+why+' '+JSON.stringify(data))};
   assert(data.natural.w>0&&data.natural.h>0,'decoded image missing');
   assert(data.metadataDims.w===data.natural.w&&data.metadataDims.h===data.natural.h,'catalog dims wrong');
   assert(data.dialog.left>=-2&&data.dialog.top>=-2&&data.dialog.right<=viewport.width+2&&data.dialog.bottom<=viewport.height+2,'dialog outside viewport');
   assert(data.stage.height>=160&&data.stage.width>=200,'art stage is too small');
   assert(data.fit==='contain'&&data.position==='absolute','image should be absolutely contained');
   assert(data.rendered.w<=data.stage.width+2&&data.rendered.h<=data.stage.height+2,'image content clipped');
   assert(data.overflow.stageH<=2&&data.overflow.bodyH<=2&&data.overflow.stageW<=2&&data.overflow.bodyW<=2,'unwanted dialog artwork scrollbar');
   console.log('PASSED_VIEWER',tc.id,viewport.width+'x'+viewport.height,
     'natural',data.natural.w+'x'+data.natural.h,
     'dialog',Math.round(data.dialog.width)+'x'+Math.round(data.dialog.height),
     'stage',Math.round(data.stage.width)+'x'+Math.round(data.stage.height),
     'rendered',Math.round(data.rendered.w)+'x'+Math.round(data.rendered.h));
   results.push({case:tc.id,viewport,data});
   await page.screenshot({path:'/tmp/gallery-viewer-'+viewport.width+'-'+tc.id+'.png'});
  }
  if(pageErrors.length)throw Error('Browser runtime errors: '+pageErrors.join('\n'));
  await page.close();
 }
 // The vertical sample must produce a narrower dialog than the wide sample.
 for(const width of [1440,390]){
  const tall=results.find(r=>r.viewport.width===width&&r.case==='reverse1999-3072-01').data;
  const wide=results.find(r=>r.viewport.width===width&&r.case==='genshin-10000089').data;
  if(width===1440&&!(tall.dialog.width<wide.dialog.width))
   throw Error('Desktop dialog width is not aspect-ratio adaptive');
 }
 fs.writeFileSync('/tmp/gallery-viewer-results.json',JSON.stringify(results,null,2));
 console.log('PASS: modal adapts to 4 original art ratios at desktop and mobile viewports');
}finally{await browser.close();}
