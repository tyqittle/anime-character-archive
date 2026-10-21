'use strict';
const manifestUrl='./data/spine-characters.json?v=20261021-newgames-v1';
const bd2CatalogUrl='./data/spine-bd2-characters.json?v=20261021-bulk209';
const azurlaneCatalogUrl='./data/live2d-azurlane.json?v=20261021-azurlane-fullpreview-v3';
const embeddedCharacters=[{"id":"c010","name":"Rapi","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c010/c010_00"},{"id":"c011","name":"Neon","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c011/c011_00"},{"id":"c012","name":"Anis","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c012/c012_00"},{"id":"c013","name":"Marian","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c013/c013_00"},{"id":"c015","name":"Anis: Sparkling Summer","spineVersion":"4.1","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c015/c015_00"},{"id":"c040","name":"D","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c040/c040_00"},{"id":"c060","name":"Belorta","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c060/c060_00"},{"id":"c070","name":"Brid","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c070/c070_00"},{"id":"c072","name":"Diesel","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c072/c072_00"},{"id":"c080","name":"Centi","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c080/c080_00"},{"id":"c090","name":"Emma","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c090/c090_00"},{"id":"c101","name":"Drake","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c101/c101_00"},{"id":"c110","name":"Crow","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c110/c110_00"},{"id":"c112","name":"Viper","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c112/c112_00"},{"id":"c170","name":"Privaty","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c170/c170_00"},{"id":"c180","name":"Guillotine","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c180/c180_00"},{"id":"c181","name":"Maiden","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c181/c181_00"},{"id":"c191","name":"Alice","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c191/c191_00"},{"id":"c200","name":"Rupee","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c200/c200_00"},{"id":"c203","name":"Rupee: Winter Shopper","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c203/c203_00"},{"id":"c222","name":"Scarlet","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c222/c222_00"},{"id":"c230","name":"Harran","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c230/c230_00"},{"id":"c233","name":"Dorothy","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c233/c233_00"},{"id":"c260","name":"Modernia","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c260/c260_00"},{"id":"c270","name":"Blanc","spineVersion":"4.1","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c270/c270_00"},{"id":"c280","name":"Rosanna","spineVersion":"4.1","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c280/c280_00"},{"id":"c282","name":"Sakura","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c282/c282_00"},{"id":"c352","name":"Helm","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c352/c352_00"},{"id":"c353","name":"Helm: Aquamarine","spineVersion":"4.1","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c353/c353_00"},{"id":"c400","name":"Guilty","spineVersion":"4.0","base":"https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/c400/c400_00"}];
// Keep this legacy IndexedDB name intentionally: renaming it would hide previously downloaded Spine packs in users' browsers.
const cacheDB='winter-spine-local-v1';
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(cacheDB,1);req.onupgradeneeded=()=>req.result.createObjectStore('packs',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function dbAction(mode,fn){const db=await openDB();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('packs',mode);const store=tx.objectStore('packs');let req;try{req=fn(store)}catch(e){reject(e);return}req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}}
// Listing saved packs must not deserialize every multi-megabyte texture bundle.
const cacheKeys=()=>dbAction('readonly',s=>s.getAllKeys());
async function refreshSaved(){try{
 const keys=await cacheKeys(),select=$('savedPacks'),previous=select.value;
 select.replaceChildren(new Option(keys.length?'选择已保存素材…':'暂无本地动画包',''),
  ...keys.map(id=>new Option(String(id),String(id))));
 if(keys.includes(previous))select.value=previous;
 $('deleteSaved').disabled=!select.value;
}catch(e){status('浏览器缓存不可用：'+e.message,true)}}
function stopWatchdog(){if(watchdog){clearTimeout(watchdog);watchdog=null}}
function status(message,error=false){
 $('status').textContent=message;
 $('status').classList.toggle('error',error);
 const loading=!error && /正在|已找到经版本检测的本地缓存|检测到.*Spine 版本|已读取骨骼/.test(message) && !message.startsWith('正在播放：');
 $('loadNotice').hidden=!loading;
 if(loading)$('loadNoticeText').textContent=message.replace(/\s+/g,' ').slice(0,120);
}
function chosen(){return allCharacters.find(c=>c.id===$('characters').value)}
const nikkePortraits={"wiki-2b":{"image":"./assets/portraits/wiki-2b.webp","name":"2B"},"wiki-9s":{"image":"./assets/portraits/wiki-9s.webp","name":"9S"},"wiki-a2":{"image":"./assets/portraits/wiki-a2.webp","name":"A2"},"wiki-ade":{"image":"./assets/portraits/wiki-ade.webp","name":"Ade"},"wiki-ade-agent-bunny":{"image":"./assets/portraits/wiki-ade-agent-bunny.webp","name":"Ade Agent Bunny"},"c172":{"image":"./assets/portraits/c172.png","name":"Admi"},"c191":{"image":"./assets/portraits/c191.png","name":"Alice"},"wiki-alice-wonderland-bunny":{"image":"./assets/portraits/wiki-alice-wonderland-bunny.webp","name":"Alice Wonderland Bunny"},"c351":{"image":"./assets/portraits/c351.png","name":"Anchor"},"c012":{"image":"./assets/portraits/c012.png","name":"安妮丝"},"c015":{"image":"./assets/portraits/c015.png","name":"安妮丝"},"wiki-anis-star":{"image":"./assets/portraits/wiki-anis-star.webp","name":"Anis Star"},"c121":{"image":"./assets/portraits/c121.png","name":"Anne: Miracle Fairy"},"wiki-arcana":{"image":"./assets/portraits/wiki-arcana.webp","name":"Arcana"},"c432":{"image":"./assets/portraits/c432.png","name":"Aria"},"wiki-bay":{"image":"./assets/portraits/wiki-bay.webp","name":"Bay"},"c060":{"image":"./assets/portraits/c060.png","name":"Belorta"},"c381":{"image":"./assets/portraits/c381.png","name":"Biscuit"},"c270":{"image":"./assets/portraits/c270.png","name":"Blanc"},"c070":{"image":"./assets/portraits/c070.png","name":"Brid"},"c080":{"image":"./assets/portraits/c080.png","name":"Centi"},"wiki-chime":{"image":"./assets/portraits/wiki-chime.webp","name":"Chime"},"wiki-cinderella":{"image":"./assets/portraits/wiki-cinderella.webp","name":"Cinderella"},"wiki-clay":{"image":"./assets/portraits/wiki-clay.webp","name":"Clay"},"c311":{"image":"./assets/portraits/c311.png","name":"Cocoa"},"c110":{"image":"./assets/portraits/c110.png","name":"Crow"},"wiki-crown":{"image":"./assets/portraits/wiki-crown.webp","name":"Crown"},"c040":{"image":"./assets/portraits/c040.png","name":"D"},"c020":{"image":"./assets/portraits/c020.png","name":"Delta"},"c072":{"image":"./assets/portraits/c072.png","name":"Diesel"},"c202":{"image":"./assets/portraits/c202.png","name":"Dolla"},"c233":{"image":"./assets/portraits/c233.png","name":"桃乐丝"},"c101":{"image":"./assets/portraits/c101.png","name":"Drake"},"wiki-ein":{"image":"./assets/portraits/wiki-ein.webp","name":"Ein"},"wiki-elegg":{"image":"./assets/portraits/wiki-elegg.webp","name":"Elegg"},"c090":{"image":"./assets/portraits/c090.png","name":"Emma"},"c241":{"image":"./assets/portraits/c241.png","name":"Epinel"},"c291":{"image":"./assets/portraits/c291.png","name":"Ether"},"c092":{"image":"./assets/portraits/c092.png","name":"Eunhwa"},"c210":{"image":"./assets/portraits/c210.png","name":"Exia"},"wiki-flora":{"image":"./assets/portraits/wiki-flora.webp","name":"Flora"},"c242":{"image":"./assets/portraits/c242.png","name":"Folkwang"},"c142":{"image":"./assets/portraits/c142.png","name":"Frima"},"wiki-grave":{"image":"./assets/portraits/wiki-grave.webp","name":"Grave"},"c180":{"image":"./assets/portraits/c180.png","name":"Guillotine"},"c400":{"image":"./assets/portraits/c400.png","name":"Guilty"},"c230":{"image":"./assets/portraits/c230.png","name":"Harran"},"c352":{"image":"./assets/portraits/c352.png","name":"海伦"},"c353":{"image":"./assets/portraits/c353.png","name":"海伦"},"c802":{"image":"./assets/portraits/c802.png","name":"Himeno"},"wiki-indivilia":{"image":"./assets/portraits/wiki-indivilia.webp","name":"Indivilia"},"c231":{"image":"./assets/portraits/c231.png","name":"Isabel"},"c111":{"image":"./assets/portraits/c111.png","name":"Jackal"},"c150":{"image":"./assets/portraits/c150.png","name":"Julia"},"wiki-k":{"image":"./assets/portraits/wiki-k.webp","name":"K"},"c100":{"image":"./assets/portraits/c100.png","name":"Laplace"},"wiki-leona":{"image":"./assets/portraits/wiki-leona.webp","name":"Leona"},"c082":{"image":"./assets/portraits/c082.png","name":"Liter"},"c190":{"image":"./assets/portraits/c190.png","name":"Ludmilla"},"c181":{"image":"./assets/portraits/c181.png","name":"梅登"},"c800":{"image":"./assets/portraits/c800.png","name":"Makima"},"wiki-mana":{"image":"./assets/portraits/wiki-mana.webp","name":"Mana"},"wiki-marciana":{"image":"./assets/portraits/wiki-marciana.webp","name":"Marciana"},"c013":{"image":"./assets/portraits/c013.png","name":"Marian"},"c130":{"image":"./assets/portraits/c130.png","name":"Mary"},"c132":{"image":"./assets/portraits/c132.png","name":"Mary: Bay Goddess"},"c254":{"image":"./assets/portraits/c254.png","name":"Mass Produced Purple"},"c350":{"image":"./assets/portraits/c350.png","name":"Mast"},"c102":{"image":"./assets/portraits/c102.png","name":"Maxwell"},"c061":{"image":"./assets/portraits/c061.png","name":"Mica"},"c161":{"image":"./assets/portraits/c161.png","name":"Mihara"},"c141":{"image":"./assets/portraits/c141.png","name":"Milk"},"c032":{"image":"./assets/portraits/c032.png","name":"Miranda"},"c260":{"image":"./assets/portraits/c260.png","name":"神罚"},"wiki-moran":{"image":"./assets/portraits/wiki-moran.webp","name":"Moran"},"c120":{"image":"./assets/portraits/c120.png","name":"N102"},"wiki-naga":{"image":"./assets/portraits/wiki-naga.webp","name":"Naga"},"c011":{"image":"./assets/portraits/c011.png","name":"Neon"},"c014":{"image":"./assets/portraits/c014.png","name":"Neon: Blue Ocean"},"c380":{"image":"./assets/portraits/c380.png","name":"Nero"},"c193":{"image":"./assets/portraits/c193.png","name":"Neve"},"c261":{"image":"./assets/portraits/c261.png","name":"Nihilister"},"c232":{"image":"./assets/portraits/c232.png","name":"Noah"},"c271":{"image":"./assets/portraits/c271.png","name":"Noir"},"c430":{"image":"./assets/portraits/c430.png","name":"Noise"},"c212":{"image":"./assets/portraits/c212.png","name":"Novel"},"c131":{"image":"./assets/portraits/c131.png","name":"Pepper"},"wiki-phantom":{"image":"./assets/portraits/wiki-phantom.webp","name":"Phantom"},"c030":{"image":"./assets/portraits/c030.png","name":"Poli"},"c801":{"image":"./assets/portraits/c801.png","name":"Power"},"c170":{"image":"./assets/portraits/c170.png","name":"普丽瓦蒂"},"c302":{"image":"./assets/portraits/c302.png","name":"Product 08"},"c303":{"image":"./assets/portraits/c303.png","name":"Product 12"},"c307":{"image":"./assets/portraits/c307.png","name":"Product 23"},"c402":{"image":"./assets/portraits/c402.png","name":"Quency"},"wiki-quiry":{"image":"./assets/portraits/wiki-quiry.webp","name":"Quiry"},"c010":{"image":"./assets/portraits/c010.png","name":"拉毗"},"c221":{"image":"./assets/portraits/c221.png","name":"Rapunzel"},"wiki-red-hood":{"image":"./assets/portraits/wiki-red-hood.webp","name":"Red Hood"},"c392":{"image":"./assets/portraits/c392.png","name":"Rei"},"c280":{"image":"./assets/portraits/c280.png","name":"罗珊娜"},"wiki-rouge":{"image":"./assets/portraits/wiki-rouge.webp","name":"Rouge"},"c240":{"image":"./assets/portraits/c240.png","name":"Rumani"},"c200":{"image":"./assets/portraits/c200.png","name":"露菲"},"c203":{"image":"./assets/portraits/c203.png","name":"露菲"},"c282":{"image":"./assets/portraits/c282.png","name":"樱花"},"c222":{"image":"./assets/portraits/c222.png","name":"红莲"},"c022":{"image":"./assets/portraits/c022.png","name":"Signal"},"c401":{"image":"./assets/portraits/c401.png","name":"Sin"},"c220":{"image":"./assets/portraits/c220.png","name":"Snow White"},"c312":{"image":"./assets/portraits/c312.png","name":"Soda"},"c300":{"image":"./assets/portraits/c300.png","name":"Soldier EG"},"c301":{"image":"./assets/portraits/c301.png","name":"Soldier FA"},"c306":{"image":"./assets/portraits/c306.png","name":"Soldier OW"},"c071":{"image":"./assets/portraits/c071.png","name":"Soline"},"c140":{"image":"./assets/portraits/c140.png","name":"Sugar"},"wiki-tia":{"image":"./assets/portraits/wiki-tia.webp","name":"Tia"},"wiki-tove":{"image":"./assets/portraits/wiki-tove.webp","name":"Tove"},"wiki-trony":{"image":"./assets/portraits/wiki-trony.webp","name":"Trony"},"c091":{"image":"./assets/portraits/c091.png","name":"Vesti"},"c112":{"image":"./assets/portraits/c112.png","name":"毒蛇"},"c431":{"image":"./assets/portraits/c431.png","name":"Volume"},"c201":{"image":"./assets/portraits/c201.png","name":"Yan"},"c171":{"image":"./assets/portraits/c171.png","name":"Yulha"},"c160":{"image":"./assets/portraits/c160.png","name":"Yuni"},"wiki-zwei":{"image":"./assets/portraits/wiki-zwei.webp","name":"Zwei"},"c304":{"image":"./assets/portraits/c304.png","name":"iDoll Flower"},"c305":{"image":"./assets/portraits/c305.png","name":"iDoll Ocean"},"c308":{"image":"./assets/portraits/c308.png","name":"iDoll Sun"}};
let searchTimer=null;
// Preserve lazy-loaded character preview nodes across searches and game filters.
const characterCardCache=new Map();
function charInfo(c){
 // Only show a thumbnail actually captured from THIS exact Spine animation.
 // Never substitute the base character's portrait for a different costume.
 const exact=['matching-spine-animation-frame','matching-live2d-animation-frame'].includes(c.previewSource)
  &&c.preview==='./assets/animation-previews/'+(c.gameId||'nikke')+'-'+c.id+'.webp';
 const image=exact?c.preview:(c.gameId==='azurlane'&&c.previewSource==='upstream-ship-thumbnail'?c.preview:'');
 return {image,zh:c.zh||nikkePortraits[c.id]?.name||'',name:c.name||c.id};
}
function refreshCharacters(){
 const game=$('gameFilter').value,query=$('characterSearch').value.toLowerCase().trim();
 $('bd2Group').hidden=game!=='browndust2';
 const role=game==='browndust2'?$('bd2CharacterFilter').value:'';
 const filtered=allCharacters.filter(c=>{
  const info=charInfo(c);
  return (game==='all'||(c.gameId||'nikke')===game)
   &&(!role||c.characterName===role)
   &&(!query||[c.id,c.name,info.zh,c.gameId,c.costumeName||'',c.characterName||''].join(' ').toLowerCase().includes(query));
 });
 const previously=$('characters').value;
 $('characters').replaceChildren(new Option('请选择角色…',''),...filtered.map(c=>{
  const info=charInfo(c);
  const display=c.gameId==='browndust2'?(info.zh||c.name)+' · '+(c.costume||'').replace(/_/g,' ')
    :(info.zh&&info.zh!==c.name?info.zh+' · ':'')+c.name;
  return new Option(display,c.id)
 }));
 if(filtered.some(c=>c.id===previously))$('characters').value=previously;
 const area=$('characterCards'),visibleCards=[];
 for(const c of filtered.slice(0,240)){
  let card=characterCardCache.get(c.id);
  if(!card){
   const info=charInfo(c);
   card=document.createElement('button');card.type='button';card.className='character-card';
   if(info.image){
    const img=document.createElement('img');img.loading='lazy';img.decoding='async';img.width=150;img.height=130;
    img.src=info.image;img.alt=info.zh||info.name;
    img.onerror=()=>{img.replaceWith(Object.assign(document.createElement('div'),{className:'fallback',textContent:'暂无预览图'}))};
    img.title=c.previewSource==='matching-live2d-animation-frame'?'当前皮肤真实 Live2D 截图':c.gameId==='azurlane'?'上游角色静态缩略图（非动态模型截图）':'从当前角色的 Spine 动画直接截取的预览画面';card.append(img);
   }else{const placeholder=document.createElement('div');placeholder.className='fallback';placeholder.textContent=c.gameId==='azurlane'?'暂无预览图 · 点击可播放':c.gameId==='browndust2'?'真实模型预览待生成':'暂无预览图';card.append(placeholder)}
   const label=document.createElement('span');label.className='nm';
   label.textContent=c.gameId==='browndust2'?(info.zh||c.name):(info.zh&&info.zh!==c.name?info.zh+' / '+c.name:c.name);
   card.append(label);
   const code=document.createElement('small');
   code.textContent=c.gameId==='browndust2'?(c.costume||'').replace(/_/g,' '):c.id;
   code.title=c.id;card.append(code);
   card.onclick=()=>{$('characters').value=c.id;$('selectionNote').textContent='已选：'+label.textContent+' · 正在自动播放';refreshCardSelection();rememberSelectedCharacter();playCharacter(c);if(matchMedia('(max-width:850px)').matches)$('player').scrollIntoView({behavior:'smooth',block:'center'});};
   characterCardCache.set(c.id,card);
  }
  card.setAttribute('aria-pressed',String(c.id===$('characters').value));
  visibleCards.push(card);
 }
 area.replaceChildren(...visibleCards);
 $('selectionNote').textContent=filtered.length?(game==='browndust2'?'当前 '+filtered.length+' 套服装 · 点击直接播放':'共 '+filtered.length+' 套动画 · 点击直接播放'):'当前筛选没有匹配的角色。';
}
function refreshCardSelection(){const cards=$('characterCards').querySelectorAll('button');const ids=allCharacters.filter(c=>{const game=$('gameFilter').value,q=$('characterSearch').value.toLowerCase().trim(),info=charInfo(c);return (game==='all'||(c.gameId||'nikke')===game)&&(!($('gameFilter').value==='browndust2'&&$('bd2CharacterFilter').value)||c.characterName===$('bd2CharacterFilter').value)&&(!q||[c.id,c.name,info.zh,c.gameId,c.costumeName||'',c.characterName||''].join(' ').toLowerCase().includes(q))}).slice(0,240);cards.forEach((b,i)=>b.setAttribute('aria-pressed',String(ids[i]?.id===$('characters').value)))}
// Keep a refreshable deep link without re-rendering the gallery or navigating.
function rememberSelectedCharacter(){
 const url=new URL(location.href);
 const c=chosen();
 if(c)url.searchParams.set('id',c.id);
 else url.searchParams.delete('id');
 url.searchParams.delete('pack');
 history.replaceState(null,'',url.pathname+url.search+url.hash);
}
$('gameFilter').onchange=()=>{
 $('bd2CharacterFilter').value='';
 const prior=chosen();refreshCharacters();rememberSelectedCharacter();
 if(prior&&!chosen()){cancelCharacterDownload();clearPlayer();$('title').textContent='动画预览';$('stageContext').textContent='Spine · 原生骨骼渲染';status('已切换游戏。选择角色后将自动播放。')}
 // Warm the Cubism scripts while the user browses the Azur Lane list.
 // Keep its render ticker off until an actual model has been selected.
 if($('gameFilter').value==='azurlane'&&!azurlaneFrame&&!chosen()){
  ensureAzurLaneFrame();
  $('stageContext').textContent='碧蓝航线 · Cubism Live2D';
  status('正在准备 Live2D 播放引擎，点击角色后自动播放。');
 }
};
$('bd2CharacterFilter').onchange=()=>{refreshCharacters();rememberSelectedCharacter()};
$('characterSearch').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(refreshCharacters,140)};
