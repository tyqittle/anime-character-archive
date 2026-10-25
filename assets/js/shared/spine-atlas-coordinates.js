'use strict';
// Atlas pixel coordinates and decoded texture pixels can use different scales.
// Source adapters opt in explicitly; unmarked atlases keep native behavior.
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ArchiveSpineAtlasCoordinates=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 function parsePageSizes(text){
  const sizes=new Map();let page=null,header=false;
  for(const raw of String(text).replace(/^\uFEFF/,'').split(/\r\n|\r|\n/)){
   const line=raw.trim();
   if(!line){page=null;header=false;continue}
   if(page===null){page=line;header=true;continue}
   if(!header)continue;
   header=false;
   const match=/^size:\s*(\d+)\s*,\s*(\d+)\s*$/.exec(line);
   if(!match)continue;
   const width=Number(match[1]),height=Number(match[2]);
   if(!(width>0&&height>0))throw Error('Invalid declared atlas size: '+page);
   if(sizes.has(page))throw Error('Duplicate atlas page: '+page);
   sizes.set(page,{width,height});
  }
  return sizes;
 }
 function installMeshCoordinates(runtime){
  const proto=runtime?.MeshAttachment?.prototype;
  if(!proto?.updateUVs)throw Error('Atlas coordinate policy requires Spine 3.8 mesh UV support');
  if(proto.__archiveCoordinateSpace)return;
  const original=proto.updateUVs;
  proto.updateUVs=function(...args){
   const result=original.apply(this,args),region=this.region;
   const size=region?.page?._archiveCoordinateSize;
   if(!size||!(region instanceof runtime.TextureAtlasRegion))return result;
   const image=region.texture.getImage();
   // Native updateUVs uses decoded image dimensions for offsets and trim size.
   // Convert that displacement around the declared region origin, preserving
   // the native 0/90/180/270 rotation and linked-mesh trim formulas.
   for(let i=0;i<this.uvs.length;i+=2){
    this.uvs[i]=region.u+(this.uvs[i]-region.u)*image.width/size.width;
    this.uvs[i+1]=region.v+(this.uvs[i+1]-region.v)*image.height/size.height;
   }
   return result;
  };
  proto.__archiveCoordinateSpace=true;
 }
 function applyCoordinateSpace({atlas,atlasText,skeleton,runtime,mode}){
  if(!mode||mode==='texture')return {mode:'texture',changedPages:0,attachments:0};
  if(mode!=='declared')throw Error('Unknown atlas coordinate space: '+mode);
  const sizes=parsePageSizes(atlasText),pages=atlas?.pages,regions=atlas?.regions;
  if(!Array.isArray(pages)||!Array.isArray(regions))throw Error('Loaded atlas is unavailable');
  // Validate every page and region before changing anything.
  const plans=new Map();let changedPages=0;
  for(const page of pages){
   const size=sizes.get(page.name),image=page.texture?.getImage?.();
   if(!size||!(image?.width>0&&image?.height>0))throw Error('Atlas page dimensions unavailable: '+page.name);
   plans.set(page,size);
   if(size.width!==image.width||size.height!==image.height)changedPages++;
  }
  // Some source atlases include one trailing pixel of packed edge extrusion.
  // Preserve that border convention; larger out-of-page regions still fail.
  for(const region of regions){
   const size=plans.get(region.page),degrees=((Number(region.degrees)||0)%360+360)%360;
   if(!size||![0,90,180,270].includes(degrees))throw Error('Unsupported atlas region: '+region.name);
   const packedWidth=degrees%180?region.height:region.width;
   const packedHeight=degrees%180?region.width:region.height;
   if(![region.x,region.y,packedWidth,packedHeight].every(Number.isFinite)||
      region.x<0||region.y<0||packedWidth<0||packedHeight<0||
      region.x+packedWidth>size.width+1||region.y+packedHeight>size.height+1)
    throw Error('Region exceeds declared atlas page: '+region.name);
  }
  installMeshCoordinates(runtime);
  for(const [page,size] of plans)page._archiveCoordinateSize=size;
  for(const region of regions){
   const size=plans.get(region.page),rotated=((Number(region.degrees)||0)%180+180)%180!==0;
   region.u=region.x/size.width;region.v=region.y/size.height;
   region.u2=(region.x+(rotated?region.height:region.width))/size.width;
   region.v2=(region.y+(rotated?region.width:region.height))/size.height;
  }
  const attachments=new Set((skeleton?.slots||[]).map(slot=>slot.attachment).filter(Boolean));
  for(const skin of skeleton?.data?.skins||[])for(const item of skin.getAttachments())attachments.add(item.attachment);
  let mapped=0;
  for(const attachment of attachments){
   if(!attachment.region||!plans.has(attachment.region.page))continue;
   if(attachment instanceof runtime.MeshAttachment){attachment.updateUVs();mapped++}
   else if(attachment instanceof runtime.RegionAttachment){attachment.setRegion(attachment.region);mapped++}
  }
  return {mode,changedPages,attachments:mapped,pages:pages.map(page=>({name:page.name,coordinates:plans.get(page)}))};
 }
 function coalesceAtlasPages(source){
  const text=String(source).replace(/^\uFEFF/,'').replace(/\r+\n|\r/g,'\n'),lines=text.split('\n');
  const starts=lines.map((line,index)=>/\.(?:png|webp|jpe?g)$/i.test(line.trim())&&!line.includes(':')?index:-1).filter(index=>index>=0);
  const names=starts.map(index=>lines[index].trim());
  if(new Set(names).size===names.length)return {text,mergedPages:0};
  const pages=new Map();
  for(let n=0;n<starts.length;n++){
   const block=lines.slice(starts[n],starts[n+1]??lines.length).map(x=>x.trim()).filter(Boolean),name=block[0],header=[];let i=1;
   while(i<block.length&&block[i].includes(':'))header.push(block[i++]);
   if(!header.some(x=>x.startsWith('size:')))throw Error('Duplicate atlas page lacks size: '+name);
   let page=pages.get(name);
   if(page&&page.header.join('\n')!==header.join('\n'))throw Error('Conflicting duplicate atlas page: '+name);
   if(!page){page={header,regions:new Map()};pages.set(name,page)}
   while(i<block.length){
    const region=block[i++],properties=[];if(region.includes(':'))throw Error('Invalid atlas region: '+region);
    while(i<block.length&&block[i].includes(':'))properties.push(block[i++]);
    const value=properties.join('\n');
    if(page.regions.has(region)&&page.regions.get(region)!==value)throw Error('Conflicting duplicate atlas region: '+region);
    page.regions.set(region,value);
   }
  }
  const result=[...pages].map(([name,page])=>[name,...page.header,...[...page.regions].flatMap(([region,value])=>[region,...value.split('\n').map(x=>'  '+x)])].join('\n')).join('\n\n');
  return {text:'\n'+result+'\n',mergedPages:starts.length-pages.size};
 }
 return Object.freeze({parsePageSizes,applyCoordinateSpace,coalesceAtlasPages});
});
