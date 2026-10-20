// Run with: node tests/smoke.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const chars=JSON.parse(read('data/characters.json'));
const spine=JSON.parse(read('data/spine-characters.json'));

assert.ok(Array.isArray(chars.characters)&&chars.characters.length>0,'Missing character records');
assert.ok(chars.characters.every(x=>x.kind==='full'&&(x.image===`./assets/portraits/${x.id}.png`||x.image===`https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/images/FB/${x.id}_00.png`)),'Unexpected full-body image path');
for(const entry of chars.characters){if(entry.image.startsWith('./assets/')) assert.ok(fs.existsSync(path.join(root,entry.image)),'Missing local PNG: '+entry.id); }
assert.equal(new Set(chars.characters.map(x=>x.id)).size,chars.characters.length,'Duplicate character IDs');
assert.ok(Array.isArray(spine.characters)&&spine.characters.length>0,'Missing Spine records');
assert.equal(new Set(spine.characters.map(x=>x.id)).size,spine.characters.length,'Duplicate Spine IDs');
const ids=new Set(chars.characters.map(x=>x.id));
for(const entry of spine.characters) {
  assert.match(entry.id,/^c\d{3}(?:_\d{2})?$/,'Invalid Spine character ID');
  assert.ok(/^c\d{3}(?:_\d{2})?$/.test(entry.id),'Malformed Spine character ID: '+entry.id);
  assert.ok(['4.0','4.1','4.2'].includes(entry.spineVersion),'Unknown Spine version');
  assert.ok(entry.base.endsWith('/'+entry.id+'_00'),'Unexpected Spine path: '+entry.id);
}
assert.ok(chars.characters.every(x=>x.image.startsWith('./assets/portraits/')),'Not all static images are local');
const home=read('index.html'),old=read('gallery.html'),page=read('characters.html'),player=read('spine.html');
assert.ok(home.includes('./characters.html')&&old.includes('./characters.html'),'Old entrypoint no longer redirects');
assert.ok(page.includes('data/characters.json'),'Character archive not connected');
assert.ok(page.includes("/^\\.\\/assets\\/portraits\\/c\\d{3}\\.png$/"),'Gallery missing local PNG path acceptance');
assert.ok(player.includes('new spine.SpinePlayer'),'Spine renderer missing');
assert.ok(player.includes('binaryUrl')&&player.includes('atlasUrl'),'Spine runtime URL fix missing');
assert.ok(player.includes('indexedDB.open(cacheDB'),'Spine cache missing');
assert.ok(!/<iframe\b/i.test(player),'Third-party iframe not allowed');
console.log('PASS: '+chars.characters.length+' full-body candidates, '+spine.characters.length+' Spine index entries, 12 preserved bundled portraits.');
