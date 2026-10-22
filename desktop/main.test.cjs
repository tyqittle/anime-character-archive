'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'main.cjs'),'utf8');
function harness(argv=['electron','.']){
 const callbacks=new Map(),windows=[],menus=[];
 const app={
  isPackaged:true,
  on:(event,fn)=>callbacks.set(event,fn),
  whenReady:()=>Promise.resolve(),
  requestSingleInstanceLock:()=>true,
  getPath:()=>'/tmp/anime-character-archive-desktop-test',
  setAsDefaultProtocolClient:()=>true,
  quit:()=>{}
 };
 class FakeBrowserWindow{
  constructor(options){this.options=options;this.events={};this.bounds={x:10,y:10,width:440,height:650};this.visible=true;this.webContents={
   on:(event,fn)=>this.events['wc:'+event]=fn,
   setWindowOpenHandler:fn=>this.openHandler=fn,
   executeJavaScript:async()=>{},
   insertCSS:async()=>{}
  };windows.push(this)}
  setMenu(){} on(event,fn){this.events[event]=fn}
  loadURL(url){this.url=url;return Promise.resolve()}
  show(){this.visible=true}hide(){this.visible=false}
  isVisible(){return this.visible}isDestroyed(){return false}
  getBounds(){return this.bounds}
  setIgnoreMouseEvents(ignore){this.ignored=ignore}
  setAlwaysOnTop(value){this.top=value}
  reload(){}
 }
 class FakeTray{setToolTip(value){this.tip=value}setContextMenu(value){this.menu=value}on(){}}
 const fakeFs={...fs,readFileSync:()=>{throw Error('no prior settings')},mkdirSync:()=>{},writeFileSync:()=>{}};
 const fakeElectron={app,BrowserWindow:FakeBrowserWindow,Menu:{buildFromTemplate:items=>{menus.push(items);return items}},Tray:FakeTray,nativeImage:{createFromBuffer:()=>({resize:()=>({})})},shell:{openExternal:()=>{}},screen:{getPrimaryDisplay:()=>({workArea:{x:0,y:0,width:1920,height:1080}}),getAllDisplays:()=>[{bounds:{x:0,y:0,width:1920,height:1080}}]},dialog:{showErrorBox:()=>{},showMessageBox:async()=>({response:1})}};
 const context={require:id=>id==='electron'?fakeElectron:id==='node:fs'?fakeFs:require(id),module:{},process:{argv,platform:'win32'},console,Buffer,URL,setTimeout,clearTimeout};
 vm.runInNewContext(source,context,{filename:'desktop/main.cjs',timeout:1500});
 return {windows,callbacks,menus};
}
test('desktop app starts in a transparent sandboxed window',async()=>{
 const h=harness();await Promise.resolve();await Promise.resolve();
 const w=h.windows[0];
 assert.ok(w);
 assert.equal(w.options.transparent,true);
 assert.equal(w.options.webPreferences.nodeIntegration,false);
 assert.equal(w.options.webPreferences.sandbox,true);
 assert.ok(w.url.includes('spine.html?desktop=1&id=c012'));
});
test('allowed scheme changes character without creating another window',async()=>{
 const h=harness();await Promise.resolve();await Promise.resolve();
 h.callbacks.get('second-instance')(null,['app.exe','animecharacter://open?id=c010']);
 assert.match(h.windows[0].url,/id=c010$/);
 assert.equal(h.windows.length,1);
});
test('external navigation is rejected',async()=>{
 const h=harness();await Promise.resolve();await Promise.resolve();
 const w=h.windows[0];let blocked=false;
 w.events['wc:will-navigate']({preventDefault(){blocked=true}},'https://tyqittle.github.io/anime-character-archive.evil/spine.html');
 assert.equal(blocked,true);
});
