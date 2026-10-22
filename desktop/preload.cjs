'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Desktop web content is remote. Expose one boolean, not generic IPC.
contextBridge.exposeInMainWorld('desktopHost',Object.freeze({
 setInteractive:(active)=>{
  if(typeof active!=='boolean')return;
  ipcRenderer.send('desktop:set-interactive',active);
 }
}));
