'use strict';
const {app,BrowserWindow,Menu,Tray,nativeImage,shell,screen,dialog}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {URL}=require('node:url');
const SITE='https://tyqittle.github.io/anime-character-archive/';
const SAFE_ID=/^[a-zA-Z0-9_-]{1,120}$/;
let win,tray,clickThrough=false,alwaysOnTop=true,characterId='c012';
let savedBounds=null,voiceEnabled=true;
const configFile=()=>path.join(app.getPath('userData'),'desktop-settings.json');
function readSettings(){
 try{const x=JSON.parse(fs.readFileSync(configFile(),'utf8'));if(SAFE_ID.test(x.id))characterId=x.id;if(typeof x.alwaysOnTop==='boolean')alwaysOnTop=x.alwaysOnTop;if(typeof x.voiceEnabled==='boolean')voiceEnabled=x.voiceEnabled;if(x.bounds&&[x.bounds.x,x.bounds.y,x.bounds.width,x.bounds.height].every(Number.isFinite))savedBounds=x.bounds;}catch{}
 const arg=process.argv.find(x=>x.startsWith('--character='));
 if(arg&&SAFE_ID.test(arg.slice(12)))characterId=arg.slice(12);
}
function saveSettings(){try{fs.mkdirSync(path.dirname(configFile()),{recursive:true});fs.writeFileSync(configFile(),JSON.stringify({id:characterId,alwaysOnTop,voiceEnabled,bounds:win&&!win.isDestroyed()?win.getBounds():savedBounds},null,2));}catch(e){console.warn(e)}}
function urlFor(id){return SITE+'spine.html?desktop=1&id='+encodeURIComponent(id)}
function idFromProtocol(value){
 try{
  const url=new URL(value);
  if(url.protocol!=='animecharacter:'||url.hostname!=='open')return null;
  const id=url.searchParams.get('id')||'';
  return SAFE_ID.test(id)?id:null;
 }catch{return null}
}
function applyCharacter(id){
 if(!SAFE_ID.test(id))return;
 characterId=id;saveSettings();
 if(win){win.setIgnoreMouseEvents(false);clickThrough=false;win.show();win.loadURL(urlFor(id)).catch(console.error)}
 updateTray();
}
const singleInstance=app.requestSingleInstanceLock();
if(!singleInstance)app.quit();
else{
 app.on('second-instance',(_event,argv)=>{
  const id=argv.map(idFromProtocol).find(Boolean);
  if(id)applyCharacter(id);
  else if(win)win.show();
 });
 app.on('open-url',(event,url)=>{event.preventDefault();const id=idFromProtocol(url);if(id)applyCharacter(id)});
}
const desktopCSS=`
html,body,.wrap,.stage,#player,.spine-player,.spine-player-container{background:transparent!important;background-color:transparent!important;box-shadow:none!important;border:0!important}
html,body{width:100%!important;height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important}
.wrap{display:block!important;width:100%!important;height:100%!important;max-width:none!important;min-height:0!important;margin:0!important;padding:0!important}
.stage{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important}
.side,.head,.stage-toolbar,.stage-hint,#status,#loadNotice,footer,.archive-friendlinks,.advanced-tools{display:none!important}
#player{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;padding:0!important}
#player canvas{background:transparent!important}\n#player iframe{border:0!important;background:transparent!important}
#placeholder{background:transparent!important;color:#eee!important;text-shadow:0 1px 4px #111}
#desktopDrag{position:fixed;z-index:999999;left:calc(50% - 65px);top:0;width:130px;height:17px;border-radius:0 0 12px 12px;background:rgba(20,20,30,.20);-webkit-app-region:drag;pointer-events:auto}
#desktopDrag:hover{background:rgba(20,20,30,.55)}
`;
function isTrustedPage(input){
 try{
  const actual=new URL(input),allowed=new URL(SITE+'spine.html');
  return actual.origin===allowed.origin&&actual.pathname===allowed.pathname;
 }catch{return false}
}
function createWindow(){
 const area=screen.getPrimaryDisplay().workArea;
 const defaults={width:440,height:650,x:Math.max(area.x,area.x+area.width-470),y:Math.max(area.y,area.y+area.height-680)};
 const bounds=savedBounds&&savedBounds.width>=220&&savedBounds.height>=260&&screen.getAllDisplays().some(d=>{const b=d.bounds;return savedBounds.x<b.x+b.width-60&&savedBounds.x+savedBounds.width>b.x+60&&savedBounds.y<b.y+b.height-60&&savedBounds.y+savedBounds.height>b.y+60})?savedBounds:defaults;
 win=new BrowserWindow({...bounds,transparent:true,frame:false,resizable:true,hasShadow:false,backgroundColor:'#00000000',alwaysOnTop,skipTaskbar:true,autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 win.setMenu(null);
 win.webContents.setWindowOpenHandler(({url})=>{
  try{const parsed=new URL(url);if(parsed.protocol==='https:'||parsed.protocol==='http:')shell.openExternal(parsed.toString())}catch{}
  return {action:'deny'};
 });
 win.webContents.on('will-navigate',(event,url)=>{if(!isTrustedPage(url))event.preventDefault()});
 win.webContents.on('did-fail-load',(_event,errorCode,errorDescription,validatedURL,isMainFrame)=>{
  if(!isMainFrame||errorCode===-3)return;
  dialog.showMessageBox(win,{type:'warning',title:'角色加载失败',message:'无法打开动态立绘页面。',detail:errorDescription+'\\n'+validatedURL,buttons:['重试','取消']}).then(({response})=>{if(response===0&&win&&!win.isDestroyed())win.reload()});
 });
 win.webContents.on('context-menu',()=>Menu.buildFromTemplate(desktopMenu()).popup({window:win}));
 win.webContents.on('did-finish-load',()=>{
  win.webContents.insertCSS(desktopCSS).catch(console.error);
  win.webContents.executeJavaScript("(()=>{if(!document.getElementById('desktopDrag')){let el=document.createElement('div');el.id='desktopDrag';el.title='拖动这里移动桌面立绘';document.body.append(el)}document.body.style.background='transparent';if(!document.getElementById('desktopError')){let e=document.createElement('div');e.id='desktopError';e.style.cssText='position:fixed;bottom:26px;left:15px;right:15px;z-index:999999;color:white;background:#792626dd;padding:9px;border-radius:9px;font:12px system-ui;display:none;pointer-events:none';document.body.append(e);let status=document.getElementById('status');if(status){let update=()=>{let error=status.classList.contains('error');e.textContent=error?status.textContent:'';e.style.display=error?'block':'none'};new MutationObserver(update).observe(status,{subtree:true,childList:true,attributes:true});update()}}})()").catch(console.error);
 });
 win.on('move',()=>saveSettings());
 win.on('resize',()=>saveSettings());
 win.on('closed',()=>{win=null});
 win.on('unresponsive',()=>console.warn('Desktop renderer is unresponsive'));
 win.loadURL(urlFor(characterId)).catch(e=>dialog.showErrorBox('动态立绘加载失败',e.message));
}
function chooseCharacter(){
 if(!win)return;
 const selector=new BrowserWindow({parent:win,width:435,height:190,resizable:false,modal:false,autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 selector.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<html lang="zh"><meta charset="utf-8"><style>body{font:14px system-ui;padding:17px;background:#172033;color:#fff}input{width:96%;padding:9px}button{margin-top:12px;padding:8px 18px}</style><label>角色 ID（可从网站角色链接的 id= 中复制）<input id="id" value="'+escape(characterId)+'"></label><button onclick="location.href=\'https://desktop-character.local/select?id=\'+encodeURIComponent(document.getElementById(\'id\').value)">切换角色</button></html>'));
 selector.webContents.on('will-navigate',(event,url)=>{
  if(!url.startsWith('https://desktop-character.local/select?'))return;
  event.preventDefault();
  const id=new URL(url).searchParams.get('id')||'';
  if(!SAFE_ID.test(id)){dialog.showMessageBox(selector,{type:'warning',message:'角色 ID 格式不正确'});return}
  characterId=id;saveSettings();win.loadURL(urlFor(id));selector.close();updateTray();
 });
}
function desktopMenu(){
 return [
  {label:'切换角色（当前 '+characterId+'）',click:chooseCharacter},
  {label:'打开网站角色目录',click:()=>shell.openExternal(SITE+'spine.html')},
  {label:'重新加载角色',click:()=>win?.reload()},
  {type:'separator'},
  {label:'鼠标穿透（从托盘恢复）',type:'checkbox',checked:clickThrough,click:i=>{clickThrough=i.checked;win?.setIgnoreMouseEvents(clickThrough,{forward:true});updateTray()}},
  {label:'窗口始终置顶',type:'checkbox',checked:alwaysOnTop,click:i=>{alwaysOnTop=i.checked;win?.setAlwaysOnTop(alwaysOnTop);saveSettings();updateTray()}},
  {label:'显示 / 隐藏',click:()=>win?.isVisible()?win.hide():win?.show()},
  {type:'separator'},
  {label:'退出',click:()=>app.quit()}
 ];
}
function updateTray(){
 if(!tray)return;
 tray.setToolTip('次元桌面立绘 · '+characterId);
 tray.setContextMenu(Menu.buildFromTemplate(desktopMenu()));
}
if(singleInstance)app.whenReady().then(()=>{
 readSettings();
 const external=process.argv.map(idFromProtocol).find(Boolean);
 if(external)characterId=external;
 if(app.isPackaged&&process.platform==='win32')app.setAsDefaultProtocolClient('animecharacter');
 createWindow();
 // Tray icon generated from a tiny PNG embedded here; no extra assets required.
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 tray=new Tray(nativeImage.createFromBuffer(png).resize({width:16,height:16}));
 tray.on('double-click',()=>win?.isVisible()?win.hide():win?.show());
 updateTray();
});
app.on('window-all-closed',()=>{}); // tray owns lifecycle
app.on('before-quit',saveSettings);
