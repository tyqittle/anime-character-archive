import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function rendererIdentity(root=process.cwd()){
 const files=['spine.html'];
 function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())walk(p);else if(/\.(js|css)$/.test(p))files.push(p)}}
 walk('assets/js');
 for(const e of fs.readdirSync(path.join(root,'assets')))if(e.endsWith('.css'))files.push('assets/'+e);
 return sha256(Buffer.concat(files.sort().flatMap(p=>[Buffer.from(p+'\0'),fs.readFileSync(path.join(root,p))])));
}
export function reusableCapture(record,character,identity,renderer,frame){
 return !!record&&record.rendererIdentity===renderer&&JSON.stringify(record.sourceIdentity)===JSON.stringify(identity)&&record.id===character.id&&fs.existsSync(frame)&&record.frameSha256===sha256(fs.readFileSync(frame));
}
export function saveCaptureReport(file,value){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2));fs.renameSync(tmp,file);
}
