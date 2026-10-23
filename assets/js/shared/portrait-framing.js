(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ArchivePortraitFraming=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function validBounds(b){return !!b&&['x','y','width','height'].every(k=>Number.isFinite(b[k]))&&b.width>0&&b.height>0}
 // Work on a small rendered image once at load/reset, never on every frame.
 // Discard isolated specks while retaining disconnected costume decorations.
 function visibleBounds({pixels,width,height,background=null,tolerance=20}){
  if(!pixels||!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||pixels.length<width*height*4)return null;
  const count=width*height,mask=new Uint8Array(count),queue=new Int32Array(count),parts=[];
  for(let i=0;i<count;i++){
   const p=i*4;
   mask[i]=pixels[p+3]>24&&(!background||Math.max(Math.abs(pixels[p]-background[0]),Math.abs(pixels[p+1]-background[1]),Math.abs(pixels[p+2]-background[2]))>tolerance)?1:0;
  }
  for(let i=0;i<count;i++){
   if(!mask[i])continue;
   let head=0,tail=1,left=width,top=height,right=0,bottom=0;queue[0]=i;mask[i]=0;
   while(head<tail){
    const at=queue[head++],x=at%width,y=Math.floor(at/width);
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    const visit=n=>{if(mask[n]){mask[n]=0;queue[tail++]=n}};
    if(x>0)visit(at-1);if(x+1<width)visit(at+1);
    if(y>0)visit(at-width);if(y+1<height)visit(at+width);
   }
   parts.push({x:left,y:top,width:right-left+1,height:bottom-top+1,area:tail});
  }
  const largest=parts.reduce((n,p)=>Math.max(n,p.area),0);
  if(largest<4)return null;
  const kept=parts.filter(p=>p.area>=Math.max(3,largest*.002));
  const x=Math.min(...kept.map(p=>p.x)),y=Math.min(...kept.map(p=>p.y));
  return {x,y,width:Math.max(...kept.map(p=>p.x+p.width))-x,height:Math.max(...kept.map(p=>p.y+p.height))-y};
 }
 function cameraFrame({bounds,width,height,zoom=1,offsetX=0,offsetY=0}){
  if(!validBounds(bounds)||!(width>0&&height>0&&zoom>0))return null;
  const units=Math.max(bounds.width/(width*.9),bounds.height/(height*.88))/zoom;
  return {x:bounds.x+bounds.width/2-offsetX*units,y:bounds.y+bounds.height/2+offsetY*units,
   worldWidth:width*units,worldHeight:height*units};
 }
 function pixelsToWorld(bounds,width,height,frame){
  if(!validBounds(bounds)||!frame||!(width>0&&height>0))return null;
  return {x:frame.x-frame.worldWidth/2+bounds.x/width*frame.worldWidth,
   y:frame.y+frame.worldHeight/2-(bounds.y+bounds.height)/height*frame.worldHeight,
   width:bounds.width/width*frame.worldWidth,height:bounds.height/height*frame.worldHeight};
 }
 function unionTransformedBounds(rects,m={a:1,b:0,c:0,d:1,tx:0,ty:0}){
  m=m||{a:1,b:0,c:0,d:1,tx:0,ty:0};
  const matrix=['a','b','c','d','tx','ty'].map(k=>Number(m[k]));
  if(!matrix.every(Number.isFinite))return null;
  const [a,b,c,d,tx,ty]=matrix;let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const r of rects||[]){
   if(!validBounds(r))continue;
   for(const [x,y] of [[r.x,r.y],[r.x+r.width,r.y],[r.x,r.y+r.height],[r.x+r.width,r.y+r.height]]){
    const X=x*a+y*c+tx,Y=x*b+y*d+ty;
    left=Math.min(left,X);top=Math.min(top,Y);right=Math.max(right,X);bottom=Math.max(bottom,Y);
   }
  }
  const result={x:left,y:top,width:right-left,height:bottom-top};
  return validBounds(result)?result:null;
 }
 return {validBounds,visibleBounds,cameraFrame,pixelsToWorld,unionTransformedBounds};
});
