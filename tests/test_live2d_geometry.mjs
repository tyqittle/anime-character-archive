import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const f=createRequire(import.meta.url)('../assets/js/shared/portrait-framing.js');
test('source geometry outside the declared MOC canvas remains in the fitted portrait',()=>{
 const rectangles=[{x:200,y:50,width:600,height:700},{x:150,y:700,width:700,height:1100}];
 const bounds=f.unionTransformedBounds(rectangles);
 assert.deepEqual(bounds,{x:150,y:50,width:700,height:1750});
 const view=f.cameraFrame({bounds,width:800,height:900});
 assert.ok(bounds.height/view.worldHeight<=.880001);
 assert.equal(view.y,925);
});
test('layout scale, nonzero origin, rotation and invalid meshes are handled before pixel refinement',()=>{
 assert.deepEqual(f.unionTransformedBounds([{x:1,y:2,width:3,height:4}],{a:0,b:2,c:-1,d:0,tx:10,ty:-5}),{x:4,y:-3,width:4,height:6});
 assert.equal(f.unionTransformedBounds([{x:0,y:0,width:NaN,height:2}]),null);
});
