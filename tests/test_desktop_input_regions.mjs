import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {runs}=createRequire(import.meta.url)('../assets/js/shared/desktop-alpha-mask.js');
test('opaque scenery stays visible while only source interaction regions take mouse input',()=>{
 const pixels=new Uint8Array(12*12*4).fill(255);
 const rectangles=runs(pixels,12,12,1,[[3,2,4,5],[5,4,3,5]]);
 const contains=(x,y)=>rectangles.some(([l,t,w,h])=>x>=l&&x<l+w&&y>=t&&y<t+h);
 assert.equal(contains(1,1),false);
 assert.equal(contains(4,3),true);
 assert.equal(contains(7,8),true);
 assert.equal(contains(10,10),false);
 assert.ok(pixels.every(x=>x===255),'Input policy cannot erase background artwork');
});
test('an empty or offscreen interaction mask creates no desktop input window',()=>{
 const pixels=new Uint8Array(16).fill(255);
 assert.deepEqual(runs(pixels,2,2,1,[]),[]);
 assert.deepEqual(runs(pixels,2,2,1,[[100,100,10,10]]),[]);
 assert.deepEqual(runs(pixels,2,2),[[0,0,2,2]]);
});
