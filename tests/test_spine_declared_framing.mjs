import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {createRequire} from 'node:module';const require=createRequire(import.meta.url);
const ArchivePortraitFraming=require('../assets/js/shared/portrait-framing.js');
test('declared framing excludes effect descendants while retaining their render attachments and legacy behavior',()=>{
 class Region{constructor(vertices){this.vertices=vertices}computeWorldVertices(bone,out){out.set(this.vertices)}}
 class Mesh{}
 const root={data:{name:'root'}},effect={data:{name:'effects'},parent:root};
 const slots=[{bone:root,attachment:new Region([0,0,100,0,100,200,0,200])},{bone:{data:{name:'child'},parent:effect},attachment:new Region([5000,0,6000,0,6000,1000,5000,1000])}];
 const p={skeleton:{slots},_archivePortraitFraming:{excludeBones:['effects']}},ctx=vm.createContext({spine:{RegionAttachment:Region,MeshAttachment:Mesh},ArchivePortraitFraming,p});
 vm.runInContext(fs.readFileSync(new URL('../assets/js/spine/viewer-controls.js',import.meta.url),'utf8'),ctx);
 assert.equal(JSON.stringify(vm.runInContext('declaredSpinePoseBounds(p)',ctx)),JSON.stringify({x:0,y:0,width:100,height:200}));
 p._archiveFitPending=1;p._archiveCameraFrame={};ctx.player=p;
 vm.runInContext('fitRenderedSpinePortrait(p)',ctx);
 assert.equal(p._archiveFraming.source,'declared-pose','Pixel refinement must not reintroduce excluded source effects');
 assert.ok(slots[1].attachment,'Framing must not delete effects or change source rendering');delete p._archivePortraitFraming;
 assert.equal(vm.runInContext('declaredSpinePoseBounds(p)',ctx),null,'Legacy models keep their existing framing');
});
