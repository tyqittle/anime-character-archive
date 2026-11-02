import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveBrowserOptions,validateArchiveRenderer,launchArchiveBrowser} from '../scripts/archive_browser.mjs';
const env={CHROME_BIN:process.execPath}; // An existing path; mocked launch never executes it.
const hardware={renderer:'ANGLE (NVIDIA, NVIDIA GeForce, Direct3D11)',vendor:'Google Inc. (NVIDIA)'};

test('local launch does not force software rendering; CI and explicit software opt in',()=>{
 const local=archiveBrowserOptions(env);assert.equal(local.mode,'hardware');
 assert.equal(local.launch.args.some(a=>/swiftshader/.test(a)),false);
 assert.equal(local.launch.timeout,20000);
 assert.equal(archiveBrowserOptions({...env,CI:'true'}).launch.timeout,45000);
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


test('CI retries one browser launch timeout, then validates the real renderer',async()=>{
 let launches=0,pagesClosed=0;const logs=[];
 const browser={
  newPage:async()=>({evaluate:async()=>({renderer:'ANGLE (SwiftShader Device)',vendor:'Google Inc.'}),close:async()=>pagesClosed++}),
  close:async()=>{}
 };
 const chromium={launch:async()=>{
  launches++;
  if(launches===1)throw Error('browserType.launch: Timeout 45000ms exceeded.');
  return browser;
 }};
 assert.equal(await launchArchiveBrowser(chromium,{env:{...env,CI:'true'},log:(...args)=>logs.push(args)}),browser);
 assert.equal(launches,2);
 assert.equal(pagesClosed,1);
 assert.equal(logs.filter(([name])=>name==='ARCHIVE_BROWSER_LAUNCH_RETRY').length,1);
});

test('local launch timeouts and CI non-timeout errors are not retried',async()=>{
 for(const [ci,message] of [[false,'browserType.launch: Timeout 20000ms exceeded.'],[true,'Executable does not exist']]){
  let launches=0;
  await assert.rejects(()=>launchArchiveBrowser({launch:async()=>{launches++;throw Error(message)}},{env:{...env,...(ci?{CI:'true'}:{})},log:()=>{}}),new RegExp(message.split(':')[0]));
  assert.equal(launches,1);
 }
});

test('repeated CI browser launch timeouts stop after the second attempt',async()=>{
 let launches=0;
 await assert.rejects(()=>launchArchiveBrowser({launch:async()=>{launches++;throw Error('browserType.launch: Timeout 45000ms exceeded.')}},{env:{...env,CI:'true'},log:()=>{}}),/Timeout/);
 assert.equal(launches,2);
});
