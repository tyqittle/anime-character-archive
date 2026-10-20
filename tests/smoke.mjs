// Run with: node tests/smoke.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const catalog=JSON.parse(read('data/catalog.json'));
const spine=JSON.parse(read('data/spine-characters.json'));
const chars=JSON.parse(read('data/characters.json'));
assert.ok(Array.isArray(catalog.images)&&catalog.images.length>=10,'Local CG metadata missing');
assert.ok(Array.isArray(chars.characters)&&chars.characters.length>=200,'Character data missing');
assert.ok(Array.isArray(spine.characters)&&spine.characters.length>=20,'Spine manifest missing');
const ids=new Set();
for (const entry of spine.characters) {
 assert.match(entry.id,/^c\d{3}(?:_\d{2})?$/,'Unexpected character id');
 assert.ok(!ids.has(entry.id),'Duplicate character id '+entry.id);ids.add(entry.id);
 assert.ok(['4.0','4.1','4.2'].includes(entry.spineVersion),'Unknown runtime version');
 assert.ok(entry.base.endsWith('/'+entry.id+'_00'),'Spine resource filename mismatch');
}
for (const scene of catalog.images) {
 if (scene.url?.startsWith('./assets/cg/')) {
  assert.ok(fs.existsSync(path.join(root,scene.url)),'Missing local CG '+scene.url);
 }
}
const bundledIds=['c012','c191','c170','c112','c200','c181','c280','c282','c222','c270'];
for (const id of bundledIds) {
 const file='assets/portraits/'+id+'.js';
 const content=read(file);
 assert.ok(content.includes('data:image/png;base64,iVBOR'), 'Missing real embedded PNG for '+id);
 assert.ok(content.length>100000, 'Portrait unexpectedly empty: '+id);
}
const player=read('spine.html'),gallery=read('gallery.html'),index=read('index.html');
assert.ok(gallery.includes('assets/portraits/c012.js'),'Missing local portrait assets in gallery');
assert.ok(gallery.includes('window.WINTER_PORTRAITS'),'Gallery does not render actual cached images');
assert.ok(!/<iframe\b/i.test(player),'Third-party embed must not be used');
assert.ok(!/<iframe\b/i.test(gallery),'Third-party embed must not be used');
assert.ok(player.includes('new spine.SpinePlayer'),'Independent Spine renderer missing');
assert.ok(player.includes('indexedDB.open(cacheDB'),'Browser-local cache missing');
assert.ok(gallery.includes('./spine.html?id='),'Missing gallery-to-Spine navigation');
assert.ok(index.includes('./gallery.html'),'Missing editor-to-gallery navigation');
for (const [filename,markup] of [['spine.html',player],['gallery.html',gallery]]) {
 const script=markup.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'Inline script missing: '+filename);
 new Function(script);
}
console.log('PASS: '+catalog.images.length+' scenes, '+chars.characters.length+' character records, '+spine.characters.length+' Spine entries; local CG files and page links verified.');
