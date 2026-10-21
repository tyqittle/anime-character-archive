'use strict';
// Hover intent can warm the browser cache just before a deliberate full-art
// click, without downloading hundreds of high-resolution portraits at startup.
var hoverWarmTimer=0, hoverWarmImages=new Map();
var canWarmOriginal=!((navigator.connection&&
  (navigator.connection.saveData||/^(slow-2g|2g)$/.test(navigator.connection.effectiveType||''))));
function warmOriginal(id){
 if(!canWarmOriginal||document.hidden)return;
 var c=items.find(function(x){return x.id===id});
 if(!c||hoverWarmImages.has(id)||!c.image)return;
 var image=new Image();
 image.decoding='async';
 if('fetchPriority' in image)image.fetchPriority='low';
 image.src=c.image;
 hoverWarmImages.set(id,image);
 if(hoverWarmImages.size>2)hoverWarmImages.delete(hoverWarmImages.keys().next().value);
}
$('gallery').addEventListener('pointerover',function(e){
 if(e.pointerType!=='mouse'||!canWarmOriginal)return;
 var target=e.target.closest('button.card-img');
 if(!target||target.contains(e.relatedTarget))return;
 clearTimeout(hoverWarmTimer);
 var id=target.dataset.id;
 hoverWarmTimer=setTimeout(function(){warmOriginal(id)},230);
});
$('gallery').addEventListener('pointerout',function(e){
 var target=e.target.closest('button.card-img');
 if(target&&!target.contains(e.relatedTarget))clearTimeout(hoverWarmTimer);
});
document.addEventListener('click',function(e){
 var target=e.target.closest('[data-action]');if(!target)return;
 var action=target.dataset.action,id=target.dataset.id,value=target.dataset.value;
 if(action==='group')startGroup(value);
 else if(action==='reset'){$('query').value='';$('rarityFilter').value='all';$('kindFilter').value='all';selectedGroup='all';mode='all';onlyFav=false;page=1;render();updateGroupNav();focusArchiveResults()}
 else if(action==='mode'){mode=value;$('kindFilter').value='all';page=1;render()}
 else if(action==='favorites'){onlyFav=!onlyFav;page=1;render()}
 else if(action==='view')showOne(id);
 else if(action==='close'){viewerLoadToken++;$('viewer').close()}
 else if(action==='fav'){if(favorites.has(id))favorites.delete(id);else favorites.add(id);remember();if(onlyFav)render();else syncFavoriteButtons(id)}
 else if(action==='more'){page++;render(true)}
 else if(action==='step')navigate(Number(target.dataset.step));
 else if(action==='retry-view'&&activeId){viewRetryNonce=Date.now();showOne(activeId)}
 else if(action==='random'){var pool=filterItems();if(pool.length)showOne(pool[Math.floor(Math.random()*pool.length)].id)}
});
document.addEventListener('error',function(e){
 var img=e.target;if(!(img instanceof HTMLImageElement))return;
 if(img.id==='viewImg'){if(!$('viewPicture').classList.contains('is-loading'))$('viewPicture').classList.add('error');return}
 if(img.closest('.card-img')){img.closest('.card-img').classList.add('error')}
},true);
$('viewer').addEventListener('close',function(){viewerLoadToken++});
window.addEventListener('resize',function(){
 if(!$('viewer').open)return;
 var c=items.find(function(x){return x.id===activeId});
 if(c)sizeViewerFor(c);
});
document.addEventListener('keydown',function(e){if(!$('viewer').open)return;if(e.key==='ArrowLeft')navigate(-1);if(e.key==='ArrowRight')navigate(1)});
// Swipe between original artworks on phones, without hijacking vertical gestures.
var viewTouchStart=null;
$('viewPicture').addEventListener('touchstart',function(e){viewTouchStart=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null},{passive:true});
$('viewPicture').addEventListener('touchend',function(e){if(!viewTouchStart||!$('viewer').open||!e.changedTouches.length)return;var dx=e.changedTouches[0].clientX-viewTouchStart.x,dy=e.changedTouches[0].clientY-viewTouchStart.y;viewTouchStart=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.4)navigate(dx<0?1:-1)},{passive:true});
$('viewPicture').addEventListener('touchcancel',function(){viewTouchStart=null},{passive:true});
