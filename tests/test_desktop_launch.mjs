// The hidden selector may retain another game's role; catalog selection is authoritative.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../assets/js/spine/desktop-launch.js',import.meta.url),'utf8');
const registry=JSON.parse(readFileSync(new URL('../data/animation-catalogs.json',import.meta.url),'utf8'));
const all=registry.catalogs.flatMap(c=>JSON.parse(readFileSync(new URL('../'+c.path,import.meta.url),'utf8')).characters);
function harness(selection,entries=all){
 let onClick,current=selection;
 const alerts=[],location={search:'',href:'https://archive.test/spine.html'};
 const button={hidden:false,disabled:false,addEventListener(type,fn){assert.equal(type,'click');onClick=fn}};
 runInNewContext(source,{
  document:{getElementById:id=>id==='sendToDesktop'?button:null},
  chosen:()=>current,allCharacters:entries,URLSearchParams,
  window:{location},location,alert:message=>alerts.push(message),
  fetch(){throw Error('Launcher must delegate source loading to the website engine')}
 });
 return {alerts,location,button,click:()=>onClick(),select:value=>current=value};
}
test('every registered catalog identity can enter the universal host without a game/version whitelist',()=>{
 const seen=new Set(),unique=all.filter(c=>c.id&&c.gameId&&!seen.has(c.id)&&seen.add(c.id));
 const h=harness(null,unique);
 const groups=new Set();
 for(const character of unique){
  h.select(character);h.click();
  const uri=new URL(h.location.href);
  assert.equal(uri.protocol,'animecharacter:');assert.equal(uri.hostname,'open');
  assert.equal(uri.searchParams.get('host'),'webview2');
  assert.equal(uri.searchParams.get('game'),character.gameId);
  assert.equal(uri.searchParams.get('id'),character.id);
  groups.add((character.engine||'spine')+':'+(character.spineVersion||''));
 }
 console.log('UNIVERSAL_PROTOCOL_IDENTITIES',unique.length,'groups',Array.from(groups).sort().join(','));
 assert.deepEqual(h.alerts,[]);
 assert.ok(groups.has('cubism:')&&groups.has('spine:3.8')&&groups.has('spine:4.0')&&groups.has('spine:4.1'));
});
test('the actual BD2 card selection wins without consulting a stale hidden selector',()=>{
 const role=all.find(c=>c.gameId==='browndust2'),h=harness(role);
 h.click();assert.equal(new URL(h.location.href).searchParams.get('id'),role.id);
 assert.equal(new URL(h.location.href).searchParams.get('game'),'browndust2');
});
test('unknown or ambiguous selections never dispatch a protocol request',()=>{
 for(const entries of [[],[{id:'one',gameId:'game'},{id:'one',gameId:'game'}]]){
  const h=harness({id:'one',gameId:'game'},entries);h.click();
  assert.equal(h.location.href,'https://archive.test/spine.html');assert.equal(h.alerts.length,1);
 }
 const h=harness(null);h.click();assert.match(h.alerts[0],/当前游戏的角色列表/);
});
test('future catalog IDs with Unicode and URL punctuation round-trip as identities',()=>{
 const role={id:'角色 / + & ? #',gameId:'future-game'},h=harness(role,[role]);h.click();
 assert.equal(new URL(h.location.href).searchParams.get('id'),role.id);
 assert.equal(new URL(h.location.href).searchParams.get('game'),role.gameId);
});
