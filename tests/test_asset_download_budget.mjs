import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const code=fs.readFileSync(new URL('../assets/js/shared/asset-sources.js',import.meta.url),'utf8');
test('large transfers honor explicit budgets through body completion while legacy requests keep their limit',async()=>{
 let lastDelay,active=new Map(),serial=0;
 const ctx=vm.createContext({URL,AbortController,fetch:async()=>({ok:true,blob:async()=>new Blob(['source'])}),
  setTimeout(fn,ms){lastDelay=ms;active.set(++serial,fn);return serial},clearTimeout(id){active.delete(id)}});ctx.window=ctx;vm.runInContext(code,ctx);
 await ctx.ArchiveAssets.blob('https://source.test/file',90000);assert.equal(lastDelay,12000);assert.equal(active.size,0);
 await ctx.ArchiveAssets.blob('https://source.test/file',90000,undefined,{providerTimeoutMs:90000});assert.equal(lastDelay,90000);assert.equal(active.size,0);
 const controller=new AbortController();
 ctx.fetch=async(_url,{signal})=>({ok:true,blob:()=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('cancelled'),{name:'AbortError'}))))});
 const pending=ctx.ArchiveAssets.blob('https://source.test/file',90000,controller.signal,{providerTimeoutMs:90000});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(active.size,1);controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(active.size,0);
});
