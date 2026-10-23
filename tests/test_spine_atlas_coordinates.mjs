import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const {parsePageSizes,applyCoordinateSpace}=createRequire(import.meta.url)('../assets/js/shared/spine-atlas-coordinates.js');
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
