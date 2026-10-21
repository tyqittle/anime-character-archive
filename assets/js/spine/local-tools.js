'use strict';
$('testUrls').onclick=async()=>{
 const c=chosen();if(!c){status('请先选择角色。',true);return}
 status('正在检查 '+c.name+' 的骨骼、图集和图集中的贴图…');
 const abort=new AbortController(), timer=setTimeout(()=>abort.abort(),12000);
 try{
  const roots=[c.base+'.skel',c.base+'.atlas'];
  const results=await Promise.all(roots.map(async url=>{try{
   const r=await fetch(url,{signal:abort.signal,cache:'no-store'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const value=url.endsWith('.atlas')?await r.text():null;
   return {file:url.split('/').pop(),ok:true,atlas:value};
  }catch(e){return {file:url.split('/').pop(),ok:false,error:e.name==='AbortError'?'12秒超时':e.message}}}));
  const atlas=results.find(r=>r.file.endsWith('.atlas'));
  if(atlas?.ok){
    const pages=[...new Set(atlas.atlas.split(/\r?\n/).map(x=>x.trim().replace(/^\uFEFF/,'')).filter(x=>/\.(png|jpg|jpeg|webp)$/i.test(x)))];
    const root=c.base.slice(0,c.base.lastIndexOf('/')+1);
    for(const page of pages.slice(0,8)){
      const url=root+page, controller=new AbortController(), t=setTimeout(()=>controller.abort(),8000);
      try{
       const r=await fetch(url,{method:'HEAD',signal:controller.signal});
       results.push({file:page,ok:r.ok||r.status===405,error:r.ok?'':('HTTP '+r.status)});
      }catch(e){results.push({file:page,ok:false,error:e.name==='AbortError'?'8秒超时':e.message})}
      finally{clearTimeout(t)}
    }
  }
  status('资源检测结果：\n'+results.map(r=>(r.ok?'✓ ':'✗ ')+r.file+(r.error?'：'+r.error:'：可访问')).join('\n')+'\n注意：检测通过不代表 Spine 版本或动画渲染一定成功。',results.some(r=>!r.ok));
 }catch(e){status('检测异常：'+e.message,true)}
 finally{clearTimeout(timer)}
}
$('characters').onchange=()=>{
 refreshCardSelection();rememberSelectedCharacter();
 const c=chosen();
 if(c){
  $('selectionNote').textContent='已选：'+(c.zh||c.name)+' · 正在自动播放';
  playCharacter(c);
 }else{
  cancelCharacterDownload();clearPlayer();
  $('title').textContent='动画预览';
  $('stageContext').textContent='Spine · 原生骨骼渲染';
  $('selectionNote').textContent='选择角色后将自动播放。';
  status('请选择角色，选中后将自动播放。');
 }
};
$('demo').onclick=()=>{
 cancelCharacterDownload();
 const version=$('version').value;
 const base='https://esotericsoftware.com/files/examples/'+version+'/spineboy/export/';
 show({skeleton:base+'spineboy-pro.skel',atlas:base+'spineboy-pma.atlas',animation:'walk'},'Spineboy 官方示例');
};
$('files').onchange=async e=>{
 chosenFileList=Array.from(e.target.files||[]);
 $('fileList').textContent=chosenFileList.length?chosenFileList.map(f=>f.name).join(' · '):'尚未选择文件。';
 const complete=chosenFileList.some(f=>/\.(skel|json)$/i.test(f.name))&&chosenFileList.some(f=>/\.atlas$/i.test(f.name));
 $('saveLocal').disabled=!complete;
 if(!complete)return;
 cancelCharacterDownload();
 try{status('正在读取本地动画素材…');await playPack(await preparePack(chosenFileList))}
 catch(err){status('本地动画无法播放：'+(err.message||String(err)),true)}
};
function toDataUri(file){return new Promise((resolve,reject)=>{const r=new FileReader;r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file)})}
function basename(s){return s.replace(/\\/g,'/').split('/').pop()}
function skeletonAndAtlas(files){const skeleton=files.find(f=>/\.(skel|json)$/i.test(f.name));const atlas=files.find(f=>/\.atlas$/i.test(f.name));if(!skeleton||!atlas)throw Error('请同时选择骨骼和 .atlas 文件');return {skeleton,atlas}}
async function preparePack(files){const {skeleton,atlas}=skeletonAndAtlas(files);const rawDataURIs={};for(const f of files){rawDataURIs[basename(f.name)]=await toDataUri(f)}const lines=(await atlas.text()).split(/\r?\n/).map(x=>x.trim().replace(/^\uFEFF/,''));const pages=lines.filter(x=>/\.(png|jpg|jpeg|webp)$/i.test(x));const missing=pages.filter(x=>!rawDataURIs[basename(x)]);if(missing.length)throw Error('缺少贴图文件：'+missing.join('、'));const atlasName=basename(atlas.name),skeletonName=basename(skeleton.name);
// The atlas BOM breaks some Spine parsers; rewrite the in-memory text without changing original files.
rawDataURIs[atlasName]='data:text/plain,'+(await atlas.text()).replace(/^\uFEFF/,'');
return {id:skeletonName,version:$('version').value,skeleton:skeletonName,atlas:atlasName,rawDataURIs}}
function playPack(pack){
 // Spine Downloader.dataUriToString returns the raw part after comma unchanged.
 // So text must be stored as unescaped Unicode: do not base64 or percent-encode.
 const atlasUri=pack.rawDataURIs?.[pack.atlas];
 if(atlasUri){
  const comma=atlasUri.indexOf(',');
  let contents=atlasUri.slice(comma+1);
  if(atlasUri.includes('base64,')){
   const binary=Uint8Array.from(atob(contents),c=>c.charCodeAt(0));
   contents=new TextDecoder('utf-8').decode(binary);
  }else if(/%0A|%0D|%[89A-F][0-9A-F]/i.test(contents)){
   try{contents=decodeURIComponent(contents)}catch(e){}
  }
  // 3.8 runs the data URI through XMLHttpRequest, whereas Spine 4.x reads it literally.
  const clean=contents.replace(/^\uFEFF/,'');
  pack.rawDataURIs[pack.atlas]=pack.version==='3.8'
    ?'data:text/plain;charset=utf-8,'+encodeURIComponent(clean)
    :'data:text/plain,'+clean;
 }
 setVersion(pack.version);
 const matching=allCharacters.find(c=>(c.gameId||'nikke')+'-'+c.id===pack.id);
 const title=matching?((matching.zh?matching.zh+' · ':'')+(matching.gameId==='browndust2'?(matching.costume||matching.name).replace(/_/g,' '):matching.name)):'动态角色 · '+pack.id;
 // Brown Dust 2 character atlases omit "pma: true": they carry straight-alpha
 // textures. Using Spine's PMA blend mode for these files produces bright
 // white seams at the hands, face and skin. Keep other sources unchanged.
 const brownDust2=String(pack.id||'').startsWith('browndust2-');
 const premultipliedAlpha=brownDust2?false:!String(pack.id||'').startsWith('bluearchive-');
 return show({skeleton:pack.skeleton,atlas:pack.atlas,rawDataURIs:pack.rawDataURIs,premultipliedAlpha},title)
}
$('saveLocal').onclick=async()=>{try{status('正在保存到浏览器本地缓存…');const pack=await preparePack(chosenFileList);await dbAction('readwrite',s=>s.put(pack));await refreshSaved();status('已保存 '+pack.id+'。以后可直接从“已保存的本地动画包”加载，无须重新选择素材文件。')}catch(e){status('保存失败：'+e.message,true)}};
$('savedPacks').onchange=async()=>{
 const id=$('savedPacks').value;
 $('deleteSaved').disabled=!id;
 if(!id)return;
 cancelCharacterDownload();
 try{status('正在读取已保存动画包…');const pack=await dbAction('readonly',s=>s.get(id));if(!pack)throw Error('素材包不存在');await playPack(pack)}
 catch(err){status('本地素材播放失败：'+(err.message||String(err)),true)}
};
$('deleteSaved').onclick=async()=>{const id=$('savedPacks').value;if(!id)return;if(!confirm('删除本机保存的动画素材包：'+id+'？'))return;try{await dbAction('readwrite',s=>s.delete(id));await refreshSaved();status('已删除本机动画素材包 '+id)}catch(e){status('删除失败：'+e.message,true)}};
$('version').onchange=()=>{
 const v=$('version').value;
 const url=new URL(location.href);
 url.searchParams.set('v',v);
 history.replaceState(null,'',url.pathname+url.search+url.hash);
 status('已选 Spine '+v+'；下一次播放将无刷新切换至对应引擎。');
};
