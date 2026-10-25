import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {assetURL,atlasPages,candidates,inspectSkeleton,defaultSourceSkinLayers,attachmentPathRepairs} from '../scripts/import_hosted_spine.mjs';
const scope={assetBase:'https://source.test/',assetPrefix:'/assets/',adapter:'epicseven-units',includedKinds:['unit','npc']};
test('hosted imports constrain references to declared asset origins and exact atlas pages',()=>{
 assert.equal(assetURL(scope,'assets/hero/model.json'),'https://source.test/assets/hero/model.json');
 for(const ref of ['https://other.test/assets/a.json','../secret','assets/%2e%2e/secret','/assets/a.json?x=1'])assert.throws(()=>assetURL(scope,ref));
 assert.deepEqual(atlasPages('\nhero.png\nsize: 2048,2048\n\nhero2.png\nsize: 2048,2048'),['hero.png','hero2.png']);
 assert.deepEqual(atlasPages('\rhero.png\rsize: 2048,2048\r'),['hero.png']);
 assert.throws(()=>atlasPages('../hero.png\nsize: 2048,2048'));
});
test('source adapters enumerate all skins and NPCs without substituting battle assets',()=>{
 const units=[{id:'hero',kind:'unit',spine:[{json:'assets/hero/a.json',atlas:'assets/hero/a.atlas'}]},
 {id:'hero_s01',kind:'unit',variant:'Skin',spine:[{json:'assets/skin/a.json',atlas:'assets/skin/a.atlas'}]},
 {id:'npc',kind:'npc',spine:[{json:'assets/npc/a.json',atlas:'assets/npc/a.atlas'}]},
 {id:'monster',kind:'monster',spine:[{json:'assets/mob/a.json',atlas:'assets/mob/a.atlas'}]}];
 assert.deepEqual(candidates(scope,units).map(x=>x.key),['hero','hero_s01','npc']);
 const leaders=candidates({...scope,adapter:'shadowverse-leaders'}, {groups:{A:['01','02'],B:['02','03']},leaders:{}});
 assert.deepEqual(leaders.map(x=>x.key),['class_1','class_2','class_3']);assert.equal(leaders[1].category,'A / B');
 assert.equal(candidates({...scope,adapter:'shadowverse-leaders'},{groups:{Default:['01','1']},leaders:{}}).length,1);
});
test('static or unsupported exports are reported rather than declared dynamic',()=>{
 const skeleton={skeleton:{spine:'3.8.99'},bones:[{name:'root'}],animations:{idle:{bones:{root:{rotate:[{time:0},{time:2,angle:1}]}}}}};
 assert.deepEqual(inspectSkeleton(Buffer.from(JSON.stringify(skeleton))).animations,['idle']);
 assert.throws(()=>inspectSkeleton(Buffer.from(JSON.stringify({...skeleton,animations:{idle:{}}}))),e=>e.code==='STATIC_SOURCE');
 assert.throws(()=>inspectSkeleton(Buffer.from(JSON.stringify({...skeleton,skeleton:{spine:'3.7.93'}}))),/Unsupported/);
});
test('source body and neutral face layers are composed, with exclusive expression fallback',()=>{
 const d={skins:[{name:'default',attachments:{body:{}}},{name:'normal',attachments:{normal2:{}}},{name:'smile',attachments:{normal2:{}}}]};
 assert.deepEqual(defaultSourceSkinLayers(d,'epicseven-units'),['default','normal']);
 assert.deepEqual(defaultSourceSkinLayers({...d,skins:d.skins.filter(s=>s.name!=='normal')},'epicseven-units'),['default','smile']);
 assert.deepEqual(defaultSourceSkinLayers(d,'shadowverse-leaders'),[]);
});
test('neutral skin is required when idle blink names live outside default skin',()=>{
 const d={animations:{idle:{slots:{face:{attachment:[{name:'face1'},{time:1,name:'face2'}]}}}},skins:[{name:'default',attachments:{face:{face:{}}}},{name:'skin_01',attachments:{face:{face1:{},face2:{}}}}]};
 assert.deepEqual(defaultSourceSkinLayers(d,'shadowverse-leaders'),['default','skin_01']);
 assert.throws(()=>defaultSourceSkinLayers({...d,skins:d.skins.slice(0,1)},'shadowverse-leaders'),/Unresolved/);
});

test('parked effect workspaces affect framing metadata without removing source attachments or animations',()=>{
 const d={skeleton:{spine:'3.8.97'},bones:[{name:'root'},{name:'body',parent:'root',x:4000},{name:'00_effect',parent:'root',x:5000}],animations:{idle:{bones:{body:{rotate:[{time:1,angle:1}]}}}}};
 assert.deepEqual(inspectSkeleton(Buffer.from(JSON.stringify(d)),'shadowverse-leaders').excludeBones,['00_effect']);
 assert.equal(d.bones.length,3);assert.ok(d.animations.idle);
});
test('only uniquely matching trailing-space attachment paths receive explicit source repairs',()=>{
 const bytes=Buffer.from(JSON.stringify({skins:[{name:'default',attachments:{face:{neutral:{path:'neutral '},other:{path:'missing '}}}}]}));
 assert.deepEqual(attachmentPathRepairs(bytes,'\npage.png\nsize: 512,512\nneutral\n  index: -1'),[{skin:'default',slot:'face',name:'neutral',from:'neutral ',to:'neutral'}]);
 assert.deepEqual(attachmentPathRepairs(bytes,'\npage.png\nsize: 512,512\nneutral\n  index: -1\nneutral\n  index: -1'),[]);
});
test('registered hosted source snapshots preserve their exact audited bytes across checkouts',()=>{
 const root=new URL('../',import.meta.url),config=JSON.parse(fs.readFileSync(new URL('data/hosted-spine-source-scopes.json',root),'utf8'));
 for(const scope of config.scopes){const audit=JSON.parse(fs.readFileSync(new URL('data/hosted-spine-source-audit-'+scope.id+'.json',root),'utf8'));
  assert.equal(createHash('sha256').update(fs.readFileSync(new URL(audit.metadataSnapshot,root))).digest('hex'),audit.metadataSha256);
 }
});
