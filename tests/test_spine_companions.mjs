import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {combine,install}=createRequire(import.meta.url)('../assets/js/shared/spine-companions.js');
const pack=(name='front')=>({version:'4.1',skeleton:name+'.skel',atlas:name+'.atlas',rawDataURIs:{[name+'.skel']:'data:application/octet-stream;base64,AQ==',[name+'.atlas']:'data:text/plain,page.png\nsize: 32,32\nbody\nbounds: 0,0,32,32','page.png':'data:image/png;base64,AAAA'}});
test('composite textures and regions cannot overwrite the primary model, even when filenames match',()=>{
 const front=pack(),back=pack('back'),before=JSON.stringify(front);const result=combine(front,[back]);
 assert.equal(JSON.stringify(front),before);assert.equal(result.rawDataURIs['page.png'],front.rawDataURIs['page.png']);
 assert.ok(result.rawDataURIs['__archive_layer_0_page.png']);assert.ok(result.rawDataURIs['front.atlas'].includes('__archive_layer_0_body'));
 assert.ok(result.companions[0].atlasText.includes('\nbody\n'));assert.equal(combine(front,[]),front);
 assert.throws(()=>combine(front,[{...back,version:'3.8'}]),/Unsupported/);
});
test('composite layers share rendering, camera bounds, action time and disposal with their owning player',()=>{
 const vector=class{constructor(x=0,y=0){this.x=x;this.y=y}set(x,y){this.x=x;this.y=y}};
 const data={skins:[{name:'default'}],animations:[{name:'Idle_Stand'},{name:'Touch1'}],findSkin(){return this.skins[0]},findAnimation(n){return this.animations.find(a=>a.name===n)}};
 class Skeleton{constructor(d){this.data=d}setSkin(){}setSlotsToSetupPose(){}updateWorldTransform(){}getBounds(o,s){o.set(-10,-20);s.set(20,30)}}
 class AnimationState{constructor(){this.entry=null}getCurrent(){return this.entry}setAnimation(_track,name,loop){return this.entry={animation:{name},loop,trackTime:0}}update(dt){this.entry.trackTime+=dt}apply(){}clearTracks(){this.cleared=true}}
 const runtime={Vector2:vector,TextureAtlas:class{constructor(){this.pages=[{name:'back.png',setTexture(){}}]}},AtlasAttachmentLoader:class{},SkeletonJson:class{readSkeletonData(){return data}},Skeleton,AnimationState,AnimationStateData:class{},Skin:class{addSkin(){}}};
 const draws=[],main={getBounds(o,s){o.set(0,0);s.set(10,10)}},primary={animation:{name:'Touch1'},loop:false,trackTime:2.5};let disposed=0;
 const p={skeleton:main,assetManager:{get:()=>({pages:[{name:'back.png',texture:{}}]})},config:{atlasUrl:'main.atlas',rawDataURIs:{'back.json':'data:application/json,{}'}},animationState:{getCurrent:()=>primary},sceneRenderer:{drawSkeleton:s=>draws.push(s)},dispose:()=>disposed++};
 const originalDraw=p.sceneRenderer.drawSkeleton,originalBounds=main.getBounds;
 const session=install(p,[{atlasText:'',skeleton:'back.json',format:'json',idle:'Idle_Stand'}],runtime);
 session.update(.1);const part=session.layers[0];assert.equal(part.state.getCurrent().animation.name,'Touch1');assert.equal(part.state.getCurrent().trackTime,2.5);assert.equal(part.state.getCurrent().loop,false);
 p.sceneRenderer.drawSkeleton(main);assert.deepEqual(draws,[part.skeleton,main]);
 const o=new vector(),s=new vector();main.getBounds(o,s);assert.deepEqual([o.x,o.y,s.x,s.y],[-10,-20,20,30]);
 primary.animation.name='MainOnlyAction';session.update(.1);assert.equal(part.state.getCurrent().animation.name,'Idle_Stand');assert.equal(part.state.getCurrent().loop,true);
 primary.animation.name='Idle_Stand';primary.loop=true;primary.trackTime=.25;session.update(.2);assert.equal(part.state.getCurrent().trackTime,.25);
 const state=part.state;p.dispose();assert.equal(disposed,1);assert.equal(state.cleared,true);assert.equal(p.sceneRenderer.drawSkeleton,originalDraw);assert.equal(main.getBounds,originalBounds);assert.equal(p._archiveCompanionSession,null);session.update(10);session.dispose();assert.equal(session.layers.length,0);
 assert.equal(install(p,undefined,runtime),null);
});
