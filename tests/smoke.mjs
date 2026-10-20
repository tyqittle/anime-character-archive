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
assert.ok(chars.characters.every(x=>x.gameId&&x.characterKey),'Every portrait must have a game and character category');
assert.ok(new Set(chars.characters.map(x=>x.gameId)).size>=2,'Expected multiple games');
assert.ok(chars.characters.every(x=>x.kind==='full'&&((x.image===`./assets/portraits/${x.id}.png`||x.image===`./assets/portraits/${x.id}.webp`)||x.image===`https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/images/FB/${x.id}_00.png`)),'Unexpected full-body image path');
for(const entry of chars.characters){if(entry.image.startsWith('./assets/')) assert.ok(fs.existsSync(path.join(root,entry.image)),'Missing local PNG: '+entry.id); }
assert.equal(new Set(chars.characters.map(x=>x.id)).size,chars.characters.length,'Duplicate character IDs');
assert.ok(Array.isArray(spine.characters)&&spine.characters.length>0,'Missing Spine records');
assert.ok(spine.characters.some(x=>x.gameId==='bluearchive'&&x.assetType==='lobby'),'Missing Blue Archive lobby character models');
assert.ok(!spine.characters.some(x=>x.gameId==='bluearchive'&&x.base.includes('/Spine_Characters/')),'Battle chibi sprites must not be used as full-body animations');
assert.equal(new Set(spine.characters.map(x=>x.id)).size,spine.characters.length,'Duplicate Spine IDs');
const ids=new Set(chars.characters.map(x=>x.id));
for(const entry of spine.characters) {
  assert.ok(entry.gameId==='bluearchive'||/^c\d{3}(?:_\d{2})?$/.test(entry.id),'Invalid Spine character ID');
  assert.ok(entry.gameId==='bluearchive'?/^ba-ch\d+_home$/.test(entry.id):/^c\d{3}(?:_\d{2})?$/.test(entry.id),'Malformed Spine character ID: '+entry.id);
  assert.ok(['3.8','4.0','4.1','4.2'].includes(entry.spineVersion),'Unknown Spine version');
  assert.ok(entry.gameId==='bluearchive'?(entry.assetType==='lobby'&&entry.base.includes('/Spine_Lobbies/Spr/')&&entry.base.endsWith('/'+('CH'+entry.id.match(/ch(\d+)_home/)[1]+'_home'))):entry.base.endsWith('/'+entry.id+'_00'),'Unexpected Spine path: '+entry.id);
}
assert.ok(chars.characters.every(x=>x.image.startsWith('./assets/portraits/')),'Not all static images are local');
const home=read('index.html'),old=read('gallery.html'),page=read('characters.html'),player=read('spine.html');
assert.ok(home.includes('./characters.html')&&old.includes('./characters.html'),'Old entrypoint no longer redirects');
assert.ok(page.includes('data/characters.json'),'Character archive not connected');
const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Missing gallery script');
new Function(script);
assert.ok(page.includes('function drawGroups()')&&page.includes('game-section')&&page.includes('characterKey'),'Missing dynamic game and character classification');
assert.ok(player.includes('new spine.SpinePlayer'),'Spine renderer missing');
assert.ok(player.includes('binaryUrl')&&player.includes('atlasUrl'),'Spine runtime URL fix missing');
assert.ok(player.includes('indexedDB.open(cacheDB'),'Spine cache missing');
assert.ok(!/<iframe\b/i.test(player),'Third-party iframe not allowed');
console.log('PASS: '+chars.characters.length+' classified static artworks across '+new Set(chars.characters.map(x=>x.gameId)).size+' games; '+spine.characters.length+' external Spine entries.');

// Guard against accidentally double-escaped Spine version regexps.
// A prior regression rejected valid 3.8 export headers before playback began.
const playerSource=read('spine.html');
const versionCheck=playerSource.match(/if\(!\/(\^.*?)\/\.test\(version\|\|''\)\)/);
assert.ok(versionCheck,'Missing Spine export-version validation');
const versionRegexp=new RegExp(versionCheck[1]);
assert.ok(versionRegexp.test('3.8.99'),'Spine version regex rejects valid 3.8 export');
assert.ok(versionRegexp.test('4.1.24'),'Spine version regex rejects valid 4.1 export');
assert.ok(!versionRegexp.test('unrecognized'),'Spine version regex accepted invalid export');
