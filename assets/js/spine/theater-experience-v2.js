'use strict';
// Page presenter. Playback, identity and persistence stay with existing commands.
(() => {
 const el=id=>document.getElementById(id);
 if(!el('stageBrowse')||document.documentElement.classList.contains('desktop-mode'))return;
 let entries=[];
 const compact=()=>matchMedia('(max-width:850px)').matches;
 const gameDialog=el('gameBrowser');
 function showGames(){
  const query=el('gameSearch').value.trim().toLowerCase();
  const buttons=Array.from(el('gameFilter').options).filter(option=>(option.text+' '+option.value).toLowerCase().includes(query)).map(option=>{
   const button=document.createElement('button');button.type='button';
   const [name,count]=option.text.split(' · ');
   const title=document.createElement('strong');title.textContent=name;
   const meta=document.createElement('span');meta.textContent=count||'';
   button.append(title,meta);button.setAttribute('aria-pressed',String(option.value===el('gameFilter').value));
   button.onclick=()=>{
    el('characterSearch').value='';el('browseClear').hidden=true;
    el('gameFilter').value=option.value;el('gameFilter').dispatchEvent(new Event('change'));gameDialog.close();
    if(compact()&&document.body.classList.contains('theater-left-collapsed'))el('toggleLeftPanel').click();
   };
   return button;
  });
  el('gameChoices').replaceChildren(...buttons);
  el('gameEmpty').hidden=buttons.length>0;
 }
 el('browseGames').addEventListener('click',()=>{el('gameSearch').value='';showGames();gameDialog.showModal();el('gameSearch').focus()});
 el('closeGameBrowser').addEventListener('click',()=>gameDialog.close());
 el('gameSearch').addEventListener('input',showGames);
 gameDialog.addEventListener('click',event=>{if(event.target===gameDialog){const r=gameDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)gameDialog.close()}});
 el('emptyBrowse').addEventListener('click',()=>{
  if(document.body.classList.contains('theater-left-collapsed'))el('toggleLeftPanel').click();
  el('characterSearch').focus();
 });
 const forward=(from,to)=>el(from).addEventListener('click',()=>el(to).click());
 for(const [from,to] of [['stageBrowse','toggleLeftPanel'],['stageSettings','toggleRightPanel'],
  ['stageQuickFullscreen','fullscreenStage'],['stageZoomIn','zoomIn'],['stageZoomOut','zoomOut'],['stageFit','resetView']])forward(from,to);
 function activate(record){
  if(!record)return;
  selectCharacter(record);refreshCardSelection();rememberSelectedCharacter();playCharacter(record);
  if(compact()&&!document.body.classList.contains('theater-left-collapsed'))el('toggleLeftPanel').click();
 }
 function move(delta){
  const index=entries.findIndex(c=>c.id===el('characters').value);
  activate(entries[index<0?(delta>0?0:entries.length-1):(index+delta+entries.length)%entries.length]);
 }
 el('stagePrevious').addEventListener('click',()=>move(-1));
 el('stageNext').addEventListener('click',()=>move(1));
 el('stageRandom').addEventListener('click',()=>{
  const candidates=entries.filter(c=>c.id!==el('characters').value);
  activate(candidates[Math.floor(Math.random()*candidates.length)]||entries[0]);
 });
 el('browseClear').addEventListener('click',()=>{
  el('characterSearch').value='';el('characterSearch').dispatchEvent(new Event('input'));el('characterSearch').focus();
 });
 el('characterSearch').addEventListener('input',()=>{el('browseClear').hidden=!el('characterSearch').value});
 el('characterCards').addEventListener('click',event=>{
  if(compact()&&event.target.closest('.character-card')&&!document.body.classList.contains('theater-left-collapsed'))el('toggleLeftPanel').click();
 });
 function sync(){
  const record=chosen();
  el('stageCharacterName').textContent=record?(charInfo(record).zh||record.name):'发现喜欢的角色';
  const collection=record&&animationCollection(record);
  const gameLabel=Array.from(el('gameFilter').options).find(option=>option.value===collection)?.text.replace(/ · [\d,]+ 套$/,'');
  el('stageGameName').textContent=record?[gameLabel||record.game||record.gameId,record.costumeName||record.costume||record.id].filter(Boolean).join(' · '):'浏览游戏，选择角色与外观';
  for(const [from,to] of [['stageZoomIn','zoomIn'],['stageZoomOut','zoomOut'],['stageFit','resetView']])el(from).disabled=el(to).disabled;
  el('stageZoomLabel').textContent=el('zoomValue').textContent;
  const message=el('status');el('stageFeedback').textContent=message.textContent;
  el('stageFeedback').dataset.error=String(message.classList.contains('error'));
  for(const id of ['stagePrevious','stageNext','stageRandom'])el(id).disabled=!entries.length;
  for(const [id,panel] of [['stageBrowse','toggleLeftPanel'],['stageSettings','toggleRightPanel']])el(id).setAttribute('aria-expanded',el(panel).getAttribute('aria-expanded'));
 }
 const observer=new MutationObserver(sync);
 for(const id of ['status','title','zoomValue','zoomIn','toggleLeftPanel','toggleRightPanel'])observer.observe(el(id),{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','class','aria-expanded']});
 document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||gameDialog.open||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.repeat)return;
  if(event.target.closest('input,select,textarea,[contenteditable="true"],button,a,summary'))return;
  const shortcuts={ArrowLeft:'stagePrevious',ArrowRight:'stageNext',b:'stageBrowse',t:'stageSettings',f:'stageQuickFullscreen','0':'stageFit'};
  const id=shortcuts[event.key]||shortcuts[event.key.toLowerCase()];
  if(id){event.preventDefault();el(id).click()}
  if(event.key==='Escape'){
   for(const panel of ['toggleLeftPanel','toggleRightPanel'])if(el(panel).getAttribute('aria-expanded')==='true'&&compact())el(panel).click();
  }
 });
 window.ArchiveTheaterExperience=Object.freeze({
  setCatalog(filtered){
   entries=[...filtered];el('browseCount').textContent=entries.length.toLocaleString()+' 套外观';
   const area=el('characterCards');
   if(!entries.length){
    const empty=document.createElement('div');empty.className='catalog-empty';
    empty.textContent='没有找到匹配的角色或皮肤。';
    const reset=document.createElement('button');reset.type='button';reset.textContent='清除全部筛选';
    reset.onclick=()=>{el('gameFilter').value='all';el('characterSearch').value='';el('browseClear').hidden=true;el('gameFilter').dispatchEvent(new Event('change'))};
    empty.append(reset);area.replaceChildren(empty);
   }
   sync();
  },
  setSelection:sync
 });
 // A slow optional presenter can arrive after the async catalog bootstrap.
 // Reconcile from current records instead of assuming a script/network order.
 if(allCharacters.length)refreshCharacters();else sync();
})();
