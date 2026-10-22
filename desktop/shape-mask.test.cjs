'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {shapeFromBGRA}=require('./shape-mask.cjs');
function sample(width,height){
 const data=Buffer.alloc(width*height*4,255);
 const paint=(x,y,r,g,b,a=255)=>{
  const i=(y*width+x)*4;
  data[i]=b;data[i+1]=g;data[i+2]=r;data[i+3]=a;
 };
 return {data,paint};
}
function contains(rects,x,y){
 return rects.some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);
}
test('native region hides an opaque white desktop backplate',()=>{
 const {data,paint}=sample(100,70);
 for(let y=16;y<55;y++)for(let x=32;x<61;x++)paint(x,y,85,70,150);
 const mask=shapeFromBGRA(data,100,70,1000,700);
 assert.ok(mask);
 assert.ok(mask.rects.length>0);
 assert.equal(contains(mask.rects,20,20),false);
 assert.equal(contains(mask.rects,440,350),true);
 assert.ok(mask.coverage<.5);
});
test('transparent non-character pixels are excluded',()=>{
 const {data,paint}=sample(90,80);
 for(let y=0;y<80;y++)for(let x=0;x<90;x++)paint(x,y,0,0,0,0);
 for(let y=25;y<55;y++)for(let x=35;x<55;x++)paint(x,y,40,60,160);
 const mask=shapeFromBGRA(data,90,80,900,800);
 assert.ok(mask);
 assert.equal(contains(mask.rects,20,20),false);
 assert.equal(contains(mask.rects,445,405),true);
});
test('blank white frame never exposes fullscreen white rectangle',()=>{
 const {data}=sample(200,120);
 assert.equal(shapeFromBGRA(data,200,120,1920,1080),null);
});
test('suspiciously filled whole screen fails closed',()=>{
 const {data,paint}=sample(100,100);
 for(let y=0;y<100;y++)for(let x=0;x<100;x++)paint(x,y,10,10,10);
 // Solid backgrounds should not be treated as a character.
 assert.equal(shapeFromBGRA(data,100,100,1000,1000),null);
});
test('bad dimensions and buffers fail closed',()=>{
 assert.equal(shapeFromBGRA(Buffer.alloc(4),200,100,1920,1080),null);
});
