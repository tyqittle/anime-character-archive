(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ArchivePortraitInteractions=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const normalize=value=>String(value||'').replace(/([a-z])([A-Z])/g,'$1_$2').toLowerCase()
  .replace(/\.motion3?\.json$|\.mtn$|\.anim$/g,'').replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g,'_').replace(/^_|_$/g,'');
 function kind(value){
  const text=normalize(value);
  if(/head|face|头|頭|顔/.test(text))return 'head';
  if(/special|sensitive|特殊/.test(text))return 'special';
  if(/body|chest|bust|身|体|體|胸/.test(text))return 'body';
  return '';
 }
 const reaction=value=>/(?:^|_)(?:touch\d*|tap\d*|click|poke|pat|reaction|interact|hit)(?:_|$)|触摸|觸摸|点击|點擊|タッチ|なで|撫で|摸|戳/.test(normalize(value));
 function plan({entries=[],areas=[]}={}){
  const candidates=entries.map(entry=>{
   const file=entry.definition?.File||entry.definition?.file||'';
   const labels=[entry.group,entry.label,file.split('/').pop(),entry.key].filter(Boolean).map(normalize);
   return {...entry,labels,kind:kind(labels.join('_')),reaction:labels.some(reaction)};
  });
  const sourceAreas=[...new Set(areas.filter(x=>typeof x==='string'&&x))],cycles=new Map();
  function matches(area){
   const normalized=normalize(area),category=kind(area);
   const exact=candidates.filter(x=>x.labels.includes(normalized));
   if(exact.length)return exact;
   return candidates.filter(x=>x.reaction&&(category?x.kind===category:!x.kind));
  }
  const mapped=sourceAreas.filter(area=>matches(area).length);
  const fallback=candidates.filter(x=>x.reaction&&x.kind!=='special');
  const mode=mapped.length?'source':!sourceAreas.length&&fallback.length?'estimated':'none';
  const description=mode==='source'?'点击交互：源模型区域（'+mapped.length+' 处）':
   mode==='estimated'?'点击交互：按画面分区触发（位置为估算）':
   sourceAreas.length?'模型含点击区域，但没有对应互动动作':'模型仅含动画，源资源暂无点击互动动作';
  function resolve({hits=[],point,bounds}={}){
   let list=[],area='';
   if(sourceAreas.length){
    const priority=area=>({head:3,special:2,body:1}[kind(area)]||0);
    for(const hit of [...hits].sort((a,b)=>priority(b)-priority(a))){
     const found=matches(hit);if(found.length){list=found;area=hit;break}
    }
   }else if(point&&bounds&&bounds.width>0&&bounds.height>0&&
    point.x>=bounds.x&&point.x<=bounds.x+bounds.width&&point.y>=bounds.y&&point.y<=bounds.y+bounds.height){
    const y=point.yDown===false?(bounds.y+bounds.height-point.y)/bounds.height:(point.y-bounds.y)/bounds.height;
    area=y<.35?'head':'body';
    list=fallback.filter(x=>x.kind===area);
    if(!list.length)list=fallback.filter(x=>!x.kind);
   }
   if(!list.length)return null;
   const index=cycles.get(area)||0;cycles.set(area,index+1);
   return {entry:list[index%list.length],area,mode};
  }
  return {mode,description,sourceAreas,mappedAreas:mapped,resolve};
 }
 function isTap(start,end,{threshold=8,generation}={}){
  return !!start&&start.id===end.pointerId&&!start.moved&&!start.multiple&&
   (generation===undefined||start.generation===generation)&&
   Math.hypot(end.clientX-start.x,end.clientY-start.y)<=threshold;
 }
 return Object.freeze({normalize,kind,plan,isTap});
});
