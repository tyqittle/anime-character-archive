import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const theater=read('spine.html'),stage=read('azurlane-stage.html');
const bridge=read('assets/js/spine/live2d-bridge.js');
const viewport=read('assets/js/live2d/state-and-viewport.js');
const loader=read('assets/js/live2d/model-loader.js');
const release=bridge.match(/azurlane-stage\.html\?v=([\w-]+)/)?.[1];
test('parent iframe, child scripts and parent controller share one fresh release token',()=>{
 assert.ok(release&&release.includes('live2d'));
 for(const asset of ['state-and-viewport.js','model-loader.js','bootstrap.js'])
  assert.ok(stage.includes('assets/js/live2d/'+asset+'?v='+release),'Stale child '+asset);
 for(const asset of ['live2d-bridge.js','bootstrap.js','catalog.js'])
  assert.ok(theater.includes('assets/js/spine/'+asset+'?v='+release),'Stale parent '+asset);
});
test('ID validation uses the common model identity grammar, not game-specific duplicated prefixes',()=>{
 const start=viewport.indexOf('function verifyName('),end=viewport.indexOf('function fit(',start);
 assert.ok(start>=0&&end>start);
 const cx=vm.createContext({});
 vm.runInContext(viewport.slice(start,end),cx);
 const valid=(name,id)=>{cx.name=name;cx.id=id;return vm.runInContext('validLive2DIdentity(name,id)',cx)};
 const models=JSON.parse(read('data/live2d-mature.json')).characters.filter(x=>['lovecube','foxhimezero'].includes(x.gameId));
 assert.equal(models.length,11);
 for(const c of models)assert.equal(valid(c.skinCode,c.id),true,c.id);
 assert.equal(valid('some_skin','al-unrelated_skin'),false);
 for(const id of ['lc-../../wrong','fh-foo/bar','LC-no','unknown','x-!'])
  assert.equal(valid('test',id),false,id);
 assert.ok(loader.includes('if(!validLive2DIdentity(name,id))'));
 assert.ok(!loader.includes('(?:al|gf|ks|tc|gc|gd|sds|tn|ml|lc|fh)'),'Game-specific duplicated prefix list');
});
test('catalog requests a fresh manifest, not the cached model records from before preview publication',()=>{
 const bootstrap=read('assets/js/spine/bootstrap.js');
 assert.ok(bootstrap.includes('catalogSnapshot='));
 assert.ok(bootstrap.includes("cache:'no-cache'"));
});
