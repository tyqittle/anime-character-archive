import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const {parsePageSizes,applyCoordinateSpace,coalesceAtlasPages}=createRequire(import.meta.url)('../assets/js/shared/spine-atlas-coordinates.js');
test('explicit source page merging preserves all unique regions and rejects conflicting page or region data',()=>{
 const header='page.png\nsize: 512,512\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\n';
 const source=header+'face\n  xy: 1,2\n\n'+header+'glasses\n  xy: 3,4\n';
 assert.throws(()=>parsePageSizes(source),/Duplicate/);
 const merged=coalesceAtlasPages(source);assert.equal(merged.mergedPages,1);assert.equal(parsePageSizes(merged.text).size,1);
 assert.ok(merged.text.includes('face\n'));assert.ok(merged.text.includes('glasses\n'));
 assert.throws(()=>coalesceAtlasPages(source.replace('glasses','face')),/Conflicting duplicate atlas region/);
 assert.throws(()=>coalesceAtlasPages(source.replace(/512,512(?=[\s\S]*glasses)/,'256,256')),/Conflicting duplicate atlas page/);
});
function fixture(width=200,height=150){
 const sandbox={console};vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(new URL('../vendor/spine38/spine-player.js',import.meta.url),'utf8'),sandbox);
 const runtime=sandbox.spine;
 const text=['page.png','size: 400,300','format: RGBA8888','filter: Linear,Linear','repeat: none',
  ...[0,90,180,270].flatMap(deg=>['region'+deg,'  rotate: '+deg,'  xy: 30,40','  size: 40,20','  orig: 60,50','  offset: 10,15','  index: -1'])].join('\n');
 const image={width,height},texture={getImage:()=>image,setFilters(){},setWraps(){}};
 const atlas=new runtime.TextureAtlas(text,()=>texture);
 const meshes=atlas.regions.map((region,i)=>{const mesh=new runtime.MeshAttachment('mesh'+i);mesh.region=region;mesh.regionUVs=new Float32Array([0,0,.25,.5,1,1]);mesh.updateUVs();return mesh;});
 const skin={getAttachments:()=>meshes.map(attachment=>({attachment}))};
 const skeleton={slots:[],data:{skins:[skin]}};
 return {runtime,atlas,atlasText:text,skeleton,meshes,image};
}
function values(mesh){return Array.from(mesh.uvs)}
function close(actual,expected){assert.equal(actual.length,expected.length);actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-6,i+': '+v+' != '+expected[i]));}

test('explicit coordinate policy corrects resized textures for all rotations and trimmed meshes',()=>{
 const reference=fixture(400,300),scaled=fixture(200,150);
 applyCoordinateSpace({...reference,mode:'declared'});
 const result=applyCoordinateSpace({...scaled,mode:'declared'});
 assert.equal(result.changedPages,1);assert.equal(result.attachments,4);
 scaled.meshes.forEach((mesh,i)=>close(values(mesh),values(reference.meshes[i])));
 assert.equal(scaled.atlas.pages[0].width,200,'GPU image dimensions are preserved');
 assert.deepEqual(scaled.image,{width:200,height:150});
});
test('anisotropic source scaling uses independent atlas axes',()=>{
 const reference=fixture(400,300),scaled=fixture(400,256);
 applyCoordinateSpace({...reference,mode:'declared'});applyCoordinateSpace({...scaled,mode:'declared'});
 scaled.meshes.forEach((mesh,i)=>close(values(mesh),values(reference.meshes[i])));
});
test('unmarked atlases remain native and repeated UV updates remain stable',()=>{
 const native=fixture(),corrected=fixture();
 const before=native.meshes.map(values);
 applyCoordinateSpace({...native,mode:'texture'});
 native.meshes.forEach((mesh,i)=>close(values(mesh),before[i]));
 applyCoordinateSpace({...corrected,mode:'declared'});const once=corrected.meshes.map(values);
 corrected.meshes.forEach(mesh=>mesh.updateUVs());
 applyCoordinateSpace({...corrected,mode:'declared'});
 corrected.meshes.forEach((mesh,i)=>close(values(mesh),once[i]));
});
test('coordinate policy repairs inactive skin attachments and future linked meshes',()=>{
 const f=fixture();applyCoordinateSpace({...f,mode:'declared'});
 const linked=f.meshes[0].newLinkedMesh();
 close(values(linked),values(f.meshes[0]));
});
test('invalid or incomplete declared metadata fails before atlas mutation',()=>{
 for(const text of ['page.png\nformat: RGBA8888','page.png\nsize: 20,20']){
  const f=fixture(),before=f.atlas.regions.map(r=>[r.u,r.v,r.u2,r.v2]);
  assert.throws(()=>applyCoordinateSpace({...f,atlasText:text,mode:'declared'}),/dimensions|exceeds/);
  assert.deepEqual(f.atlas.regions.map(r=>[r.u,r.v,r.u2,r.v2]),before);
 }
});
test('multi-page declarations respect page boundaries, BOM and CRLF',()=>{
 const sizes=parsePageSizes('\uFEFFone.png\r\nsize: 400,300\r\nformat: RGBA8888\r\nregion\r\n size: 5,6\r\n\r\ntwo.png\r\nsize: 100,200');
 assert.deepEqual([...sizes],[['one.png',{width:400,height:300}],['two.png',{width:100,height:200}]]);
});

test('one-pixel packed edge extrusion is accepted, larger overflow is rejected',()=>{
 const edge=fixture();edge.atlas.regions[0].y=281;
 assert.doesNotThrow(()=>applyCoordinateSpace({...edge,mode:'declared'}));
 const overflow=fixture();overflow.atlas.regions[0].y=282;
 assert.throws(()=>applyCoordinateSpace({...overflow,mode:'declared'}),/exceeds/);
});

test('an explicitly audited two-pixel source border stays local to its atlas',()=>{
 const edge=fixture();edge.atlas.regions[0].y=282;
 assert.doesNotThrow(()=>applyCoordinateSpace({...edge,mode:'declared',edgeExtrusion:2}));
 const ordinary=fixture();ordinary.atlas.regions[0].y=282;
 assert.throws(()=>applyCoordinateSpace({...ordinary,mode:'declared'}),/exceeds/);
 const tooFar=fixture();tooFar.atlas.regions[0].y=283;
 assert.throws(()=>applyCoordinateSpace({...tooFar,mode:'declared',edgeExtrusion:2}),/exceeds/);
 const exact=fixture();exact.atlas.regions[0].y=281;
 assert.throws(()=>applyCoordinateSpace({...exact,mode:'declared',edgeExtrusion:0}),/exceeds/);
});

test('invalid source border declarations fail before changing UVs or runtime',()=>{
 for(const edgeExtrusion of [-1,3,1.5,'2',null,NaN]){
  const f=fixture(),before=f.atlas.regions.map(r=>[r.u,r.v,r.u2,r.v2]);
  assert.throws(()=>applyCoordinateSpace({...f,mode:'declared',edgeExtrusion}),/edge extrusion/i);
  assert.deepEqual(f.atlas.regions.map(r=>[r.u,r.v,r.u2,r.v2]),before);
  assert.equal(f.runtime.MeshAttachment.prototype.__archiveCoordinateSpace,undefined);
 }
});
