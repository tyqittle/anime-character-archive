import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRenderedFrames} from '../scripts/animation_frame_check.mjs';
const frame=(width,height,pixel)=>({width,height,data:Uint8Array.from(Array.from({length:width*height},(_,i)=>pixel(i)).flat())});
test('first paint is not counted as animation',()=>{
 const blank=frame(30,30,()=>[20,34,56,255]);
 const drawn=frame(30,30,i=>i<450?[20,34,56,255]:[220,140,170,255]);
 const result=compareRenderedFrames(blank,drawn);
 assert.equal(result.visible,0);assert.equal(result.moving,450);
});
test('motion requires two visible character frames',()=>{
 const a=frame(30,30,i=>i<450?[20,34,56,255]:[220,140,170,255]);
 const b=frame(30,30,i=>i<450?[20,34,56,255]:[110,240,110,255]);
 assert.deepEqual(compareRenderedFrames(a,b),{visible:450,moving:450});
 assert.deepEqual(compareRenderedFrames(a,a),{visible:450,moving:0});
});
test('different image dimensions cannot yield a valid comparison',()=>{
 assert.deepEqual(compareRenderedFrames(frame(1,1,()=>[0,0,0,255]),frame(2,1,()=>[0,0,0,255])),{visible:0,moving:0});
});
