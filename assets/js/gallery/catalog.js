'use strict';
function filterItems(){
 var q=$('query').value.trim().toLocaleLowerCase(),rarity=$('rarityFilter').value,kind=$('kindFilter').value;
 var out=items.filter(function(x){
 if(selectedGroup.startsWith('game:')&&x.gameId!==selectedGroup.slice(5))return false;
 if(selectedGroup.startsWith('char:')&&x.gameId+'|'+x.characterKey!==selectedGroup.slice(5))return false;
 if(onlyFav&&!favorites.has(x.id))return false;
 if(mode!=='all'&&x.kind!==mode)return false;
 if(kind!=='all'&&x.kind!==kind)return false;
 if(rarity!=='all'&&(rarity==='unknown'?Boolean(String(x.rarity||'').trim()):x.rarity!==rarity))return false;
 return !q||[x.name,x.zh,x.id,x.game,x.characterKey,x.squad,x.manufacturer,x.class,x.rarity].join(' ').toLocaleLowerCase().includes(q);
 });
 var sort=$('sort').value;
 out.sort(function(a,b){
 if(sort==='name')return a.name.localeCompare(b.name,'en');
 if(sort==='nameDesc')return b.name.localeCompare(a.name,'en');
 return Number(!!b.groupId)-Number(!!a.groupId)||Number(b.kind==='full')-Number(a.kind==='full')||a.name.localeCompare(b.name,'en');
 });
 return out;
}
function fillGameLinks(section){
 if(!section||section.dataset.loaded)return;
 var gameId=section.dataset.game,game=peopleByGame[gameId];
 if(!game)return;
 var container=section.querySelector('.game-characters');
 var names=Object.keys(game.people).sort(function(a,b){return a.localeCompare(b,'en')});
 container.innerHTML=names.map(function(name){
  var arr=game.people[name],label=arr[0].zh||name,key='char:'+gameId+'|'+name;
  return '<button class="group-nav" data-action="group" data-value="'+safe(key)+'">✧ '+safe(label)+' <small>'+safe(name)+'</small><span class="count">'+arr.length+'</span></button>';
 }).join('');
 section.dataset.loaded='1';
}
function updateGroupNav(){
 var nav=$('sideGroups');
 var game=selectedGroup.startsWith('game:')?selectedGroup.slice(5):selectedGroup.startsWith('char:')?selectedGroup.slice(5).split('|')[0]:'';
 if(game){
  Array.from(nav.querySelectorAll('details.game-section')).forEach(function(section){
   if(section.dataset.game===game){section.open=true;fillGameLinks(section)}
  });
 }
 nav.querySelectorAll('[data-action="group"]').forEach(function(b){b.classList.toggle('active',b.dataset.value===selectedGroup)});
 $('gameFilter').value=game||'all';
}
function drawGroups(){
 var byGame={};
 items.forEach(function(c){
  var g=c.gameId||'nikke',key=c.characterKey||c.name||c.id;
  if(!byGame[g])byGame[g]={count:0,people:{}};
  byGame[g].count++;
  if(!byGame[g].people[key])byGame[g].people[key]=[];
  byGame[g].people[key].push(c);
 });
 peopleByGame=byGame;
 var gameIds=Object.keys(byGame).sort();
 var html='<button class="group-nav" data-action="group" data-value="all">◈ 全部游戏角色 <span class="count">'+items.length+'</span></button>';
 gameIds.forEach(function(gameId){
  var g=byGame[gameId],peopleCount=Object.keys(g.people).length;
  html+='<details class="game-section" data-game="'+safe(gameId)+'"><summary>▣ '+safe(gameNames[gameId]||gameId)+' <span class="count">'+g.count+'</span></summary>';
  html+='<button class="group-nav" data-action="group" data-value="game:'+safe(gameId)+'">全部角色 <span class="count">'+peopleCount+' 人</span></button>';
  html+='<div class="game-characters"></div></details>';
 });
 $('sideGroups').innerHTML=html;
 $('gameFilter').innerHTML='<option value="all">全部游戏</option>'+gameIds.map(function(id){return '<option value="'+safe(id)+'">'+safe(gameNames[id]||id)+'</option>'}).join('');
 var picks=[],selectedGames=new Set(),selectedIds=new Set();
 items.forEach(function(c){if(!selectedGames.has(c.gameId)&&picks.length<12){picks.push(c);selectedGames.add(c.gameId);selectedIds.add(c.id)}});
 items.forEach(function(c){if(picks.length<12&&!selectedIds.has(c.id)){picks.push(c);selectedIds.add(c.id)}});
 $('featured').innerHTML=picks.map(function(c){
  return '<button class="feat" data-action="group" data-value="'+safe('char:'+c.gameId+'|'+c.characterKey)+'"><img src="'+safe(previewFor(c))+'" alt="" width="43" height="43" loading="lazy" decoding="async"><div style="min-width:0"><b>'+safe(c.zh||c.characterKey||c.name)+'</b><span>'+safe(gameNames[c.gameId]||c.gameId)+'</span></div></button>'
 }).join('');
 updateGroupNav();
}
$('sideGroups').addEventListener('toggle',function(e){
 if(e.target.matches('details.game-section')&&e.target.open)fillGameLinks(e.target);
},true);
function render(append){
 if(!items.length){$('gallery').innerHTML='<div class="blank">没有加载到图片资料。检查网络后刷新页面。</div>';return}
 if(!append)active=filterItems();
 $('resultInfo').textContent='匹配 '+active.length+' 项 · 已移除头像记录 · 全身立绘候选';
 $('favCount').textContent='☆ 已收藏 '+favorites.size+' 项';
 $('favFilter').classList.toggle('active',onlyFav);
 document.querySelectorAll('[data-action="mode"]').forEach(function(e){e.classList.toggle('active',e.dataset.value===mode)});
 if(!groupsReady){drawGroups();groupsReady=true;}
 var shown=active.slice(0,page*PAGE_SIZE);
 var incoming=append?active.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE):shown;
 var markup=shown.length?incoming.map(function(c){
 var label=c.kind==='full'?'全身立绘':'头像资料';
 var details=[gameNames[c.gameId]||c.game||'',c.zh||'',c.manufacturer||'',c.rarity||'',c.variant?'服装 / 变体':''].filter(Boolean).join(' · ')||'游戏角色';
 return '<article class="card"><button class="card-img '+(c.kind==='icon'?'icon-only':'')+'" data-action="view" data-id="'+safe(c.id)+'" aria-label="查看 '+safe(c.name)+'"><img src="'+safe(previewFor(c))+'" alt="'+safe(c.name)+' 角色美术" loading="lazy" decoding="async" fetchpriority="low" width="420" height="560"><span class="ribbon">'+label+'</span><span class="error-note">源站暂时无法显示</span></button><button class="fav '+(favorites.has(c.id)?'on':'')+'" title="收藏角色" data-action="fav" data-id="'+safe(c.id)+'" aria-label="'+(favorites.has(c.id)?'取消收藏':'收藏')+'">'+(favorites.has(c.id)?'★':'☆')+'</button><div class="card-info"><h3 title="'+safe(c.name)+'">'+safe(c.zh?c.zh+' · '+c.name:c.name)+'</h3><p title="'+safe(details)+'">'+safe(details)+'</p><div class="card-bottom"><span>'+safe(c.id)+'</span><a href="'+safe(c.source)+'" target="_blank" rel="noopener noreferrer">原始来源 ↗</a></div></div></article>';
 }).join(''):'<div class="blank">没有符合条件的角色。试着清除搜索、稀有度或分类筛选。</div>';
 if(append&&$('gallery').querySelector('.card'))$('gallery').insertAdjacentHTML('beforeend',markup);
 else $('gallery').innerHTML=markup;
 $('more').hidden=shown.length>=active.length;
 $('more').textContent='加载更多角色（'+shown.length+' / '+active.length+'） ↓';
}
function focusArchiveResults(){
 // Desktop is a fixed-height workspace; only the gallery grid should scroll.
 if(matchMedia('(min-width:851px)').matches){$('gallery').scrollTop=0;return}
 $('explore').scrollIntoView({behavior:'smooth',block:'start'});
}
function startGroup(id){selectedGroup=id;page=1;mode='all';onlyFav=false;$('kindFilter').value='all';render();updateGroupNav();focusArchiveResults()}
