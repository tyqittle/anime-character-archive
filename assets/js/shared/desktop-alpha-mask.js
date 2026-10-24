'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArchiveDesktopAlphaMask=api})(typeof globalThis==='object'?globalThis:this,function(){
 function runs(pixels,width,height,threshold=1,allowed=null){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>320*320||pixels?.length!==width*height*4)throw Error('Invalid desktop input mask');
  const result=[];let prior=new Map();
  for(let y=0;y<height;y++){
   const intervals=allowed?allowed.filter(r=>r.length===4&&r.every(Number.isFinite)&&y>=r[1]&&y<r[1]+r[3]):null;
   const next=new Map();let start=-1;
   for(let x=0;x<=width;x++){
    const visible=x<width&&pixels[(y*width+x)*4+3]>=threshold&&
     (!intervals||intervals.some(r=>x>=r[0]&&x<r[0]+r[2]));
    if(visible&&start<0)start=x;
    if(!visible&&start>=0){
     const key=start+':'+x,previous=prior.get(key);
     const rect=previous||[start,y,x-start,0];
     rect[3]++;
     if(!previous)result.push(rect);
     next.set(key,rect);start=-1;
    }
   }
   prior=next;
  }
  return result;
 }
 return Object.freeze({runs});
});
