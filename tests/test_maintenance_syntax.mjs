import test from 'node:test';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../scripts/',import.meta.url);
for(const name of fs.readdirSync(root).filter(name=>/\.(?:mjs|cjs)$/.test(name))){
 test('maintenance entry parses without import or download side effects: '+name,()=>{
  execFileSync(process.execPath,['--check',fileURLToPath(new URL(name,root))],{stdio:'pipe'});
 });
}
