// Compare decoded RGBA frames. Both samples must contain rendered content:
// a blank-to-first-paint transition is not proof of character animation.
export function compareRenderedFrames(first,second){
 if(first.width!==second.width||first.height!==second.height)return {visible:0,moving:0};
 const backgrounds=[first,second].map(frame=>Array.from(frame.data.slice(0,3)));
 const visible=[0,0];let moving=0;
 for(let i=0;i<first.data.length;i+=4){
  for(let sample=0;sample<2;sample++){
   const frame=sample===0?first:second,bg=backgrounds[sample];
   const distance=Math.abs(frame.data[i]-bg[0])+Math.abs(frame.data[i+1]-bg[1])+Math.abs(frame.data[i+2]-bg[2]);
   if(distance>100)visible[sample]++;
  }
  const change=Math.abs(first.data[i]-second.data[i])+Math.abs(first.data[i+1]-second.data[i+1])+Math.abs(first.data[i+2]-second.data[i+2]);
  if(change>45)moving++;
 }
 return {visible:Math.min(...visible),moving};
}
