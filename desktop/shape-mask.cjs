'use strict';
// Windows compositor fallback: convert a small BGRA screenshot of the rendered
// character into a native window region. It eliminates the white backplate
// even on systems whose Electron transparent window has opaque backing pixels.
function shapeFromBGRA(bitmap,width,height,cssWidth,cssHeight){
 if(!Buffer.isBuffer(bitmap)||width<12||height<12||bitmap.length<width*height*4)return null;
 const cornerPoints=[[2,2],[width-3,2],[2,height-3],[width-3,height-3]];
 const corners=cornerPoints.map(([x,y])=>{
  const p=(y*width+x)*4;
  return [bitmap[p+2],bitmap[p+1],bitmap[p],bitmap[p+3]];
 });
 // The page backdrop is uniform in the failing Windows 10 configuration.
 // Median corner RGB ignores a corner occupied by a moving arm/character.
 const median=i=>corners.map(p=>p[i]).sort((a,b)=>a-b)[1];
 const background=[median(0),median(1),median(2),median(3)];
 const mask=new Uint8Array(width*height);
 let pixels=0,valid=0;
 for(let y=0;y<height;y++){
  for(let x=0;x<width;x++){
   const p=(y*width+x)*4,a=bitmap[p+3],r=bitmap[p+2],g=bitmap[p+1],b=bitmap[p];
   if(a<16)continue;
   valid++;
   const changed=Math.max(Math.abs(r-background[0]),Math.abs(g-background[1]),Math.abs(b-background[2]));
   // Tolerate JPG/video compression, antialiasing and near-white costumes.
   if(changed<28 && (a>=background[3]-20))continue;
   mask[y*width+x]=1;pixels++;
  }
 }
 // No character or solid filled framebuffer: NEVER reveal an opaque desktop
 // overlay. A real character occupies much less than half the monitor.
 if(pixels<12||pixels>width*height*.48)return null;
 const xScale=cssWidth/width,yScale=cssHeight/height;
 const rows=[];
 for(let y=0;y<height;y++){
  const intervals=[];let start=-1,last=-1;
  for(let x=0;x<width;x++){
   if(mask[y*width+x]){
    if(start<0){start=x;last=x}
    else if(x-last<=5)last=x; // fill narrow white interior gaps
    else{intervals.push([start,last]);start=last=x}
   }
  }
  if(start>=0)intervals.push([start,last]);
  rows.push(intervals);
 }
 const rects=[],active=new Map();
 // 1 cell safety dilation compensates for moving hair and animation frames.
 for(let y=0;y<height;y++){
  const pieces=[...(rows[y-1]||[]),...rows[y],...(rows[y+1]||[])].map(([a,b])=>[Math.max(0,a-1),Math.min(width-1,b+1)]).sort((a,b)=>a[0]-b[0]);
  const runs=[];
  for(const [a,b] of pieces){
   if(runs.length&&a<=runs[runs.length-1][1]+1)runs[runs.length-1][1]=Math.max(b,runs[runs.length-1][1]);
   else runs.push([a,b]);
  }
  const current=new Map();
  for(const [a,b] of runs){
   const xx=Math.floor(a*xScale),right=Math.ceil((b+1)*xScale),yy=Math.floor(y*yScale),bottom=Math.ceil((y+1)*yScale);
   const key=xx+':'+right;
   let rect=active.get(key);
   if(rect&&rect.y+rect.height>=yy){rect.height=bottom-rect.y}
   else{rect={x:xx,y:yy,width:Math.max(1,right-xx),height:Math.max(1,bottom-yy)};rects.push(rect)}
   current.set(key,rect);
  }
  active.clear();
  for(const [key,rect] of current)active.set(key,rect);
 }
 // Excessive region complexity can choke DWM. Prefer no change over a
 // potentially unusable window shape; callers can use a coarser sample.
 if(rects.length>1200)return null;
 return {rects,foregroundPixels:pixels,coverage:pixels/(width*height),background};
}
module.exports={shapeFromBGRA};
