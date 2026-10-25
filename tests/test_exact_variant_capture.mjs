import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {uniqueAnimationEntries,canonicalAnimationId}=require('../assets/js/spine/animation-identity.js');
test('exact capture retains a requested regional model while normal browsing keeps its canonical target',()=>{
 const normal={id:'al-test_2',skinCode:'test_2',gameId:'azurlane',characterName:'Test',engine:'cubism',modelUrl:'https://test/normal'};
 const alt={...normal,id:'al-test_2_hx',skinCode:'test_2_hx',modelUrl:'https://test/alternate'};
 assert.deepEqual(uniqueAnimationEntries([normal,alt]),[normal]);assert.equal(canonicalAnimationId(alt.id),normal.id);
 assert.deepEqual(uniqueAnimationEntries([normal,alt],{exactVariantId:alt.id}),[normal,alt]);assert.equal(canonicalAnimationId(alt.id),alt.id);
 assert.deepEqual(uniqueAnimationEntries([normal,alt]),[normal]);assert.equal(canonicalAnimationId(alt.id),normal.id);
});
