import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
const records=JSON.parse(fs.readFileSync(new URL('../data/live2d-mature.json',import.meta.url),'utf8')).characters;
const js=fs.readFileSync(new URL('../assets/js/live2d/state-and-viewport.js',import.meta.url),'utf8');
const a=js.indexOf('function modelUrlFor('),b=js.indexOf('const TOUHOU_SOURCE=',a);
assert.ok(a>0&&b>a);
const location={href:'https://archive.example/live2d.html'};
const cx=vm.createContext({URL,location});
vm.runInContext(js.slice(0,a)+js.slice(a,b),cx);
const modelUrl=(c,url=c.modelUrl,name=c.skinCode)=>{
 cx.c=c;cx.url=url;cx.name=name;
 return vm.runInContext('modelUrlFor(name,url,c.id)',cx);
};
test('Every catalog entry has a proper original character model, not an explicit CG scene',()=>{
 const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/pre-encyclopedia-models.json',import.meta.url))).mature;
 for(const id of baseline)assert.ok(records.some(c=>c.id===id),id);
 const checked=['tokyonecro-full-source-audit','tokyonecro-legacy-source-audit','tokyonecro-legacy-nested-source-audit'].map(name=>JSON.parse(fs.readFileSync(new URL('../data/'+name+'.json',import.meta.url))).scopes[0]);
 const expectedByGame={tokyonecro:checked.reduce((sum,a)=>sum+a.checkedModels,0),maidslife:10,lovecube:6,foxhimezero:5};
 assert.equal(records.length,Object.values(expectedByGame).reduce((a,b)=>a+b,0));
 for(const [game,count] of Object.entries(expectedByGame))assert.equal(records.filter(x=>x.gameId===game).length,count,game);
 assert.equal(new Set(records.map(x=>x.id)).size,records.length);
 for(const c of records){
  assert.ok(c.textureBytes>0,c.id);
  if(baseline.includes(c.id))assert.ok(c.textureBytes>650000,c.id);
  // LOVE³ ships character moc3/texture/physics but no independent motion3 files.
  // Preserve the existing motion requirement for every other game.
  if(c.gameId==='lovecube'){
   assert.ok(c.textureBytes>3000000&&c.motionCount===0,c.id);
   // Preview capture upgrades status legitimately; absence of motion3 is
   // independent of whether the physics rig rendered a real preview.
   if(c.preview){
    assert.equal(c.previewSource,'matching-live2d-animation-frame',c.id);
    assert.equal(c.playbackStatus,'browser-preview-captured',c.id);
    assert.match(c.previewSha256,/^[0-9a-f]{64}$/,c.id);
    assert.ok(fs.existsSync(new URL('../'+c.preview.replace(/^\.\//,''),import.meta.url)),c.id);
   }else{
    assert.equal(c.playbackStatus,'not-verified',c.id);
    assert.ok(!c.previewSha256,c.id);
   }
  }else if(baseline.includes(c.id))assert.ok(c.motionCount>0,c.id);
  assert.ok(!c.sourcePath.includes('/adult/'),c.id);
  assert.equal(c.sourceCommit,'7e446cbd95ec352cdb0f73c079e4d075d7d528ac');
  assert.ok(!c.preview||c.previewSource==='matching-live2d-animation-frame',c.id);
 }
});
test('Pinned URL allowlist correctly binds each new character and refuses model switching',()=>{
 for(const c of records){
  assert.equal(modelUrl(c),new URL(c.modelUrl,location.href).href,c.id);
  if(c.normalizedSettingsSha256){
   const file=fs.readFileSync(new URL('../'+c.modelUrl.split('?')[0],import.meta.url));
   assert.equal(createHash('sha256').update(file).digest('hex'),c.normalizedSettingsSha256,c.id);
   assert.ok(c.modelUrl.endsWith('?v='+c.normalizedSettingsSha256),c.id);
   assert.equal(modelUrl(c,c.modelUrl.replace(c.id+'.model',c.id+'-other.model')),'',c.id);
   assert.equal(modelUrl(c,c.modelUrl.replace('?v=','?other=')),'',c.id);
  }else assert.equal(modelUrl(c,c.modelUrl.replace('@'+c.sourceCommit+'/','@main/')),'',c.id);
  assert.equal(modelUrl(c,c.modelUrl.replace(/\.model(3)?\.json/,'/../model.json')),'',c.id);
  assert.equal(modelUrl(c,c.modelUrl,'incorrect-model'),'',c.id);
 }
});
