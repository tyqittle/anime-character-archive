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
const bd2=JSON.parse(read('data/spine-bd2-pilot.json'));
const bd2Full=JSON.parse(read('data/spine-bd2-characters.json'));
assert.equal(bd2Full.characters.length,209,'Brown Dust 2 must index all 209 models');
assert.equal(new Set(bd2Full.characters.map(c=>c.id)).size,209,'Duplicate BD2 IDs');
assert.equal(new Set(bd2Full.characters.map(c=>c.characterName)).size,87,'Expected 87 source BD2 characters');
for(const c of bd2Full.characters){
 assert.equal(c.gameId,'browndust2');
 assert.equal(c.assetType,'character-full-spine');
 assert.ok(c.base.includes(bd2Full.pinnedSourceCommit));
 assert.match(c.base,/\/assets\/spine\/character\/[^/]+\/[^/]+\/char\d{6}(?:_c)?$/);
 if(c.preview){
  assert.equal(c.preview,'./assets/animation-previews/browndust2-'+c.id+'.webp');
  assert.equal(c.previewSource,'matching-spine-animation-frame');
  assert.equal(c.status,'verified-playback');
  assert.ok(fs.existsSync(path.join(root,c.preview)),'Model preview file missing: '+c.id);
 }else assert.equal(c.status,'unverified-playback');
}
assert.equal(bd2.characters.length,5,'Expected exactly five BD2 full-body pilot models');
assert.equal(new Set(bd2.characters.map(c=>c.id)).size,5,'BD2 model ids must be unique');
for(const c of bd2.characters){
 assert.equal(c.gameId,'browndust2');
 assert.equal(c.assetType,'character-full-spine');
 assert.ok(c.base.includes(bd2.pinnedSourceCommit),'Pilot model URL must be pinned to upstream commit');
 assert.match(c.base,/\/assets\/spine\/character\/[^/]+\/[^/]+\/char\d{6}(?:_c)?$/);
 if(c.status==='verified-playback'){
  assert.equal(c.preview,'./assets/animation-previews/browndust2-'+c.id+'.webp','Preview must belong to this exact skeleton');
  assert.equal(c.previewSource,'matching-spine-animation-frame');
  assert.ok(fs.existsSync(path.join(root,c.preview)),'Missing captured exact-model thumbnail');
  assert.equal(c.versionUnverified,false);
 }else{
  assert.equal(c.status,'unverified-playback');
  assert.ok(!c.preview&&c.previewSource==='not-rendered','Never show a wrong or unverified thumbnail');
 }
}



const spineDiagnostics=JSON.parse(read('data/spine-diagnostics.json'));
assert.ok(Array.isArray(spineDiagnostics.diagnostics),'Malformed Spine diagnostics JSON');
const diagnoseWorkflow=read('.github/workflows/spine-diagnose.yml');
for(const id of ['ba-ch0058_home','ba-ch0060_home']){
 assert.ok(spine.characters.some(x=>x.id===id)&&diagnoseWorkflow.includes("'"+id+"'"),'Spine diagnostics target is not in the active lobby catalog: '+id);
}
assert.ok(!diagnoseWorkflow.includes(String.raw`+'\\n'`),'Spine diagnostics workflow must emit a real newline, not literal backslash-n');

assert.ok(Array.isArray(chars.characters)&&chars.characters.length>0,'Missing character records');
assert.ok(chars.characters.every(x=>x.gameId&&x.characterKey),'Every portrait must have a game and character category');
assert.ok(new Set(chars.characters.map(x=>x.gameId)).size>=2,'Expected multiple games');
assert.ok(chars.characters.every(x=>x.kind==='full'&&((x.image===`./assets/portraits/${x.id}.png`||x.image===`./assets/portraits/${x.id}.webp`)||x.image===`https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/images/FB/${x.id}_00.png`)),'Unexpected full-body image path');
for(const entry of chars.characters){if(entry.image.startsWith('./assets/')) assert.ok(fs.existsSync(path.join(root,entry.image)),'Missing local PNG: '+entry.id); }
assert.equal(new Set(chars.characters.map(x=>x.id)).size,chars.characters.length,'Duplicate character IDs');
assert.ok(!chars.characters.some(x=>/T_RoleImg(?:jiyan|yinlin)_UI\.png/i.test(x.originalImage||'')),'A previously rejected half-body Wuthering Waves UI sprite was reimported');
for(const entry of chars.characters){
 assert.ok(entry.thumb&&entry.thumb.startsWith('./assets/thumbs/'),'An artwork is missing its optimized preview: '+entry.id);
 assert.ok(fs.existsSync(path.join(root,entry.thumb)),'A thumbnail file is missing: '+entry.id);
 assert.ok(Number(entry.imageWidth)>0&&Number(entry.imageHeight)>0,'Original artwork dimensions missing: '+entry.id);
}

assert.ok(Array.isArray(spine.characters)&&spine.characters.length>0,'Missing Spine records');
assert.ok(spine.characters.some(x=>x.gameId==='bluearchive'&&x.assetType==='lobby'),'Missing Blue Archive lobby character models');
assert.ok(!spine.characters.some(x=>x.gameId==='bluearchive'&&x.base.includes('/Spine_Characters/')),'Battle chibi sprites must not be used as full-body animations');
assert.equal(new Set(spine.characters.map(x=>x.id)).size,spine.characters.length,'Duplicate Spine IDs');
const ids=new Set(chars.characters.map(x=>x.id));
for(const entry of spine.characters) {
  const blue=entry.gameId==='bluearchive';
  assert.ok(blue || (entry.gameId==='nikke' && /^c\d{3}(?:_\d+|_old)?$/.test(entry.id)), 'Invalid Spine character ID: '+entry.id);
  assert.ok(blue ? /^ba-ch\d+_home$/.test(entry.id) : /^c\d{3}(?:_\d+|_old)?$/.test(entry.id), 'Malformed Spine ID: '+entry.id);
  assert.ok(['3.8','4.0','4.1','4.2'].includes(entry.spineVersion), 'Unknown Spine version: '+entry.id);
  if(blue){
    assert.ok(entry.assetType==='lobby' && entry.base.includes('/Spine_Lobbies/Spr/') && entry.base.endsWith('/'+('CH'+entry.id.match(/ch(\d+)_home/)[1]+'_home')), 'Invalid Blue Archive lobby resource: '+entry.id);
  }else{
    assert.ok(entry.base.includes('/l2d/'+entry.id+'/'), 'NIKKE resource directory mismatch: '+entry.id);
    assert.ok(entry.base.endsWith('/'+entry.id+'_00') || entry.base.endsWith('/'+entry.id), 'NIKKE Spine basename mismatch: '+entry.id);
  }
}
// No preview may be invented for an indexed but not yet rendered model.
// For verified frame previews, independently prove correct ID, bytes and hash.
const previewDigests=new Set();
let unrendered=0;
for(const entry of spine.characters){
  const expected='./assets/animation-previews/'+entry.gameId+'-'+entry.id+'.webp';
  if(!entry.preview) {
    unrendered++;
    assert.notEqual(entry.previewSource,'matching-spine-animation-frame', 'Unrendered entry falsely claims a verified preview: '+entry.id);
    continue;
  }
  assert.equal(entry.preview,expected,'Wrong character animation preview: '+entry.id);
  assert.equal(entry.previewSource,'matching-spine-animation-frame','Unverified/guessed preview: '+entry.id);
  const bytes=fs.readFileSync(path.join(root,expected));
  assert.ok(bytes.length>1000&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP','Corrupt/missing WebP preview: '+entry.id);
  const sha=createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha,entry.previewSha256,'Preview bytes do not match manifest: '+entry.id);
  assert.ok(!previewDigests.has(sha),'Two distinct dynamic character previews share the same image: '+entry.id);
  previewDigests.add(sha);
}
console.log('Spine preview audit: '+previewDigests.size+' verified, '+unrendered+' awaiting real rendering.');
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
const archiveShellCSS=read('assets/archive-shell.css');
assert.ok(page.includes('class="side-sitebar"')&&player.includes('class="side-sitebar"'),'Both gallery pages must use the same sidebar brand');
assert.ok(page.includes('class="side-nav"')&&player.includes('class="side-nav"'),'Both pages must use identical static/dynamic navigation placement');
assert.ok(page.includes('aria-current="page"')&&player.includes('aria-current="page"'),'Each page must mark its active navigation link');
assert.ok(page.includes('archive-shell.css?v=unified-shell-20261021-v2')&&player.includes('archive-shell.css?v=unified-shell-20261021-v2'),'Both pages must load the same versioned design system');
assert.ok(page.includes('class="archive-gallery-main"')&&page.includes('class="archive-extras"'),'Static gallery must present its library before an optional expanded welcome area');
assert.ok(page.includes('id="featured"')&&page.includes('id="heroArt"')&&page.includes('id="totalStat"'),'Static features and statistics must remain wired to the original controls');
assert.ok(archiveShellCSS.includes('grid-auto-rows:max-content')&&archiveShellCSS.includes('overflow-y:auto'),'Full-height static gallery must retain independently scrolling full-height cards');
assert.ok(archiveShellCSS.includes('max-width:850px')&&archiveShellCSS.includes('min-width:851px'),'Unified shell needs both small-screen and desktop rules');

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
const filterItemsSource=page.slice(page.indexOf('function filterItems(){'),page.indexOf('function fillGameLinks('));
assert.ok(filterItemsSource.startsWith('function filterItems(){'),'Gallery rarity filter function missing');
const executeRarityFilter=new Function('items',String.fromCharCode(36),'selectedGroup','onlyFav','favorites','mode',filterItemsSource+';return filterItems();');
const sampleRarities=[
 {id:'empty',name:'Empty',gameId:'nikke',kind:'full',rarity:''},
 {id:'absent',name:'Absent',gameId:'nikke',kind:'full'},
 {id:'known',name:'Known',gameId:'nikke',kind:'full',rarity:'SSR'}
];
function selectRarityTest(rarity){
 const inputs={query:{value:''},rarityFilter:{value:rarity},kindFilter:{value:'all'},sort:{value:'name'}};
 const pick=id=>inputs[id];
 return executeRarityFilter(sampleRarities,pick,'all',false,new Set(),'all').map(x=>x.id).sort();
}
assert.deepEqual(selectRarityTest('unknown'),['absent','empty'],'Unmarked rarity must exclude rated entries');
assert.deepEqual(selectRarityTest('SSR'),['known'],'SSR rarity must exclude unmarked entries');
new Function(script);
assert.ok(page.includes('data-action="retry-view"')&&page.includes('viewRetryNonce=Date.now()'),'Failed original image must support retry');
assert.ok(page.includes("addEventListener('touchstart'")&&page.includes("addEventListener('touchend'"),'Mobile artwork swipe is missing');
const spineScript=player.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(spineScript,'Spine player script is missing');
new Function(spineScript);
assert.ok(player.includes('function cancelCharacterDownload()')&&player.includes('activeCharacterAbort.abort()'),'Stale dynamic downloads must be aborted');
assert.ok(player.includes('externalSignal.addEventListener')&&player.includes('controller.signal'),'Spine download cancellation signal missing');
assert.ok(!player.includes('id="nikke"')&&!player.includes("$('nikke')"),'Main play button must be absent');
assert.ok(player.includes('showControls:false'),'Spine built-in play controls must be disabled');
assert.ok(!player.includes('id="playSaved"')&&!player.includes('id="local"'),'Imported animations should autoplay without extra play buttons');
assert.ok(player.includes("$('characters').onchange=()=>")&&player.includes('playCharacter(c);'),'Dropdown must autoplay the selected character');
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


const theaterCSS=read('assets/spine-theater-layout.css');
assert.ok(player.includes('class="side-sitebar"')&&player.includes('class="side-nav"'),'Spine site navigation must live inside the sidebar');
assert.ok(!player.includes('<header>'),'Spine theater must not waste vertical space on a full-width header');
assert.ok(player.includes('v=20261021-card-height-fix-v2'),'Layout stylesheet version must invalidate prior broken card-grid CSS');
assert.ok(theaterCSS.includes('grid-auto-rows:max-content')&&theaterCSS.includes('min-height:164px'),'Grid rows and cards must have non-collapsing heights');
assert.ok(theaterCSS.includes('height:100dvh')&&theaterCSS.includes('grid-template-columns:clamp('),'Desktop stage must fit the viewport');
assert.ok(theaterCSS.includes('.character-cards{flex:1 1 auto')&&theaterCSS.includes('overflow-y:auto'),'Only the card grid should scroll internally');
assert.ok(theaterCSS.includes('.stage:fullscreen')&&theaterCSS.includes('@media(max-width:850px)'),'Mobile and fullscreen layouts must be preserved');
assert.ok(player.includes('new spine.SpinePlayer'),'Spine renderer missing');
assert.ok(player.includes('connectCanvasGestures')&&player.includes("canvas.addEventListener('pointermove'"),'Theater lacks dragging');
assert.ok(player.includes("$('player').addEventListener('wheel'")&&player.includes('e.preventDefault()'),'Unmodified mouse wheel zoom missing');
assert.ok(!player.includes('if(!(e.ctrlKey||e.metaKey)'),'Wheel zoom must not require Ctrl or Meta');
assert.ok(player.includes('id="animationPicker"')&&player.includes("p.setAnimation(preferred,true)"),'Animation selector missing');
assert.ok(player.includes('requestFullscreen()')&&player.includes('resetViewerTransform()'),'Fullscreen or fit control missing');

assert.ok(player.includes('const runtimeCache=new Map()')&&player.includes('runtimeQueue=Promise.resolve()'),'Cross-version switching must cache isolated Spine engines');
assert.ok(!player.includes('location.assign(')&&!player.includes('location.reload('),'Switching Spine versions must not reload the page');
assert.ok(player.includes('history.replaceState('),'Deep links must update without navigation');
assert.ok(player.includes('rememberSelectedCharacter()'),'Character selection must keep its deep link');
assert.ok(player.includes('refreshCardSelection();'),'Character list must sync highlighting');
assert.ok(player.includes('id="loadNotice"')&&player.includes("'loadNotice').hidden=!loading"),'Dynamic stage needs a loading indicator');
assert.ok(player.includes('class="advanced-tools"'),'Advanced tools must be optional');

assert.ok(player.includes('bd2CatalogUrl')&&player.includes('value="browndust2"'),'Missing complete BD2 loader and game selection');
assert.ok(player.includes('id="bd2CharacterFilter"'),'BD2 character-to-costume filter is missing');
assert.ok(player.includes("c.gameId==='bluearchive'||c.gameId==='browndust2'"),'BD2 must not use NIKKE legacy mirror');

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
