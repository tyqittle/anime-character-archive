'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'main.cjs'),'utf8');
function harness(argv=['electron','.']){
 const callbacks=new Map(),ipcHandlers=new Map(),windows=[],menus=[];
 const app={
  isPackaged:true,
  on:(event,fn)=>callbacks.set(event,fn),
  whenReady:()=>Promise.resolve(),
  requestSingleInstanceLock:()=>true,
  getPath:()=>'/tmp/anime-character-archive-desktop-test',
  setAsDefaultProtocolClient:()=>true,
  disableHardwareAcceleration(){this.hwDisabled=true},
  relaunch(){this.relaunched=true},
  quit:()=>{}
 };
 class FakeBrowserWindow{
  constructor(options){this.options=options;this.events={};this.bounds={x:10,y:10,width:440,height:650};this.visible=true;this.webContents={
   on:(event,fn)=>this.events['wc:'+event]=fn,
   setWindowOpenHandler:fn=>this.openHandler=fn,
   executeJavaScript:async()=>{},
   insertCSS:async()=>{}
  };windows.push(this)}
  setMenu(){} setShape(rects){this.shape=rects} setOpacity(value){this.opacity=value} on(event,fn){this.events[event]=fn}
  loadURL(url){this.url=url;return Promise.resolve()}
  show(){this.visible=true}hide(){this.visible=false}
  isVisible(){return this.visible}isDestroyed(){return false}
  getBounds(){return this.bounds}
  setIgnoreMouseEvents(ignore){this.ignored=ignore}
  setAlwaysOnTop(value){this.top=value}
  setPosition(x,y){this.bounds.x=x;this.bounds.y=y}
  reload(){}
 }
 class FakeTray{setToolTip(value){this.tip=value}setContextMenu(value){this.menu=value}on(){}}
 const fakeFs={...fs,readFileSync:()=>{throw Error('no prior settings')},mkdirSync:()=>{},writeFileSync:()=>{}};
 const fakeElectron={app,ipcMain:{on:(name,fn)=>ipcHandlers.set(name,fn)},BrowserWindow:FakeBrowserWindow,Menu:{buildFromTemplate:items=>{menus.push(items);return items}},Tray:FakeTray,nativeImage:{createFromBuffer:()=>({resize:()=>({})})},shell:{openExternal:()=>{}},screen:{getPrimaryDisplay:()=>({bounds:{x:0,y:0,width:1920,height:1080},workArea:{x:0,y:0,width:1920,height:1080}}),getAllDisplays:()=>[{bounds:{x:0,y:0,width:1920,height:1080}}]},dialog:{showErrorBox:()=>{},showMessageBox:async()=>({response:1})}};
 const context={__dirname:__dirname,require:id=>id==='electron'?fakeElectron:id==='node:fs'?fakeFs:id==='node:os'?{release:()=> '10.0.19045'}:require(id),module:{},process:{argv,platform:'win32'},console,Buffer,URL,setTimeout,clearTimeout};
 vm.runInNewContext(source,context,{filename:'desktop/main.cjs',timeout:1500});
 return {windows,callbacks,menus,ipcHandlers,app};
}
test('desktop app starts in a transparent sandboxed window',async()=>{
 const h=harness();await new Promise(resolve=>setImmediate(resolve));
 const w=h.windows[0];
 assert.ok(w);
 assert.equal(w.options.transparent,true);
 assert.equal(w.options.webPreferences.nodeIntegration,false);
 assert.equal(w.options.webPreferences.sandbox,true);
 assert.ok(w.url.includes('spine.html?desktop=1&id=c012'));
});
test('allowed scheme changes character without creating another window',async()=>{
 const h=harness();await new Promise(resolve=>setImmediate(resolve));
 h.callbacks.get('second-instance')(null,['app.exe','animecharacter://open?id=c010']);
 assert.match(h.windows[0].url,/id=c010$/);
 assert.equal(h.windows.length,1);
});
test('external navigation is rejected',async()=>{
 const h=harness();await new Promise(resolve=>setImmediate(resolve));
 const w=h.windows[0];let blocked=false;
 w.events['wc:will-navigate']({preventDefault(){blocked=true}},'https://tyqittle.github.io/anime-character-archive.evil/spine.html');
 assert.equal(blocked,true);
});

test('transparent stage stays INSIDE Windows 10 monitor bounds',async()=>{
 const h=harness();await new Promise(resolve=>setImmediate(resolve));
 const w=h.windows[0];
 assert.equal(w.options.x,1);
 assert.equal(w.options.y,1);
 assert.equal(w.options.width,1918);
 assert.equal(w.options.height,1078);
 assert.equal(w.options.resizable,false);
 assert.equal(w.ignored,true);
});
test('desktop retains region-free native alpha and honors pointer forwarding',async()=>{
 const h=harness();await new Promise(resolve=>setImmediate(resolve));
 const w=h.windows[0],handler=h.ipcHandlers.get('desktop:set-interactive');
 assert.equal(typeof handler,'function');
 handler({sender:{}},true);
 assert.equal(w.ignored,true);
 handler({sender:w.webContents},true);
 assert.equal(w.ignored,false);
 handler({sender:w.webContents},false);
 assert.equal(w.ignored,true);
 assert.equal(w.shape,undefined);
 assert.equal(w.opacity,undefined);
});

test('desktop mode resets document root before stylesheets and keeps transparent WebGL buffers',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../spine.html'),'utf8');
 const runtime=fs.readFileSync(path.join(__dirname,'../assets/js/spine/spine-runtime.js'),'utf8');
 assert.ok(html.includes("document.documentElement.classList.add('desktop-mode')"));
 assert.ok(html.includes("document.documentElement.style.setProperty('background','transparent','important')"));
 assert.ok(runtime.includes("alpha:transparentDesktop,backgroundColor:transparentDesktop?'#00000000'"));
 assert.ok(runtime.includes("preserveDrawingBuffer:transparentDesktop"));
 assert.ok(runtime.includes("fullScreenBackgroundColor:transparentDesktop?'#00000000'"));
});

test('Win10 selects compositor compatibility without screenshot cutout layer',async()=>{
 const h=harness();await new Promise(resolve=>setImmediate(resolve));
 const w=h.windows[0];
 assert.equal(h.app.hwDisabled,true);
 assert.equal(w.options.transparent,true);
 assert.equal(w.options.opacity,undefined);
 assert.equal(w.shape,undefined);
 assert.ok(w.options.webPreferences.preload.endsWith('preload.cjs'));
 assert.ok(!source.includes('setShape('));
 assert.ok(!source.includes('shapeFromBGRA'));
 assert.ok(!source.includes('refreshSilhouette'));
});
