import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sha256,reusableCapture,saveCaptureReport} from '../scripts/preview_capture_state.mjs';
import {parseOptions,serveWorkspace} from '../scripts/maintain_animation_catalog.mjs';
test('interrupted captures resume only for the same source, renderer and frame bytes',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'preview-resume-'));
 try{
  const frame=path.join(root,'frame.png');fs.writeFileSync(frame,'original frame');
  const c={id:'test'},identity=['source-v1'];
  const p={id:c.id,sourceIdentity:identity,rendererIdentity:'r1',frameSha256:sha256(fs.readFileSync(frame))};
  const file=path.join(root,'reports','shard-0.json');saveCaptureReport(file,{pass:[p],fail:[]});
  const saved=JSON.parse(fs.readFileSync(file)).pass[0];
  assert.ok(reusableCapture(saved,c,identity,'r1',frame));
  assert.equal(reusableCapture(saved,c,['source-v2'],'r1',frame),false);
  assert.equal(reusableCapture(saved,c,identity,'r2',frame),false);
  fs.writeFileSync(frame,'changed frame');assert.equal(reusableCapture(saved,c,identity,'r1',frame),false);
  assert.equal(reusableCapture(null,c,identity,'r1',frame),false);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('maintenance validates catalog arguments and owns a confined buffered server',async()=>{
 assert.throws(()=>parseOptions(['--catalog','../outside']));assert.throws(()=>parseOptions(['--catalog','test','--jobs','0']));
 assert.deepEqual(parseOptions(['--catalog','test','--recapture','a','--recapture','b']).recapture,['a','b']);
 assert.throws(()=>parseOptions(['--catalog','test','--recapture']));
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'preview-server-'));let server;
 try{
  fs.writeFileSync(path.join(root,'index.html'),'<p>sample</p>');server=await serveWorkspace(root);
  assert.equal(await (await fetch(server.base)).text(),'<p>sample</p>');
  // A completed/aborted response must leave the catalog replaceable on Windows.
  fs.renameSync(path.join(root,'index.html'),path.join(root,'renamed.html'));
  assert.equal((await fetch(server.base+'/%2e%2e%2foutside')).status,403);
 }finally{await server?.close();fs.rmSync(root,{recursive:true,force:true})}
});
