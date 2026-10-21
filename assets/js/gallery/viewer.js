'use strict';
var viewerLoadToken=0,viewRetryNonce=0;
function sizeViewerFor(c){
 // Original dimensions are saved in the catalog during thumbnail generation;
 // this lets us size the dialog before the full-resolution image downloads.
 var w=Number(c.imageWidth),h=Number(c.imageHeight);
 var ratio=w>0&&h>0?w/h:0.68;
 ratio=Math.max(0.24,Math.min(3.5,ratio));
 var vw=Math.max(320,window.innerWidth||document.documentElement.clientWidth);
 var vh=Math.max(360,window.innerHeight||document.documentElement.clientHeight);
 var metaW=Math.min(350,Math.max(274,Math.round(vw*0.255)));
 var availableH=Math.min(820,Math.max(240,vh-116));
 var availableW=Math.max(270,Math.min(1050,vw-metaW-42));
 var photoW=Math.min(availableW,Math.max(300,Math.round(availableH*ratio)));
 var photoH=Math.min(availableH,Math.max(240,Math.round(photoW/ratio)));
 var dialogW=Math.min(vw-24,Math.round(photoW+metaW+2));
 var mobilePhotoH=Math.round(Math.min(vh*0.60,
   Math.max(215,Math.min(vw-24,720)/ratio),vh-230));
 var view=$('viewer');
 view.style.setProperty('--viewer-dialog-width',dialogW+'px');
 view.style.setProperty('--viewer-art-height',Math.round(photoH)+'px');
 view.style.setProperty('--viewer-info-width',metaW+'px');
 view.style.setProperty('--viewer-mobile-art-height',Math.max(170,mobilePhotoH)+'px');
}
function showOne(id){
 var c=items.find(function(x){return x.id===id});if(!c)return;
 var view=$('viewer'),pic=$('viewPicture'),img=$('viewImg');
 var sameImage=activeId===id&&img.getAttribute('src')===c.image&&img.complete&&img.naturalWidth>0&&!pic.classList.contains('is-loading');
 activeId=id;$('viewTitle').textContent=(c.zh?c.zh+' · ':'')+c.name;
 img.dataset.fallback='';img.dataset.avatar=c.avatar;img.alt=c.name+' '+(c.kind==='full'?'全身立绘':'头像');
 var tags=[c.kind==='full'?'全身立绘':'头像 / 造型资料',c.rarity,c.manufacturer,c.class,c.squad,c.id,gameNames[c.gameId]||c.game||''];
 sizeViewerFor(c);
 $('viewMeta').innerHTML='<div class="over">'+safe(gameNames[c.gameId]||c.game||'游戏角色')+'</div><h3>'+safe(c.zh||c.name)+'</h3><p>'+safe(c.name)+'</p><div class="taglist">'+tags.filter(Boolean).map(function(t){return '<span>'+safe(t)+'</span>'}).join('')+'</div><p>'+(c.kind==='full'?'此条目有来源档案中的独立全身角色图片。':'此条目仅有角色头像/造型缩略图，不应视为已收录高清全身立绘。')+'</p><p style="font-size:12px">游戏美术版权归原权利人，使用前请核实授权及来源。</p><div class="view-controls"><a class="btn btn-primary" target="_blank" rel="noopener noreferrer" href="'+safe(c.source)+'">↗ 来源文件</a><a class="btn" target="_blank" rel="noopener noreferrer" href="'+safe(c.image)+'">查看原图</a><button class="btn" data-action="fav" data-id="'+safe(c.id)+'">'+(favorites.has(c.id)?'★ 已收藏':'☆ 收藏')+'</button></div><div class="view-controls"><button class="btn" data-action="step" data-step="-1">← 上一张</button><button class="btn" data-action="step" data-step="1">下一张 →</button></div>';
 if(!view.open)view.showModal();
 if(sameImage)return;
 // Catalog previews are deliberately cropped for cards. Never display
 // them in the full-art viewer: they caused the small-then-big image jump.
 var token=++viewerLoadToken;
 pic.classList.remove('error');
 pic.classList.add('is-loading');
 img.onload=null;img.onerror=null;
 img.removeAttribute('src');
 var valid=function(){return token===viewerLoadToken&&activeId===id&&view.open};
 var finish=function(ok){
  if(!valid())return;
  pic.classList.remove('is-loading');
  pic.classList.toggle('error',!ok);
 };
 // The viewport stays the same size while the ORIGINAL file downloads.
 // Keep it hidden until the full-resolution bitmap has actually decoded.
 img.src=c.image+(viewRetryNonce?(c.image.includes('?')?'&':'?')+'retry='+viewRetryNonce:'');
 viewRetryNonce=0;
 if(typeof img.decode==='function'){
  img.decode().then(function(){finish(img.naturalWidth>0)},function(){finish(false)});
 }else{
  img.onload=function(){finish(true)};
  img.onerror=function(){finish(false)};
  if(img.complete&&img.naturalWidth>0)finish(true);
 }
}
function navigate(step){var i=active.findIndex(function(x){return x.id===activeId});if(i>=0&&active.length)showOne(active[(i+step+active.length)%active.length].id)}
function remember(){try{localStorage.setItem(FAVORITES_STORAGE_KEY,JSON.stringify(Array.from(favorites)))}catch(e){}}
// Update only the affected favorite controls: recreating the gallery makes
// decoded thumbnails flash and forces unnecessary image/layout work.
function syncFavoriteButtons(id){
 var selected=favorites.has(id);
 $('favCount').textContent='☆ 已收藏 '+favorites.size+' 项';
 $('gallery').querySelectorAll('button.fav').forEach(function(button){
  if(button.dataset.id!==id)return;
  button.classList.toggle('on',selected);
  button.textContent=selected?'★':'☆';
  button.title=selected?'取消收藏':'收藏角色';
  button.setAttribute('aria-label',selected?'取消收藏':'收藏');
 });
 var detail=$('viewMeta').querySelector('button[data-action="fav"]');
 if(detail&&detail.dataset.id===id)detail.textContent=selected?'★ 已收藏':'☆ 收藏';
}
