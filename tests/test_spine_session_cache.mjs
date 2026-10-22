import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../assets/js/spine/session-cache.js',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(code,context);
const get=id=>vm.runInContext('recentSpinePack('+JSON.stringify(id)+')',context);
const put=pack=>{context.incoming=pack;vm.runInContext('rememberSpinePack(incoming)',context)};
function pack(id,size){return {id,headerChecked:true,rawDataURIs:{'skin.webp':'x'.repeat(size)}}}
put(pack('one',3000));
put(pack('two',3000));
assert.equal(get('one').id,'one');
put(pack('three',3000)); // two must be evicted: one was recently used.
assert.equal(get('two'),null);
assert.equal(get('three').id,'three');
put({...pack('unverified',3000),headerChecked:false});
assert.equal(get('unverified'),null);
put(pack('huge',25*1024*1024)); // UTF-16: 50 MiB, must skip cache.
assert.equal(get('huge'),null);
assert.equal(get('one').id,'one');
const stats=vm.runInContext('({size:hotSpinePacks.size,bytes:hotPackBytes,limit:hotPackLimit})',context);
assert.ok(stats.size<=2&&stats.bytes<=stats.limit);
console.log('PASS: bounded in-memory animation cache and LRU eviction');
