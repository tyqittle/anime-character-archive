'use strict';
// Keep at most two recent decoded Spine packs in RAM. Disk cache is still the
// persistent source; this skips large IndexedDB structured clones on switch-back.
// The budget is measured conservatively as UTF-16 string bytes.
const hotPackLimit=48*1024*1024, hotPackCount=2;
const hotSpinePacks=new Map();
let hotPackBytes=0;
function hotPackWeight(pack){
 if(!pack?.rawDataURIs)return 0;
 let size=0;
 for(const item of Object.values(pack.rawDataURIs)){
  if(typeof item!=='string')return 0;
  size+=item.length*2;
  if(size>hotPackLimit)return size;
 }
 return size;
}
function rememberSpinePack(pack){
 if(!pack?.id||!pack.headerChecked)return;
 const bytes=hotPackWeight(pack);
 if(hotSpinePacks.has(pack.id)){
  hotPackBytes-=hotSpinePacks.get(pack.id).bytes;
  hotSpinePacks.delete(pack.id);
 }
 if(!bytes||bytes>hotPackLimit)return;
 hotSpinePacks.set(pack.id,{pack,bytes});
 hotPackBytes+=bytes;
 while(hotSpinePacks.size>hotPackCount||hotPackBytes>hotPackLimit){
  const oldest=hotSpinePacks.keys().next().value;
  hotPackBytes-=hotSpinePacks.get(oldest).bytes;
  hotSpinePacks.delete(oldest);
 }
}
function recentSpinePack(id){
 const entry=hotSpinePacks.get(id);
 if(!entry)return null;
 hotSpinePacks.delete(id);
 hotSpinePacks.set(id,entry);
 return entry.pack;
}

function forgetSpinePack(id){
 const entry=hotSpinePacks.get(id);
 if(!entry)return;
 hotPackBytes-=entry.bytes;
 hotSpinePacks.delete(id);
}
