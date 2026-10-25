import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readCatalogRegistry,readCharacters,sourceIdentity} from '../scripts/catalog_registry.mjs';
const require=createRequire(import.meta.url);
const {validate,load}=require('../assets/js/shared/catalog-registry.js');
test('one registry serves every catalog and all model ids are unique',()=>{
 const entries=readCatalogRegistry();assert.ok(entries.length>=8);
 assert.equal(new Set(entries.map(e=>e.path)).size,entries.length);
 assert.ok(readCharacters().length>2000);
});
test('registry rejects duplicate IDs, remote URLs and path traversal',()=>{
 const entry={id:'demo',name:'Demo',path:'data/demo.json'};
 for(const entries of [[entry,entry],[{...entry,path:'https://example.test/data.json'}],[{...entry,path:'data/../secrets.json'}]]){
  assert.throws(()=>validate({schemaVersion:1,catalogs:entries}));
 }
});
test('browser fetch revalidates the same registry and reports HTTP errors',async()=>{
 let options;
 const entries=await load(async(url,opts)=>{assert.equal(url,'./data/animation-catalogs.json');options=opts;return {ok:true,json:async()=>({schemaVersion:1,catalogs:[{id:'demo',name:'Demo',path:'data/demo.json'}]})}});
 assert.equal(options.cache,'no-cache');assert.equal(entries[0].url,'./data/demo.json');
 await assert.rejects(load(async()=>({ok:false,status:503})),/503/);
});
test('preview source identity changes when the actual model source changes',()=>{
 const c={engine:'cubism',modelUrl:'https://example.test/ref1/demo.model3.json'};
 assert.notDeepEqual(sourceIdentity(c),sourceIdentity({...c,modelUrl:'https://example.test/ref2/demo.model3.json'}));
});

test('atlas coordinate interpretation invalidates old previews without changing legacy identities',()=>{
 const c={engine:'spine',base:'https://example.test/ref/rig'};
 const legacy=sourceIdentity(c),declared=sourceIdentity({...c,atlasCoordinateSpace:'declared'});
 assert.equal(legacy.length,7);
 assert.deepEqual(declared.slice(0,7),legacy);
 assert.equal(declared[7],'atlas-coordinate-space:declared');
 assert.notDeepEqual(legacy,declared);
 const border=sourceIdentity({...c,atlasCoordinateSpace:'declared',atlasEdgeExtrusion:2});
 assert.deepEqual(border.slice(0,8),declared);assert.equal(border[8],'atlas-edge-extrusion:2');
});
