'use strict';
var ROOT='https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/';
var groups=[];
var gameNames={nikke:'胜利女神：妮姬',bluearchive:'蔚蓝档案',arknights:'明日方舟',genshin:'原神',starrail:'崩坏：星穹铁道',gfl2:'少女前线2：追放',wutheringwaves:'鸣潮',zzz:'绝区零',reverse1999:'重返未来：1999'};
var $=function(id){return document.getElementById(id)};
var safe=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]})};
var items=[],active=[],selectedGroup='all',activeId='',page=1,mode='all',onlyFav=false;
var groupsReady=false,peopleByGame={},PAGE_SIZE=24;
var FAVORITES_STORAGE_KEY='anime-character-archive-favorites-v1';
var LEGACY_FAVORITES_STORAGE_KEY='winter-characters-favorites-v1';
var favorites=new Set();
try{
 // Preserve bookmarks already saved before the repository rename.
 var savedFavorites=localStorage.getItem(FAVORITES_STORAGE_KEY);
 if(savedFavorites===null){
  savedFavorites=localStorage.getItem(LEGACY_FAVORITES_STORAGE_KEY);
  if(savedFavorites!==null)localStorage.setItem(FAVORITES_STORAGE_KEY,savedFavorites);
 }
 favorites=new Set(JSON.parse(savedFavorites||'[]'));
}catch(e){}
function iconFor(id){return ROOT+'images/sprite/si_'+id+'_00_s.png'}
function previewFor(c){var src=c.thumb&&/^\.\/assets\/thumbs\/[a-zA-Z0-9_-]+\.webp$/.test(c.thumb)?c.thumb:c.image;return src===c.thumb?src+'?frame=game-expansion-20261021':src}
