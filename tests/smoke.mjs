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
  const blue=entry.gameId==='bluearchive',nikke=entry.gameId==='nikke',konosuba=entry.gameId==='konosuba';
  assert.ok(blue||nikke||konosuba,'Unexpected Spine game: '+entry.id);
  assert.ok(['3.8','4.0','4.1','4.2'].includes(entry.spineVersion),'Unknown Spine version: '+entry.id);
  if(blue){
    assert.match(entry.id,/^ba-[a-z0-9_]+$/,'Malformed Blue Archive lobby ID');
    assert.ok(entry.assetType==='lobby'&&entry.base.includes('/Spine_Lobbies/Spr/'),'Invalid Blue Archive lobby resource: '+entry.id);
    const stem=entry.base.split('/').pop(),parent=entry.base.split('/').at(-2);
    assert.ok(stem===parent,'Blue Archive model cannot borrow a different lobby skeleton: '+entry.id);
  }else if(nikke){
    assert.match(entry.id,/^c\d{3}(?:_\d+|_old)?$/,'Malformed NIKKE ID');
    assert.ok(entry.base.includes('/l2d/'+entry.id+'/'),'NIKKE model directory mismatch: '+entry.id);
    assert.ok(entry.base.endsWith('/'+entry.id+'_00')||entry.base.endsWith('/'+entry.id),'NIKKE Spine basename mismatch: '+entry.id);
  }else{
    assert.match(entry.id,/^kf-\d+-\d+$/,'Malformed KonoSuba battle rig ID');
    assert.equal(entry.spineVersion,'3.8');
    assert.equal(entry.skeletonFormat,'json');
    assert.ok(entry.skeletonUrl?.endsWith('.txt')&&entry.atlasUrl?.endsWith('.atlas'),'KonoSuba JSON export or atlas missing');
    assert.ok(entry.skeletonUrl.startsWith('https://raw.githubusercontent.com/HaiKonofanDesu/konofan-assets-jp-sortet/869daaf357ba3622b4a792350b258499cdb78468/'),'KonoSuba assets must reference pinned source');
    assert.equal(entry.base,entry.atlasUrl.slice(0,-6),'KonoSuba animation must use same base name as atlas');
    assert.equal(entry.assetType,'battle-spine');
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
const galleryModules=["assets/js/gallery/state.js","assets/js/gallery/catalog.js","assets/js/gallery/viewer.js","assets/js/gallery/events.js","assets/js/gallery/bootstrap.js"];
const spineModules=["assets/js/spine/state.js","assets/js/spine/viewer-controls.js","assets/js/spine/catalog.js","assets/js/spine/spine-runtime.js","assets/js/spine/spine-assets.js","assets/js/spine/live2d-bridge.js","assets/js/spine/session-cache.js","assets/js/spine/playback.js","assets/js/spine/local-tools.js","assets/js/spine/bootstrap.js"];
const gallerySource=galleryModules.map(read).join('\n');
const spineSource=spineModules.map(read).join('\n');
const home=read('index.html'),old=read('gallery.html'),page=read('characters.html')+'\n'+gallerySource,player=read('spine.html')+'\n'+spineSource;
for(const [file,source] of [...galleryModules.map(f=>[f,'characters.html']),...spineModules.map(f=>[f,'spine.html'])]){
 assert.ok(fs.existsSync(path.join(root,file)),'Referenced module missing: '+file);
 assert.ok(read(source).includes('./'+file+'?v='),'HTML must load versioned script module: '+file);
 new Function(read(file));
}
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
assert.ok(page.includes('id="explore"')&&page.includes('class="archive-extras"'),'Static gallery must present its library before an optional expanded welcome area');
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
  const content=raw.replaceAll('winter-characters-favorites-v1','[legacy-favorites-migration]');
  assert.ok(!outdatedIdentity.test(content),'Retired project name or Pages path found in '+p);
 }
}
inspectIdentity();


const script=gallerySource;
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
const spineScript=spineSource;
assert.ok(spineScript,'Spine player script is missing');
new Function(spineScript);
assert.ok(player.includes('function cancelCharacterDownload()')&&player.includes('activeCharacterAbort.abort()'),'Stale dynamic downloads must be aborted');
assert.ok(read('assets/js/shared/asset-sources.js').includes("signal?.addEventListener('abort'")&&player.includes('controller.signal'),'Spine download cancellation signal missing');
assert.ok(!player.includes('id="nikke"')&&!player.includes("$('nikke')"),'Main play button must be absent');
assert.ok(player.includes('showControls:false'),'Spine built-in play controls must be disabled');
assert.ok(!player.includes('id="playSaved"')&&!player.includes('id="local"'),'Imported animations should autoplay without extra play buttons');
assert.ok(player.includes("$('characters').onchange=()=>")&&player.includes('playCharacter(c);'),'Dropdown must autoplay the selected character');
assert.ok(page.includes('function drawGroups()')&&page.includes('game-section')&&page.includes('characterKey'),'Missing dynamic game and character classification');
assert.ok(page.includes('id="viewLoading"')&&page.includes('class="view-loading"'),'Missing stable modal loading state');
const showOne=gallerySource.slice(gallerySource.indexOf('function showOne(id){'),gallerySource.indexOf('function navigate(step){'));
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
assert.ok(player.includes('spine-theater-layout.css?v=20261021-loading-speed-v5'),'Layout stylesheet version must invalidate cached pre-AzurLane stage CSS');
assert.ok(theaterCSS.includes('grid-auto-rows:max-content')&&theaterCSS.includes('min-height:188px'),'Grid rows and cards must have non-collapsing heights');
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

const azure=JSON.parse(read('data/live2d-azurlane.json'));
assert.equal(azure.characters.length,242,'Azur Lane should index 178 baseline plus 64 unique additional skins');
assert.equal(new Set(azure.characters.map(c=>c.id)).size,242,'Azur Lane model skin ids must be distinct');
for(const c of azure.characters){
  assert.equal(c.gameId,'azurlane');
  assert.equal(c.engine,'cubism');
  assert.match(c.id,/^al-[a-z0-9_]+$/);
  assert.match(c.modelUrl,/\/live2d\/([a-zA-Z0-9_]+)\/\1\.model3\.json$/,'Cubism model must reference its own skin');
  assert.ok(/88cb6e56a0ad472fe7e546509f096545d2bbc5b9|1befbb04aba3ca8a7dd9e6c8907e71d09025f2c3/.test(c.modelUrl),'Cubism source files must be pinned to audited commits');
  if(c.preview){
    assert.ok(['upstream-ship-thumbnail','matching-live2d-animation-frame'].includes(c.previewSource),'Unverified Azur Lane preview: '+c.id);
    if(c.previewSource==='upstream-ship-thumbnail')
     assert.ok(c.preview.endsWith('/'+c.skinCode+'.png'),'Azur Lane preview cannot borrow another skin thumbnail');
    else {
     assert.equal(c.preview,'./assets/animation-previews/azurlane-'+c.id+'.webp','Live2D preview must match the exact skin');
     assert.ok(fs.existsSync(path.join(root,c.preview)),'Live2D model screenshot missing: '+c.id);
    }
  }
}
const live2dFrame=read('azurlane-stage.html');
const cubismModules=["assets/js/live2d/state-and-viewport.js","assets/js/live2d/model-loader.js","assets/js/live2d/bootstrap.js"];
const cubismSource=cubismModules.map(read).join('\n');
for(const file of cubismModules){
 assert.ok(live2dFrame.includes('./'+file+'?v='),'Cubism page missing versioned module: '+file);
 new Function(read(file));
}
assert.ok(live2dFrame.includes('./assets/live2d-stage.css?v=20261021-modules-v1'),'Cubism style must be an external module');
assert.ok(cubismSource.includes('PIXI.live2d.Live2DModel.fromSync'),'Azur Lane needs a real Cubism renderer, not an image swap');
assert.ok(read('assets/js/live2d/runtime-loader.js').includes('88cb6e56a0ad472fe7e546509f096545d2bbc5b9'),'Cubism runtime must be pinned');
assert.ok(player.includes('value="azurlane"')&&player.includes("c.gameId==='azurlane'"),'Azur Lane must be a regular selection in the dynamic theater');
assert.ok(player.includes('azurlaneFrame')&&player.includes('azurlane-stage.html')&&player.includes('sendAzurLane('),'Live2D must open inside the same player panel and support controls');
assert.ok(read('assets/spine-theater-layout.css').includes('.azurlane-live2d-frame'),'Cubism stage must fit existing responsive player area');
assert.ok(player.includes('bd2CatalogUrl')&&player.includes('value="browndust2"'),'Missing complete BD2 loader and game selection');
assert.ok(player.includes('value="konosuba"')&&player.includes("c.skeletonFormat==='json'"),'New game and external JSON Spine support missing');
assert.ok(spine.characters.filter(c=>c.gameId==='bluearchive').length>=179,'Blue Archive lobby expansion missing');
assert.equal(spine.characters.filter(c=>c.gameId==='konosuba').length,126,'KonoSuba first batch must contain 126 distinct models');
assert.equal(new Set(spine.characters.filter(c=>c.gameId==='konosuba').map(c=>c.characterName)).size,67,'KonoSuba names must include 67 characters');
assert.ok(player.includes('id="bd2CharacterFilter"'),'BD2 character-to-costume filter is missing');
assert.ok(player.includes("c.gameId==='bluearchive'||c.gameId==='browndust2'"),'BD2 must not use NIKKE legacy mirror');

assert.ok(player.includes('binaryUrl')&&player.includes('atlasUrl'),'Spine runtime URL fix missing');
assert.ok(player.includes('indexedDB.open(cacheDB'),'Spine cache missing');
assert.ok(!/<iframe\b/i.test(player),'Third-party iframe not allowed');
console.log('PASS: '+chars.characters.length+' classified static artworks across '+new Set(chars.characters.map(x=>x.gameId)).size+' games; '+spine.characters.length+' external Spine entries.');

// Guard against accidentally double-escaped Spine version regexps.
// A prior regression rejected valid 3.8 export headers before playback began.
const playerSource=spineSource;
const versionCheck=playerSource.match(/if\(!\/(\^.*?)\/\.test\(version\|\|''\)\)/);
assert.ok(versionCheck,'Missing Spine export-version validation');
const versionRegexp=new RegExp(versionCheck[1]);
assert.ok(versionRegexp.test('3.8.99'),'Spine version regex rejects valid 3.8 export');
assert.ok(versionRegexp.test('4.1.24'),'Spine version regex rejects valid 4.1 export');
assert.ok(!versionRegexp.test('unrecognized'),'Spine version regex accepted invalid export');

// Module integration contract: all modules must be present, parse, and execute in order.
const galleryHTML=read('characters.html'),spineHTML=read('spine.html');
for(const [html,modules] of [[galleryHTML,galleryModules],[spineHTML,spineModules]]){
 const loaded=[...html.matchAll(/<script defer src="\.\/([^"?]+)\?v=[^"]+"><\/script>/g)].map(x=>x[1]);
 assert.deepEqual(loaded,[...(modules[0]?.startsWith('assets/js/spine/')?['assets/js/shared/asset-sources.js','assets/js/shared/voice-playback.js']:[]),...modules.slice(0,3),...(modules[0]?.startsWith('assets/js/spine/')?['assets/js/spine/performance.js']:[]),...modules.slice(3),'assets/js/shared/friend-links.js',...(modules[0]?.startsWith('assets/js/spine/')?['assets/js/spine/character-audio.js','assets/js/spine/desktop-launch.js','assets/js/spine/desktop-drag.js']:[])],'Browser modules and common friend links must preserve loading order');
 assert.ok(!/<script>\s*['"]use strict/.test(html),'Page-level application logic must live in feature modules');
}
for(const item of ['assets/gallery-base.css','assets/gallery-theme.css','assets/spine-base.css','assets/spine-theme.css']){
 assert.ok(fs.existsSync(path.join(root,item)),'Extracted CSS is missing: '+item);
 assert.ok(read(item).length>100,'Extracted CSS is empty: '+item);
}

assert.ok(!/<script>\s*['\"]use strict/.test(read('azurlane-stage.html')),'Cubism page must not contain application code');

const extra=JSON.parse(read('data/spine-newgames.json'));
const expectedNew={girlsfrontline:297,konosuba:61,arknights:359};
assert.equal(extra.characters.length,717,'New model index should contain 717 entries');
const allIds=new Set([...spine.characters.map(x=>x.id),...azure.characters.map(x=>x.id),...bd2Full.characters.map(x=>x.id)]);
for(const c of extra.characters){
 assert.ok(!allIds.has(c.id),'Duplicate model ID across catalogs: '+c.id);
 allIds.add(c.id);
 assert.ok(['girlsfrontline','konosuba','arknights'].includes(c.gameId));
 if(c.preview){
  assert.equal(c.preview,'./assets/animation-previews/'+c.gameId+'-'+c.id+'.webp','Preview must be exact-model screenshot');
  assert.equal(c.previewSource,c.engine==='cubism'?'matching-live2d-animation-frame':'matching-spine-animation-frame');
  assert.equal(c.status,'browser-preview-captured');
  const fp=path.join(root,c.preview);
  assert.ok(fs.existsSync(fp),'Matching model preview not present: '+c.id);
  const image=fs.readFileSync(fp);
  assert.ok(image.length>500&&image.toString('ascii',0,4)==='RIFF'&&image.toString('ascii',8,12)==='WEBP','Invalid generated WebP: '+c.id);
 }else assert.equal(c.status,'unverified-playback','Missing screenshot must retain unverified status');
 if(c.engine==='cubism'){
  assert.ok(c.modelUrl.startsWith('https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model@7e446cbd95ec352cdb0f73c079e4d075d7d528ac/'));
  assert.ok(c.modelUrl.endsWith('.model3.json')&&c.skinCode);
 }else{
  assert.equal(c.gameId,'arknights');
  assert.ok(c.base.includes('1fb77e6c00310c155d2c368bdc8872be973f2739'));
  assert.equal(c.assetType,'battle-spine');
  assert.ok(c.resourceStem);
 }
}
for(const [game,count] of Object.entries(expectedNew))
 assert.equal(extra.characters.filter(x=>x.gameId===game).length,count,'Unexpected import count for '+game);
assert.ok(spineHTML.includes('value="girlsfrontline"')&&spineHTML.includes('value="arknights"'),'New game filters not connected');
assert.ok(spineSource.includes('newGamesCatalogUrl')&&spineSource.includes('visibleCardLimit+=96'),'New game loading/pagination missing');


// Same source and placement on the gallery footer and desktop-visible theater stage.
const friendSource=read('assets/js/shared/friend-links.js');
new Function(friendSource);
for(const html of [galleryHTML,spineHTML]){
 assert.ok(html.includes('data-friend-links'),'Friend links are missing from a page');
 assert.ok(html.includes('assets/js/shared/friend-links.js?v='),'Shared friend-link renderer is not loaded');
}
assert.ok(archiveShellCSS.includes('.archive-friendlinks--stage'),'Theater friends footer is not styled');


// WebGL GPU diagnostics and background-work throttling must be available to both engines.
assert.ok(spineHTML.includes('id="gpuStatus"')&&spineHTML.includes('assets/js/spine/performance.js?v='),'GPU status panel missing');
const gpuPerf=read('assets/js/spine/performance.js');
new Function(gpuPerf);
assert.ok(gpuPerf.includes('visibilitychange')&&gpuPerf.includes('rendererFromGL'),'GPU and background-state diagnostics missing');
assert.ok(spineSource.includes('recordSpineFrame')&&spineSource.includes('spineGraphicsStatus'),'Spine GPU report hook is missing');
assert.ok(read('assets/js/live2d/model-loader.js').includes('graphicsReport()'),'Cubism GPU report hook is missing');
assert.ok(read('assets/js/live2d/bootstrap.js').includes("powerPreference:'high-performance'"),'Cubism GPU preference missing');


// Playback needs HiDPI backing pixels instead of stretching a 1x canvas.
const cubismRenderer=read('assets/js/live2d/bootstrap.js');
assert.ok(cubismRenderer.includes('autoDensity:true')&&cubismRenderer.includes('resolution:renderResolution'),
 'Live2D must render at device pixel density');
assert.ok(!cubismRenderer.includes('resolution:1,'),'Live2D low-resolution rendering regression');
assert.ok(read('assets/js/spine/performance.js').includes('canvasRenderQuality'),'Spine canvas resolution diagnostics missing');


// Spine 4.x must zoom in 3D camera space rather than enlarge a rasterized canvas.
assert.ok(read('assets/js/spine/viewer-controls.js').includes('applySharpSpineCamera'),
 'Native-resolution Spine camera zoom missing');
assert.ok(read('assets/js/spine/spine-runtime.js').includes('update:(p)=>applySharpSpineCamera(p)'),
 'Spine Player is not using native camera draw callback');


// Loading one game's manifest must never block unrelated games, and engine
// compatibility must be shared instead of a game-specific include list.
const catalogBootstrap=read('assets/js/spine/bootstrap.js');
assert.ok(catalogBootstrap.includes('Promise.allSettled')&&catalogBootstrap.includes("cache:'no-cache'"),
 'Animation catalogs should load in parallel and revalidate mutable manifests');
assert.ok(catalogBootstrap.includes('isPlayableAnimationEntry')&&!catalogBootstrap.includes("c.gameId==='arknights'&&c.base"),
 'Spine/Cubism catalog validation should not depend on individual game IDs');


// Recently played verified models may remain in a strictly bounded RAM cache.
assert.ok(read('assets/js/spine/playback.js').includes('recentSpinePack(packId)'),
 'Repeated selection must consult bounded RAM cache before IndexedDB');
assert.ok(read('assets/js/spine/session-cache.js').includes('hotPackLimit'),
 'Hot model cache must enforce a fixed memory budget');


// Real Arknights illustrated Spine rigs and BattleFront sprites must not mix.
const illustCatalog=JSON.parse(read('data/spine-arknights-illust.json'));
assert.equal(illustCatalog.characters.length,92);
assert.equal(extra.characters.filter(c=>c.gameId==='arknights'&&c.collectionId==='arknights-battle').length,359);
assert.ok(illustCatalog.characters.every(c=>c.gameId==='arknights'&&c.collectionId==='arknights'&&
 c.assetType==='dynamic-illustration-spine'&&c.base.includes('/models_illust/')&&
 (!c.preview||(c.preview==='./assets/animation-previews/arknights-'+c.id+'.webp'&&
 c.previewSource==='matching-spine-animation-frame'))));
assert.ok(spineHTML.includes('value="arknights-battle"')&&spineHTML.includes('value="arknights"'));
assert.ok(read('assets/js/spine/catalog.js').includes('function animationCollection(c)'));
assert.ok(read('assets/js/spine/bootstrap.js').includes('arknightsIllustCatalogUrl'));


// Selecting a preview may only update visible cards, not rescan all model records.
const animationListModule=read('assets/js/spine/catalog.js');
assert.ok(animationListModule.includes('const maxCachedCharacterCards=420')&&
 animationListModule.includes('const maxCharacterSelectOptions=640'),
 'Animation card cache/hidden select must have explicit resource budgets');
assert.ok(animationListModule.includes('card.dataset.characterId===selectedId')&&
 !animationListModule.slice(animationListModule.indexOf('function refreshCardSelection(){'),
  animationListModule.indexOf('// Keep a refreshable deep link')).includes('allCharacters.filter'),
 'Selection highlights should not rescan all games');
assert.ok(animationListModule.includes('indexedCharacterSearch(c)'),'Search tokens must be cached per model');


// Per-model preview failure reasons are independent of game type and must
// never pass off an upstream thumbnail as a rendered model preview.
const previewDiag=read('scripts/preview_diagnostics.py');
assert.ok(previewDiag.includes('def failure_category')&&
 previewDiag.includes('def read_capture_failures'));
assert.ok(read('scripts/merge_newgame_previews.py').includes("'failedCaptures': failed_records"));
assert.ok(read('assets/js/spine/catalog.js').includes('c.previewFailureReason'));



const legacyNativeImporter=read('native-desktop/Open-ArchiveCharacter.ps1');
const nativeArchiveBridge=read('native-desktop/NativeArchiveBridge.cs');
const nativeBuildWorkflow=read('.github/workflows/native-spinepet-windows.yml');
assert.ok(legacyNativeImporter.includes('function Assert-NativeSpine41'), 'Legacy native importer must inspect actual .skel version');
assert.ok(!legacyNativeImporter.includes('$entry.spineVersion') && !legacyNativeImporter.includes('$entry.versionUnverified'),
 'Legacy native importer must not gate by stale catalog version flags');
assert.ok(nativeArchiveBridge.includes('SpineSkeletonCompatibility.EnsureSupported(skeletonTemp)'),
 'Native bridge must validate actual model with upstream Spine parser');
assert.ok(nativeArchiveBridge.includes('检测到已注册的旧版或其他位置的桌面立绘启动程序'),
 'New native app must ask before replacing an old Windows protocol handler');
assert.ok(nativeBuildWorkflow.includes('-CharacterId c113_01 -ValidateOnly'),
 'Windows CI must validate historically misclassified c113_01 against real skeleton bytes');


const nativeBd2Adapter=read('native-desktop/NativeBrownDust2Bridge.cs');
const desktopLaunch=read('assets/js/spine/desktop-launch.js');
assert.ok(nativeArchiveBridge.includes('game=browndust2&id=') &&
 nativeArchiveBridge.includes('EnsureBrownDust2DownloadedAsync(id)'),
 'Native protocol must route BD2 to separate pinned import adapter');
assert.ok(nativeBd2Adapter.includes('SpineSkeletonCompatibility.EnsureSupported(stagedSkeleton)') &&
 nativeBd2Adapter.includes('TrustedBrownDust2'),
 'New game importer must enforce both actual Spine 4.1 parse and pinned source origin');
assert.ok(desktopLaunch.includes('animecharacter://open?game=browndust2&id=') &&
 desktopLaunch.includes('spine-bd2-characters.json'),
 'Website must send selected BD2 ID to native application');
assert.ok(spineHTML.includes('desktop-launch.js?v=20261022-bd2-native-v1'),
 'Site must bust previously cached single-game launcher');
const bd2IdPattern=/^bd2-char[0-9]{6}(?:_c)?$/;
const bd2Origin='https://raw.githubusercontent.com/Zormolo/Brown-Dust-2-Assets/94a3ac97b8fab7ee054e0826de7d912de0a233ef/assets/spine/character/';
for(const model of bd2Full.characters){
 assert.ok(bd2IdPattern.test(model.id),'Cannot safely route BD2 id: '+model.id);
 const relative=model.base.slice(bd2Origin.length);
 assert.ok(model.base.startsWith(bd2Origin) &&
  /^[A-Za-z0-9_'-]+\/[A-Za-z0-9_'-]+\/char[0-9]{6}(?:_c)?$/.test(relative) &&
  relative.endsWith('/'+model.id.slice(4)),
  'BD2 model must match exact immutable source and skeleton stem: '+model.id);
}
