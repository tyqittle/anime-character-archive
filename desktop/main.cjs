'use strict';
const {app,BrowserWindow,Menu,Tray,nativeImage,shell,screen,dialog,ipcMain}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {URL}=require('node:url');
const os=require('node:os');
const SITE='https://tyqittle.github.io/anime-character-archive/';
const SAFE_ID=/^[a-zA-Z0-9_-]{1,120}$/;
let win,tray,clickThrough=false,alwaysOnTop=true,characterId='c012';
let savedBounds=null,voiceEnabled=true,nativeIgnoring=null;
let compatibilityMode=false,compatibilityChecked=false;

const configFile=()=>path.join(app.getPath('userData'),'desktop-settings.json');
function defaultCompatibilityMode(){
 if(process.platform!=='win32')return false;
 const version=Number((os.release().split('.')[2]||'0'));
 return version>0&&version<22000; // Windows 10 transparency compatibility
}
// Hardware acceleration settings MUST be applied before app.whenReady().
try{
 const stored=JSON.parse(fs.readFileSync(configFile(),'utf8'));
 compatibilityMode=typeof stored.compatibilityMode==='boolean'
  ?stored.compatibilityMode:defaultCompatibilityMode();
}catch{compatibilityMode=defaultCompatibilityMode()}
if(compatibilityMode)app.disableHardwareAcceleration();
function changeCompatibility(enabled){
 compatibilityMode=enabled;
 saveSettings();
 app.relaunch();
 app.quit();
}
function readSettings(){
 try{const x=JSON.parse(fs.readFileSync(configFile(),'utf8'));if(SAFE_ID.test(x.id))characterId=x.id;if(typeof x.alwaysOnTop==='boolean')alwaysOnTop=x.alwaysOnTop;if(typeof x.voiceEnabled==='boolean')voiceEnabled=x.voiceEnabled;if(x.bounds&&[x.bounds.x,x.bounds.y,x.bounds.width,x.bounds.height].every(Number.isFinite))savedBounds=x.bounds;}catch{}
 const arg=process.argv.find(x=>x.startsWith('--character='));
 if(arg&&SAFE_ID.test(arg.slice(12)))characterId=arg.slice(12);
}
function saveSettings(){try{fs.mkdirSync(path.dirname(configFile()),{recursive:true});fs.writeFileSync(configFile(),JSON.stringify({id:characterId,alwaysOnTop,voiceEnabled,compatibilityMode,bounds:win&&!win.isDestroyed()?win.getBounds():savedBounds},null,2));}catch(e){console.warn(e)}}
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
 if(win){clickThrough=false;setNativeIgnore(true);win.show();win.loadURL(urlFor(id)).catch(console.error)}
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
html,body,.wrap,.stage,#player,.spine-player,.spine-player-container,.spine-player-canvas,.spine-player-content{background:none!important;background-image:none!important;background-color:transparent!important;box-shadow:none!important;border:0!important;border-radius:0!important;outline:0!important}\nhtml::before,html::after,body::before,body::after,.stage::before,.stage::after{display:none!important;content:none!important}
html,body{width:100%!important;height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important}
.wrap{display:block!important;width:100%!important;height:100%!important;max-width:none!important;min-height:0!important;margin:0!important;padding:0!important}
.stage{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important}
.side,.head,.stage-toolbar,.stage-hint,#status,#loadNotice,footer,.archive-friendlinks,.advanced-tools{display:none!important}
#player{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;padding:0!important}
#player canvas{background:transparent!important}
#player iframe{border:0!important;background:transparent!important}
#placeholder{background:transparent!important;color:#eee!important;text-shadow:0 1px 4px #111}
#desktopDrag{display:none!important}

`;
function isTrustedPage(input){
 try{
  const actual=new URL(input),allowed=new URL(SITE+'spine.html');
  return actual.origin===allowed.origin&&actual.pathname===allowed.pathname;
 }catch{return false}
}
function setNativeIgnore(ignore){
 if(!win||win.isDestroyed()||nativeIgnoring===ignore)return;
 nativeIgnoring=ignore;
 win.setIgnoreMouseEvents(ignore,ignore?{forward:true}:undefined);
}
ipcMain.on('desktop:set-interactive',(event,active)=>{
 if(!win||win.isDestroyed()||event.sender!==win.webContents||typeof active!=='boolean')return;
 // Native region shape is authoritative: empty areas always click through.
 // Do not override its hit testing with a broad rectangular hover guess.
 setNativeIgnore(clickThrough||!active);
});
function createWindow(){
 const area=screen.getPrimaryDisplay().bounds;
 // Keep the transparent layer strictly inside the monitor. Windows 10 / Electron
 // can render the ENTIRE transparent window opaque white if any portion extends
 // beyond the display bounds (Electron issue #48592).
 // Inset by a pixel so this window is not treated as an exclusive fullscreen.
 const inset=1;
 const bounds={x:area.x+inset,y:area.y+inset,
  width:Math.max(220,area.width-2*inset),height:Math.max(260,area.height-2*inset)};
 win=new BrowserWindow({...bounds,transparent:true,frame:false,resizable:false,hasShadow:false,backgroundColor:'#00000000',alwaysOnTop,skipTaskbar:true,autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false,preload:path.join(__dirname,'preload.cjs')}});
 win.setMenu(null);
 // Chromium's default webContents backing surface can otherwise be white,
 // even with a transparent frameless native window.
 win.setBackgroundColor?.('rgba(0,0,0,0)');
 nativeIgnoring=null;
 setNativeIgnore(true);
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
  win.webContents.insertCSS(desktopCSS,{cssOrigin:'user'}).catch(console.error);
  if(compatibilityMode&&!compatibilityChecked){
   compatibilityChecked=true;
   win.webContents.executeJavaScript(`(()=>{
    try{const c=document.createElement('canvas');return Boolean(
     c.getContext('webgl2')||c.getContext('webgl')||c.getContext('experimental-webgl'));
    }catch{return false}
   })()`).then(supported=>{
    if(!supported&&win&&!win.isDestroyed()){
     console.warn('Software compatibility renderer lacks WebGL; restoring hardware mode');
     changeCompatibility(false);
    }
   }).catch(error=>console.warn('WebGL compatibility probe failed',error));
  }

  if(!voiceEnabled)win.webContents.executeJavaScript('(()=>{voiceEnabled=false;updateVoiceUI();syncFrameVoice();silenceCharacterVoice()})()').catch(console.error);
  win.webContents.executeJavaScript("(()=>{if(!document.getElementById('desktopDrag')){let el=document.createElement('div');el.id='desktopDrag';el.title='拖动这里移动桌面立绘';document.body.append(el)}document.body.style.background='transparent';if(!document.getElementById('desktopError')){let e=document.createElement('div');e.id='desktopError';e.style.cssText='position:fixed;bottom:26px;left:15px;right:15px;z-index:999999;color:white;background:#792626dd;padding:9px;border-radius:9px;font:12px system-ui;display:none;pointer-events:none';document.body.append(e);let status=document.getElementById('status');if(status){let update=()=>{let error=status.classList.contains('error');e.textContent=error?status.textContent:'';e.style.display=error?'block':'none'};new MutationObserver(update).observe(status,{subtree:true,childList:true,attributes:true});update()}}})()").catch(console.error);
 });
 // The screen-sized overlay is stationary; model gestures move the artwork,
 // not the native window. Persisting its bounds would restore the old clipping bug.
 win.on('closed',()=>{win=null;nativeIgnoring=null});
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
async function inspectTransparency(){
 if(!win||win.isDestroyed())return;
 const css=await win.webContents.executeJavaScript(`(()=>{
  const color=sel=>{const e=document.querySelector(sel);return e?{background:getComputedStyle(e).backgroundColor,image:getComputedStyle(e).backgroundImage}:null};
  return {html:color('html'),body:color('body'),stage:color('.stage'),player:color('#player'),
   renderer:window.__desktopRendererDiagnostics||null, canvas:color('#player canvas'),
   desktopMode:document.documentElement.classList.contains('desktop-mode')};
 })()`).catch(e=>({error:e.message}));
 let screenshot=null;
 try{
  const img=await win.webContents.capturePage({x:4,y:4,width:2,height:2});
  const pixels=img.toBitmap();
  screenshot=pixels.length>=4?{b:pixels[0],g:pixels[1],r:pixels[2],a:pixels[3]}:null;
 }catch(e){screenshot={error:e.message}}
 const report={...css,screenshot,compatibilityMode,
  hardwareAcceleration:app.isHardwareAccelerationEnabled?.()??null};
 console.info('Desktop transparency diagnostics',report);
 return report;
}
async function displayTransparencyDiagnostic(){
 const report=await inspectTransparency();
 dialog.showMessageBox(win,{type:'info',title:'透明渲染诊断',message:'已检查透明背景和 WebGL Alpha 通道',
  detail:JSON.stringify(report,null,2),buttons:['关闭']}).catch(console.warn);
}
function desktopMenu(){
 return [
  {label:'切换角色（当前 '+characterId+'）',click:chooseCharacter},
  {label:'打开网站角色目录',click:()=>shell.openExternal(SITE+'spine.html')},
  {label:'重新加载角色',click:()=>win?.reload()},
  {label:'透明渲染诊断',click:()=>displayTransparencyDiagnostic()},
  {label:'兼容透明模式（使用软件合成，切换后重启）',type:'checkbox',checked:compatibilityMode,click:i=>changeCompatibility(i.checked)},
  {label:'点击语音',type:'checkbox',checked:voiceEnabled,click:i=>{voiceEnabled=i.checked;saveSettings();win?.webContents.executeJavaScript('(()=>{voiceEnabled='+String(i.checked)+';updateVoiceUI();syncFrameVoice();if(!voiceEnabled)silenceCharacterVoice()})()').catch(console.error);updateTray()}},
  {type:'separator'},
  {label:'强制鼠标穿透（禁止角色互动）',type:'checkbox',checked:clickThrough,click:i=>{clickThrough=i.checked;setNativeIgnore(true);updateTray()}},
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
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABDElEQVR4nGNgGOmAkZCC4Lx7/ymxYO0kJbx24JSk1GJiHcJED8vxmYnhAFpYjs9sJkIKaO0IrFFATwBPGKT6flG3IoZYXOl9ovXDEiULKZbishhdjhSHEO0AfBZT4hCi0gAplpOqb8ATIUEHkOt7YvUP7hDA5Xo94zC8hqLL4wsFkkMAZjguRxCSp9gB1AYkO+DS2VUoNKnyFDuAGMOJtZygA7CVZHrGYUQlQmQ1+EpEsqOAUCIkNhSIqg2xZSN8oYBsOS7fw2pDsnMBoURILEBpKJIaCoQAId8zMJBQHcMMI8YhpLQHMJrKxLaMyG0RoTfPsbbVadU4xdY3wJoICfVmqGU5A8Mg6JqNAgDV5HmjGYGRKgAAAABJRU5ErkJggg==','base64');
 tray=new Tray(nativeImage.createFromBuffer(png).resize({width:16,height:16}));
 tray.on('double-click',()=>win?.isVisible()?win.hide():win?.show());
 updateTray();
});
app.on('window-all-closed',()=>{}); // tray owns lifecycle
app.on('before-quit',saveSettings);
