import {createHash} from 'node:crypto';

// Accept only JSON plus comments/trailing commas, never executable JavaScript.
export function parseSourceSettings(text,allowJSONC=false,repairLegacyMotionCommas=false){
 text=text.replace(/^\uFEFF/,'');
 if(!allowJSONC)return JSON.parse(text);
 let stripped='',quoted=false,escaped=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){stripped+=ch;if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue}
  if(ch==='"'){quoted=true;stripped+=ch;continue}
  if(ch==='/'&&text[i+1]==='/'){while(i<text.length&&text[i]!=='\n')i++;stripped+='\n';continue}
  if(ch==='/'&&text[i+1]==='*'){
   const end=text.indexOf('*/',i+2);if(end<0)throw Error('Unterminated settings comment');
   stripped+=' ';i=end+1;continue;
  }
  stripped+=ch;
 }
 let normalized='';quoted=false;escaped=false;
 for(let i=0;i<stripped.length;i++){
  const ch=stripped[i];
  if(quoted){normalized+=ch;if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue}
  if(ch==='"'){quoted=true;normalized+=ch;continue}
  if(ch===','){let next=i+1;while(/\s/.test(stripped[next]||'')&&next<stripped.length)next++;if(/[}\]]/.test(stripped[next]||''))continue}
  normalized+=ch;
 }
 // A few pinned Kagura Cubism2 exports omit the comma between the numeric
 // fade_out value and the next lip_* key. Scope-level opt-in only: do not
 // silently repair other malformed JSON or non-motion properties.
 if(repairLegacyMotionCommas)
  normalized=normalized.replace(/("fade_out"\s*:\s*-?\d+(?:\.\d+)?)(\s+)("(?:lip_offset|lip_weight|lip_id|lip_scale)"\s*:)/g,'$1,$2$3');
 return JSON.parse(normalized);
}

export function normalizedCubism2Settings(settings,fileURL,id,directory){
 if(!/^assets\/model-settings\/[a-z0-9-]+$/.test(directory)||!/^[-a-z0-9_]+$/.test(id))throw Error('Invalid normalized settings destination');
 const notes=[];
 const out={model:fileURL(settings.model),textures:settings.textures.map(fileURL),motions:{}};
 for(const [group,motions] of Object.entries(settings.motions||{}))out.motions[group]=motions.map(motion=>{
  const result={...motion,file:fileURL(motion.file||motion.File)};delete result.File;
  if(result.sound){try{result.sound=fileURL(result.sound)}catch(error){notes.push({file:result.sound,error:error.message});delete result.sound}}
  return result;
 });
 for(const key of ['physics','pose'])if(settings[key])out[key]=fileURL(settings[key]);
 if(settings.expressions)out.expressions=settings.expressions.map(entry=>({...entry,file:fileURL(entry.file||entry.File)}));
 if(settings.hit_areas)out.hit_areas=settings.hit_areas;
 const body=JSON.stringify(out,null,2)+'\n',sha256=createHash('sha256').update(body).digest('hex');
 const path=directory+'/'+id+'.model.json';
 return {path,body,sha256,notes,url:'./'+path+'?v='+sha256};
}

/**
 * Compose source-pinned Cubism3 model/motions with an audited original texture.
 * Some upstream game exports split a motion-only manifest (Textures: []) from
 * its art. Never guess textures at runtime or accept arbitrary new sources.
 */
export function normalizedCubism3Settings(settings,fileURL,id,directory){
 if(!/^assets\/model-settings\/[a-z0-9-]+$/.test(directory)||!/^[-a-z0-9_]+$/.test(id))throw Error('Invalid normalized Cubism3 settings destination');
 if(settings.Version!==3||!settings.FileReferences?.Moc||!Array.isArray(settings.FileReferences.Textures)||settings.FileReferences.Textures.length!==1)
  throw Error('Incomplete composed Cubism3 settings');
 const refs=settings.FileReferences;
 const motions={};
 for(const [group,items] of Object.entries(refs.Motions||{})){
  if(!Array.isArray(items))throw Error('Invalid Cubism3 motion group');
  motions[group]=items.map(item=>({...item,File:fileURL(item.File)}));
 }
 if(!Object.values(motions).some(items=>items.length))throw Error('Character has no playable motions');
 const mapped={...refs,Moc:fileURL(refs.Moc),Textures:refs.Textures.map(fileURL),Motions:motions};
 for(const optional of ['Physics','Pose','DisplayInfo','UserData'])if(mapped[optional])mapped[optional]=fileURL(mapped[optional]);
 if(Array.isArray(mapped.Expressions))mapped.Expressions=mapped.Expressions.map(item=>({...item,File:fileURL(item.File)}));
 const out={...settings,FileReferences:mapped};
 const body=JSON.stringify(out,null,2)+'\n';
 const sha256=createHash('sha256').update(body).digest('hex');
 const filename=directory+'/'+id+'.model3.json';
 return {path:filename,body,sha256,notes:['Audited split Cubism3 settings, textures and source animations'],url:'./'+filename+'?v='+sha256};
}
