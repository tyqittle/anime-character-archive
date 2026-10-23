// Executable boundaries: adding a game must not grow loader or workflow branches.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readCatalogRegistry} from '../scripts/catalog_registry.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const registry=readCatalogRegistry();
assert.ok(!read('assets/js/spine/bootstrap.js').includes('const entries=['),'Frontend must read the registry');
assert.ok(!read('scripts/preview_queue.py').includes("CATALOGS=['"),'Python queue must read the registry');
assert.ok(!read('assets/js/shared/catalog-registry.js').includes('document.'),'Registry service cannot depend on DOM');
assert.ok(read('scripts/repair_missing_previews.mjs').includes('readCharacters()'));
for(const entry of registry)assert.ok(fs.existsSync(new URL('../'+entry.path,import.meta.url)),entry.path);
const wrappers=["newgame-previews.yml","highquality-live2d-previews.yml","more-live2d-previews.yml","mature-live2d-previews.yml","azurlane-preview-images.yml","arknights-illust-previews.yml","bd2-bulk-previews.yml","render-spine-previews.yml"];
for(const file of wrappers){
 const text=read('.github/workflows/'+file);
 assert.ok(text.includes('uses: ./.github/workflows/preview-pipeline.yml'),file);
 assert.ok(!/^  push:/m.test(text),file+' must not duplicate automatic capture');
}
for(const text of ['scripts/preview_repository.py','scripts/preview_pipeline.py']){
 assert.ok(!read(text).includes("c.gameId==="));
}
assert.ok(read('.github/workflows/native-spinepet-windows.yml').length<26000,'Native implementation must stay out of YAML');
console.log('PASS architecture: shared registry, one automatic preview pipeline and extracted native build steps');
