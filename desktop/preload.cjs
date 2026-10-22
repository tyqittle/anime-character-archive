'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Expose only bounded movement, never arbitrary IPC or filesystem access.
contextBridge.exposeInMainWorld('desktopHost',Object.freeze({
 move:(x,y)=>{
  if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>150||Math.abs(y)>150)return;
  ipcRenderer.send('desktop:move',{x,y});
 }
}));
