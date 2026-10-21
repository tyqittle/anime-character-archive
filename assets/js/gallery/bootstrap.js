'use strict';
var searchDelay=null;
['query','rarityFilter','kindFilter','sort'].forEach(function(id){$(id).addEventListener(id==='query'?'input':'change',function(){page=1;if(id==='query'){clearTimeout(searchDelay);searchDelay=setTimeout(function(){render()},140)}else{clearTimeout(searchDelay);render()}})});
$('gameFilter').addEventListener('change',function(){selectedGroup=this.value==='all'?'all':'game:'+this.value;page=1;render();updateGroupNav()});
fetch('./data/characters.json?v=zzz-reverse1999-ready-20261021',{cache:'default'}).then(function(r){if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(function(db){
 if(!Array.isArray(db.characters))throw Error('索引数据格式错误');
 items=db.characters.filter(function(c){return c&&c.id&&c.gameId&&c.characterKey&&c.kind==='full'&&/^\.\/assets\/portraits\/[a-zA-Z0-9_-]+\.(?:png|webp)$/.test(c.image)});
 $('totalStat').textContent=items.length;
 var requestedGame=new URLSearchParams(location.search).get('game');
 if(requestedGame&&items.some(function(c){return c.gameId===requestedGame}))selectedGroup='game:'+requestedGame;
 render();
 var heroBuckets={};
 items.forEach(function(c){if(!c.image||c.kind!=='full')return;var bucket=heroBuckets[c.gameId]||(heroBuckets[c.gameId]=[]);if(bucket.length<3)bucket.push(c)});
 var heroPool=[];
 for(var round=0;round<3;round++)Object.keys(heroBuckets).forEach(function(game){if(heroBuckets[game][round])heroPool.push(heroBuckets[game][round])});
 var heroNode=$('heroArt'),heroOffset=0,heroVisible=true;
 if(heroNode&&'IntersectionObserver' in window){
  new IntersectionObserver(function(entries){heroVisible=entries[0].isIntersecting},{rootMargin:'40px'}).observe(heroNode);
 }
 function paintHero(){
  if(!heroNode||!heroPool.length)return;
  var picked=[];
  for(var i=0;i<Math.min(3,heroPool.length);i++)picked.push(heroPool[(heroOffset+i)%heroPool.length]);
  heroOffset=(heroOffset+3)%heroPool.length;
  var next=document.createElement('div');next.className='hero-slide';
  picked.forEach(function(c,i){
   var img=document.createElement('img');
   img.src=previewFor(c);img.alt='';img.loading='eager';img.decoding='async';
   img.style.setProperty('--i',i);next.appendChild(img);
  });
  heroNode.appendChild(next);
  requestAnimationFrame(function(){next.classList.add('visible')});
  Array.from(heroNode.children).forEach(function(old){if(old!==next){old.classList.remove('visible');setTimeout(function(){old.remove()},1100)}});
 }
 // The optional feature banner is collapsed; never load its images until opened.
 var extras=document.querySelector('.archive-extras');
 if(extras){
  if(extras.open)paintHero();
  extras.addEventListener('toggle',function(){if(extras.open)paintHero()});
 }else paintHero();
 var reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 var saveData=!!(navigator.connection&&navigator.connection.saveData);
 if(!reduceMotion&&!saveData){
  setInterval(function(){if(!document.hidden&&heroVisible)paintHero()},18000);
 }
 var hash=decodeURIComponent(location.hash.slice(1));
 if(hash&&items.some(function(x){return x.id===hash}))showOne(hash);
}).catch(function(e){$('resultInfo').textContent='角色索引加载失败：'+e.message;$('gallery').innerHTML='<div class="blank">图片索引加载失败。请从正式部署的网址访问，并检查 data/characters.json 是否存在。<p>'+safe(e.message)+'</p></div>'});
