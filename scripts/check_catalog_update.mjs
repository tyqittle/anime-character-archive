// CI entry: compare with the actual push/PR base, including multi-commit pushes.
import {execFileSync} from 'node:child_process';
import {main} from './catalog_compatibility.mjs';
const ref=process.env.CATALOG_BASE_REF||'HEAD^';
if(!/^(?:[a-f0-9]{40}|HEAD\^)$/.test(ref)||/^0+$/.test(ref))throw Error('Invalid catalog base commit');
try{execFileSync('git',['cat-file','-e',ref+'^{commit}'],{stdio:'ignore'})}
catch(error){
 if(ref==='HEAD^')throw error;
 execFileSync('git',['fetch','--no-tags','--depth=1','origin',ref],{stdio:'inherit'});
}
main(['--base-ref',ref,'--changes','data/catalog-compatibility-changes.json','--verify-previews','--output','tmp/catalog-compatibility.json']);
