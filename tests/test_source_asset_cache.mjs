import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {warmSourceCache} from '../scripts/source_asset_cache.mjs';
test('renderer fixtures require original-byte hashes and production-origin CORS before they can be reused',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'source-cache-'));
 const bytes=Buffer.from('original source'),sha=createHash('sha256').update(bytes).digest('hex');
 const c={id:'test',skeletonUrl:'https://source.test/model.json',atlasUrl:'https://source.test/model.atlas',textures:[],resourceIntegrity:[{path:'model.json',sha256:sha},{path:'model.atlas',sha256:sha}]};
 const index=path.join(root,'index.json');let calls=0;
 const fetcher=async(_url,options)=>{calls++;assert.equal(options.headers.Origin,'https://tyqittle.github.io');return new Response(bytes,{headers:{'Access-Control-Allow-Origin':'*'}})};
 try{
  await warmSourceCache([c],index,{fetcher});assert.equal(calls,2);
  await warmSourceCache([c],index,{fetcher:()=>{throw Error('must reuse validated bytes')}});
  fs.writeFileSync(path.join(root,'cache',sha),'corrupted');
  await assert.rejects(warmSourceCache([c],index,{fetcher:async()=>new Response('different',{headers:{'Access-Control-Allow-Origin':'*'}})}),/bytes changed/);
  await assert.rejects(warmSourceCache([c],index,{fetcher:async()=>new Response(bytes)}),/production origin/);
  await assert.rejects(warmSourceCache([{...c,resourceIntegrity:[]}],index,{fetcher}),/byte lock/);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
