import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';
import {sourceIdentity} from '../scripts/catalog_registry.mjs';
const code=fs.readFileSync(new URL('../assets/js/spine/spine-assets.js',import.meta.url),'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(){
 const files={'hero.json':Buffer.from(JSON.stringify({skeleton:{spine:'3.8.99'},bones:[{name:'root'}],animations:{idle:{}},fixture:'x'.repeat(100)})),
  'hero.atlas':Buffer.from('\nhero.png\nsize: 512,512\nformat: RGBA8888\n'), 'hero.png':Buffer.alloc(200,42)};
 const c={id:'hero',gameId:'test',base:'https://source.test/assets/hero',resourceStem:'hero',skeletonUrl:'https://source.test/assets/hero.json',atlasUrl:'https://source.test/assets/hero.atlas',skeletonFormat:'json',
  resourceIntegrity:Object.entries(files).map(([path,bytes])=>({path,sha256:sha(bytes)}))};
 class Reader{readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:application/octet-stream;base64,'+Buffer.from(b).toString('base64');this.onload()})}}
 const context=vm.createContext({Blob,URL,Uint8Array,TextDecoder,AbortController,crypto:webcrypto,location:{href:'https://archive.test/spine.html'},FileReader:Reader,
  ArchiveCatalogRegistry:{sourceIdentity},ArchiveAssets:{blob:async url=>new Blob([files[new URL(url).pathname.split('/').pop()]])},incoming:c});
 vm.runInContext(code,context);
 return {files,c,context,run:()=>vm.runInContext('downloadPack(incoming,"primary",undefined,()=>false)',context)};
}
test('byte-locked skeleton, atlas and textures load, while changed source bytes fail',async()=>{
 const f=fixture(),pack=await f.run();assert.equal(pack.version,'3.8');assert.ok(pack.headerChecked);
 f.files['hero.png']=Buffer.alloc(200,43);await assert.rejects(f.run(),/源资源版本已变化/);
});
test('incomplete or duplicate locks fail and changed hashes cannot reuse an old pack',async()=>{
 const f=fixture(),pack=await f.run();f.context.pack=pack;
 assert.equal(vm.runInContext('isCachedPackFor(incoming,pack)',f.context),true);
 f.c.resourceIntegrity[0].sha256='0'.repeat(64);assert.equal(vm.runInContext('isCachedPackFor(incoming,pack)',f.context),false);
 f.c.resourceIntegrity.push(f.c.resourceIntegrity[0]);await assert.rejects(f.run(),/摘要清单无效/);
 const missing=fixture();missing.c.resourceIntegrity=missing.c.resourceIntegrity.filter(x=>x.path!=='hero.atlas');await assert.rejects(missing.run(),/缺少版本摘要/);
});
test('legacy resource identity and cache fingerprint retain their original shape',async()=>{
 const f=fixture();delete f.c.resourceIntegrity;
 assert.equal(sourceIdentity(f.c).length,7);
 assert.equal(vm.runInContext('sourceFingerprint(incoming)',f.context),JSON.stringify([2,f.c.base,f.c.skeletonUrl,f.c.atlasUrl,'json']));
 assert.equal((await f.run()).version,'3.8');
});
test('CR-only atlas is verified in its original byte form and normalized for runtime parsing',async()=>{
 const f=fixture();f.files['hero.atlas']=Buffer.from('\rhero.png\rsize: 512,512\rformat: RGBA8888\r');
 f.c.resourceIntegrity.find(x=>x.path==='hero.atlas').sha256=sha(f.files['hero.atlas']);
 const pack=await f.run();assert.ok(!pack.rawDataURIs['hero.atlas'].includes('\r'));assert.ok(pack.rawDataURIs['hero.atlas'].includes('\nhero.png\n'));
});
test('duplicated CR before LF is normalized without inserting blank atlas properties',async()=>{
 const f=fixture();f.files['hero.atlas']=Buffer.from('\r\r\nhero.png\r\r\nsize: 512,512\r\r\nformat: RGBA8888\r\r\n');
 f.c.resourceIntegrity.find(x=>x.path==='hero.atlas').sha256=sha(f.files['hero.atlas']);
 assert.equal((await f.run()).rawDataURIs['hero.atlas'],'data:text/plain,\nhero.png\nsize: 512,512\nformat: RGBA8888\n');
});
test('declared attachment repairs keep original byte locks and reject stale source mappings',async()=>{
 const f=fixture(),d=JSON.parse(f.files['hero.json']);d.skins=[{name:'default',attachments:{face:{neutral:{path:'neutral '}}}}];
 f.files['hero.json']=Buffer.from(JSON.stringify(d));f.files['hero.atlas']=Buffer.from('\nhero.png\nsize: 512,512\nneutral\n  index: -1\n');
 for(const name of ['hero.json','hero.atlas'])f.c.resourceIntegrity.find(x=>x.path===name).sha256=sha(f.files[name]);
 f.c.spineAttachmentPathRepairs=[{skin:'default',slot:'face',name:'neutral',from:'neutral ',to:'neutral'}];
 const pack=await f.run(),json=JSON.parse(pack.rawDataURIs['hero.json'].slice('data:application/json,'.length));
 assert.equal(json.skins[0].attachments.face.neutral.path,'neutral');assert.equal(JSON.parse(f.files['hero.json']).skins[0].attachments.face.neutral.path,'neutral ');
 f.c.spineAttachmentPathRepairs[0].from='wrong';await assert.rejects(f.run(),/路径修复已过期/);
});
