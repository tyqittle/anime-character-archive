// Run with: node tests/smoke.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
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
// Every dynamic preview is a unique frame extracted from that exact character's Spine
// binary, NOT a reused base character portrait or an unrelated static illustration.
const previewDigests=new Set();
for(const entry of spine.characters){
  const expected='./assets/animation-previews/'+entry.gameId+'-'+entry.id+'.webp';
  assert.equal(entry.preview,expected,'Wrong character animation preview: '+entry.id);
  assert.equal(entry.previewSource,'matching-spine-animation-frame','Unverified/guessed preview: '+entry.id);
  const bytes=fs.readFileSync(path.join(root,expected));
  assert.ok(bytes.length>1000&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP','Corrupt/missing WebP preview: '+entry.id);
  const sha=createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha,entry.previewSha256,'Preview bytes do not match manifest: '+entry.id);
  assert.ok(!previewDigests.has(sha),'Two distinct dynamic character previews share the same image: '+entry.id);
  previewDigests.add(sha);
}
assert.ok(chars.characters.every(x=>x.image.startsWith('./assets/portraits/')),'Not all static images are local');
const home=read('index.html'),old=read('gallery.html'),page=read('characters.html'),player=read('spine.html');
assert.ok(home.includes('./characters.html')&&old.includes('./characters.html'),'Old entrypoint no longer redirects');
assert.ok(page.includes('data/characters.json'),'Character archive not connected');
const brandName='Anime Character Archive';
const baseUrl='https://tyqittle.github.io/anime-character-archive/';
const repoUrl='https://github.com/tyqittle/anime-character-archive';
const readme=read('README.md');
const localGuide=read('LOCAL_START.md');
const probe=read('.github/workflows/pages-live-probe.yml');
assert.ok(readme.includes(brandName)&&readme.includes(baseUrl)&&readme.includes(repoUrl),'README has outdated repository identity or website URL');
assert.ok(localGuide.includes(baseUrl),'Local-start guide points to an obsolete GitHub Pages location');
assert.ok(!readme.includes('tyqittle.github.io/winter-cg-archive')&&!localGuide.includes('tyqittle.github.io/winter-cg-archive'),'Old Pages URL in documentation');
assert.ok(probe.includes('GITHUB_REPOSITORY#*/'),'Pages probe must adapt automatically to the repository name');
assert.ok(!probe.includes('/winter-cg-archive/'),'Pages probe still checks the retired repository path');
assert.ok(page.includes("LEGACY_FAVORITES_STORAGE_KEY='winter-characters-favorites-v1'"),'The legacy localStorage favorites key must remain migratable');
assert.ok(page.includes("FAVORITES_STORAGE_KEY='anime-character-archive-favorites-v1'"),'Favorite storage key must match the current project');
assert.ok(page.includes('localStorage.setItem(FAVORITES_STORAGE_KEY,savedFavorites)'),'Existing favorites must survive a repository rename');
assert.ok(page.includes(brandName)&&player.includes(brandName),'Both gallery and player titles should match the project branding');
const localLauncher=read('start_site.py');
assert.ok(localLauncher.includes('Anime Character Archive')&&localLauncher.includes("'/characters.html'"),'Local launcher must use the current project name and gallery entrypoint');
assert.ok(!localLauncher.includes('Winter Gallery')&&!localLauncher.includes('data/catalog.json'),'Local launcher still relies on a retired site or missing catalog');
const mirrorScript=read('scripts/mirror_static_portraits.py');
assert.ok(mirrorScript.includes('entry.get("gameId") == "nikke"')&&mirrorScript.includes('re.fullmatch(r"c[0-9]{3}"'),'NIKKE mirror task must not consume entries belonging to other games');
assert.ok(!mirrorScript.includes('MANIFEST.write_text('),'NIKKE mirror task must not overwrite multi-game manifest metadata');

assert.ok(old.includes("location.search+location.hash"),'Legacy gallery redirect should preserve game filters and deep links');
assert.ok(read('spine-recovery-20261020.html').includes('Anime Character Archive'),'Archived recovery page should show the current project branding');

// Prevent a future commit from silently reintroducing paths or client
// identifiers from the retired repository. The old favorites key is the one
// intentional exception: users need it for a lossless localStorage migration.
const identityExtensions=new Set(['.html','.md','.mjs','.js','.json','.yml','.yaml','.py','.css','.bat','.txt']);
const ignoredIdentityDirs=new Set(['.git','vendor','portraits','thumbs','animation-previews']);
const outdatedIdentity=/(?:winter[-_]cg[-_]archive|winter[-_]characters|WinterCG|WinterCharacterArchive)/i;
function inspectIdentity(relative=''){
 for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){
  const p=path.join(relative,entry.name);
  if(entry.isDirectory()){
   if(!ignoredIdentityDirs.has(entry.name))inspectIdentity(p);
   continue;
  }
  if(p===path.join('tests','smoke.mjs')||!identityExtensions.has(path.extname(p)))continue;
  const raw=read(p);
  const content=p==='characters.html'?raw.replaceAll('winter-characters-favorites-v1','[legacy-favorites-migration]'):raw;
  assert.ok(!outdatedIdentity.test(content),'Retired project name or Pages path found in '+p);
 }
}
inspectIdentity();


const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Missing gallery script');
new Function(script);
assert.ok(page.includes('function drawGroups()')&&page.includes('game-section')&&page.includes('characterKey'),'Missing dynamic game and character classification');
assert.ok(page.includes('id="viewLoading"')&&page.includes('class="view-loading"'),'Missing stable modal loading state');
const showOne=page.slice(page.indexOf('function showOne(id){'),page.indexOf('function navigate(step){'));
assert.ok(showOne.includes("img.src=c.image"),'Detail viewer must show the original full artwork');
assert.ok(showOne.includes("img.decode().then"),'Detail viewer must wait for full artwork decoding');
assert.ok(showOne.includes("pic.classList.add('is-loading')"),'Detail viewer must mask the artwork until fully loaded');
assert.ok(!showOne.includes('img.src=thumb')&&!showOne.includes('previewFor(c)'),'Detail viewer must not flash a cropped card thumbnail');
assert.ok(page.includes('viewerLoadToken'),'Rapid navigation must cancel stale image completion');
const viewerCSS=read('assets/gallery-redesign.css');
assert.ok(viewerCSS.includes('#viewer .view-picture.is-loading #viewImg{visibility:hidden}'),'Modal must hide in-flight image rendering');
assert.ok(viewerCSS.includes('object-position:center center'),'Modal image should remain centered');
assert.ok(page.includes('function sizeViewerFor(c)'),'Detail dialog must adapt to original artwork aspect ratio');
assert.ok(page.includes('c.imageWidth')&&page.includes('c.imageHeight'),'Dialog must rely on original source dimensions, not cropped thumbnail geometry');
assert.ok(page.includes("sizeViewerFor(c);"),'Detail dialog should set aspect-ratio geometry before opening');
assert.ok(viewerCSS.includes('grid-template-columns:minmax(0,1fr) var(--viewer-info-width'),'Detail dialog must allocate adaptive photo and metadata columns');
assert.ok(viewerCSS.includes('position:absolute')&&viewerCSS.includes('max-height:none'),'Full image should not expand the layout grid or be cut off');
assert.ok(viewerCSS.includes('height:var(--viewer-art-height'),'Detail dialog should resize to image proportions');


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
