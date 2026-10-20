// Run with: node tests/smoke.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const chars=JSON.parse(read('data/characters.json'));
const spine=JSON.parse(read('data/spine-characters.json'));
assert.ok(Array.isArray(chars.characters)&&chars.characters.length>=90,'Full-body catalog too small');
assert.ok(chars.characters.every(c=>c.kind==='full'&&/\/images\/FB\//.test(c.image)),'Avatar-only record in catalog');
assert.ok(Array.isArray(spine.characters)&&spine.characters.length>=60,'Spine index missing');
const ids=new Set();
for(const e of spine.characters){assert.match(e.id,/^c\d{3}(?:_\d{2})?$/);assert.ok(!ids.has(e.id),'Duplicate '+e.id);ids.add(e.id);assert.ok(['4.0','4.1','4.2'].includes(e.spineVersion));}
for(const id of ['c012','c015','c112','c170','c181','c191','c200','c222','c233','c270','c280','c282']){
 const file='assets/portraits/'+id+'.js';assert.ok(fs.existsSync(path.join(root,file)),'Missing bundled portrait '+file);
}
const index=read('index.html'),gallery=read('gallery.html'),characters=read('characters.html'),player=read('spine.html');
assert.ok(index.includes('./characters.html')&&gallery.includes('./characters.html'),'Old entry not redirected');
assert.ok(characters.includes('data/characters.json'),'Character archive disconnected');
assert.ok(player.includes('new spine.SpinePlayer'),'Spine renderer missing');
assert.ok(player.includes('indexedDB.open(cacheDB'),'Spine cache missing');
assert.ok(!/<iframe\b/i.test(player),'Third-party iframe not allowed');
console.log('PASS: '+chars.characters.length+' full-body records, '+spine.characters.length+' Spine records, 12 preserved bundled portraits.');
