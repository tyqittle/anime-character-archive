import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {runs}=createRequire(import.meta.url)('../assets/js/shared/desktop-alpha-mask.js');
test('input alpha runs cover every visible pixel exactly once, including thin limbs',()=>{
 for(let seed=1;seed<=16;seed++){
  const width=37,height=29,pixels=new Uint8Array(width*height*4);
  let random=seed;
  for(let p=3;p<pixels.length;p+=4){random=(1664525*random+1013904223)>>>0;pixels[p]=random%5===0?1:random%3===0?255:0}
  const coverage=new Uint8Array(width*height);
  for(const [x,y,w,h] of runs(pixels,width,height))
   for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)coverage[yy*width+xx]++;
  for(let i=0;i<coverage.length;i++)assert.equal(coverage[i],pixels[i*4+3]>0?1:0);
 }
});
test('solid spans merge vertically and transparent pixels stay outside input',()=>{
 const bytes=new Uint8Array(8*9*4);
 for(let y=2;y<8;y++)for(let x=3;x<5;x++)bytes[(y*8+x)*4+3]=255;
 assert.deepEqual(runs(bytes,8,9),[[3,2,2,6]]);
 assert.deepEqual(runs(new Uint8Array(4),1,1),[]);
});
test('invalid input and oversized samples fail before scanning',()=>{
 assert.throws(()=>runs(new Uint8Array(4),0,1));
 assert.throws(()=>runs(new Uint8Array(4),2,2));
 assert.throws(()=>runs(new Uint8Array(321*321*4),321,321));
});
