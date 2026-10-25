import test from 'node:test';
import assert from 'node:assert/strict';
import {auditModuleBoundaries,main} from '../scripts/module_boundaries.mjs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const fixture={
 'assets/js/shared/service.js':'function calculate(input){return input.width*2}',
 'assets/js/shared/friend-links.js':'document.querySelectorAll("[data-friend-links]")',
 'spine.html':'<script src="./assets/js/shared/indexeddb-storage.js?v=1"></script><script src="./assets/js/spine/catalog.js?v=1"></script>',
 'azurlane-stage.html':'<script src="./assets/js/live2d/model-loader.js?v=1"></script><script src="./assets/js/spine/desktop-webview-bridge.js?v=1"></script>'
};
const audit=values=>auditModuleBoundaries(Object.keys(values),p=>values[p]);
test('shared services remain independent of page DOM, selection and engine implementations',()=>{
 assert.deepEqual(audit(fixture).errors,[]);
 for(const source of ['document.getElementById("player")','window.ArchiveTheaterUI.setStatus("error")','azurlanePending.id',"import x from '../spine/playback.js'"]){
  assert.ok(audit({...fixture,'assets/js/shared/service.js':source}).errors.length,source);
 }
});
test('engine implementations cannot be added to the other engine or gallery entry',()=>{
 const values={...fixture,'azurlane-stage.html':'<script src="./assets/js/spine/spine-runtime.js?v=1"></script>'};
 assert.equal(audit(values).errors[0].rule,'engine-entry-isolation');
 assert.ok(audit({...fixture,'spine.html':fixture['spine.html']+'<script src="./assets/js/live2d/model-loader.js?v=1"></script>'}).errors.some(e=>e.rule==='engine-entry-isolation'));
});
test('cache backend must initialize before the catalog UI',()=>{
 assert.equal(audit({...fixture,'spine.html':'<script src="./assets/js/spine/catalog.js?v=1"></script>'}).errors[0].rule,'storage-service-before-ui');
});
test('the current application entries respect module boundaries',()=>{
 assert.deepEqual(main(fileURLToPath(new URL('../',import.meta.url))).errors,[]);
});
test('Git preserves exact hashed model settings bytes across checkout platforms',()=>{
 const file='assets/model-settings/tokyonecro/tn2-l2d00001.model.json';
 const attributes=execFileSync('git',['check-attr','text','--',file],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8'});
 assert.match(attributes,/: text: unset\s*$/);
});
