import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveBrowserOptions,validateArchiveRenderer,launchArchiveBrowser} from '../scripts/archive_browser.mjs';
const env={CHROME_BIN:process.execPath}; // An existing path; mocked launch never executes it.
const hardware={renderer:'ANGLE (NVIDIA, NVIDIA GeForce, Direct3D11)',vendor:'Google Inc. (NVIDIA)'};

test('local launch does not force software rendering; CI and explicit software opt in',()=>{
 const local=archiveBrowserOptions(env);assert.equal(local.mode,'hardware');
 assert.equal(local.launch.args.some(a=>/swiftshader/.test(a)),false);
 assert.ok(archiveBrowserOptions({...env,CI:'true'}).launch.args.includes('--use-angle=swiftshader'));
 assert.equal(archiveBrowserOptions({...env,CI:'true',ARCHIVE_BROWSER_RENDERER:'hardware'}).mode,'hardware');
 assert.equal(archiveBrowserOptions({...env,ARCHIVE_BROWSER_RENDERER:'software'}).mode,'software');
 assert.throws(()=>archiveBrowserOptions({...env,ARCHIVE_BROWSER_RENDERER:'unknown'}),/must be/);
});

test('hardware policy fails closed for missing or CPU renderers',()=>{
 assert.equal(validateArchiveRenderer(hardware,'hardware').software,false);
 for(const renderer of ['ANGLE (SwiftShader Device)','llvmpipe (LLVM)','Microsoft Basic Render Driver','Mesa softpipe']){
  assert.throws(()=>validateArchiveRenderer({renderer},'hardware'),/CPU WebGL renderer detected/);
  assert.equal(validateArchiveRenderer({renderer},'software').software,true);
 }
 assert.throws(()=>validateArchiveRenderer(null,'hardware'),/could not be verified/);
 assert.throws(()=>validateArchiveRenderer({renderer:null},'software'),/could not be verified/);
});

test('renderer probe closes its page and rejects unsupported local rendering before callers load models',async()=>{
 for(const info of [hardware,{renderer:'SwiftShader'},null]){
  let pagesClosed=0,browsersClosed=0;
  const browser={newPage:async()=>({evaluate:async()=>info,close:async()=>pagesClosed++}),close:async()=>browsersClosed++};
  const chromium={launch:async()=>browser},options={env,log:()=>{}};
  if(info===hardware){assert.equal(await launchArchiveBrowser(chromium,options),browser);assert.equal(browsersClosed,0)}
  else{await assert.rejects(()=>launchArchiveBrowser(chromium,options));assert.equal(browsersClosed,1)}
  assert.equal(pagesClosed,1);
 }
});
