import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const load=p=>fs.readFileSync(new URL('../'+p,import.meta.url));
test('All four recently added games own real matching WebP thumbnails',()=>{
 const sources=['data/live2d-highquality.json','data/live2d-moregames.json'];
 const counts={};
 for(const path of sources){
  const catalog=JSON.parse(load(path));
  for(const c of catalog.characters){
   const expected='./assets/animation-previews/'+c.gameId+'-'+c.id+'.webp';
   assert.equal(c.preview,expected,c.id);
   assert.equal(c.previewSource,'matching-live2d-animation-frame',c.id);
   assert.match(c.previewSha256,/^[a-f0-9]{64}$/);
   const bytes=load(expected.slice(2));
   assert.ok(bytes.length>1000&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP',c.id);
   assert.equal(createHash('sha256').update(bytes).digest('hex'),c.previewSha256,c.id);
   counts[c.gameId]=(counts[c.gameId]||0)+1;
  }
 }
 assert.deepEqual(counts,{girldimension:102,sinsevendeadlysins:94,touhoucannonball:84,girlscafegun:64});
});
test('Both web pages render the same grouped external model source links',()=>{
 const links=[];
 const fakeElement=tag=>({tag,children:[],set href(url){this.url=url},append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children},dataset:{}});
 const roots=[fakeElement('nav'),fakeElement('nav')];
 const doc={querySelectorAll:()=>roots,createElement:fakeElement};
 vm.runInNewContext(load('assets/js/shared/friend-links.js').toString('utf8'),{document:doc,encodeURIComponent});
 for(const root of roots){
  assert.equal(root.children.length,2);
  const groupNodes=root.children[1].children;
  assert.equal(groupNodes.length,2);
  const items=groupNodes.flatMap(x=>x.children[1].children);
  assert.equal(items.length,11);
  const urls=items.map(x=>x.url);
  assert.equal(new Set(urls).size,11);
  assert.ok(urls.every(url=>url.startsWith('https://')));
  assert.ok(items.filter(x=>x.dataset.linkType==='source').length===5);
  links.push(urls);
 }
 assert.deepEqual(links[0],links[1]);
 for(const page of ['spine.html','characters.html']){
  assert.ok(load(page).toString('utf8').includes('data-friend-links'));
  assert.ok(load(page).toString('utf8').includes('20261023-preview-friends-v1'));
 }
});
test('Cards use source-matched SHA revisions and retry failures only once',()=>{
 const src=load('assets/js/spine/catalog.js').toString('utf8');
 assert.ok(src.includes('c.previewSha256.slice(0,16)'));
 assert.ok(src.includes('if(retries++===0)'));
 assert.ok(src.includes('预览图暂时不可用 · 点击播放'));
});
