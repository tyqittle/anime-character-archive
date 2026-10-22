import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const vendor=fs.readFileSync(new URL('../vendor/spine38/spine-player.js',import.meta.url),'utf8');
const segment=vendor.slice(vendor.indexOf('var BinaryInput ='),vendor.indexOf('\n\tvar LinkedMesh ='));
const ctx=vm.createContext({TextDecoder,DataView,Uint8Array});
vm.runInContext(segment,ctx);
function encode(value){
 if(value===null)return [0];
 const bytes=Buffer.from(value,'utf8'),varint=[];let size=bytes.length+1;
 do{const part=size&127;size>>>=7;varint.push(part|(size?128:0))}while(size);
 return [...varint,...bytes];
}
test('legacy Spine binary strings decode CJK, accents and supplementary Unicode',()=>{
 const values=['ascii','바다보기누나(Sample02)','中文立绘','éè','😀',null,''];
 const data=Uint8Array.from(values.flatMap(encode)),reader=new ctx.BinaryInput(data);
 assert.deepEqual(values.map(()=>reader.readString()),values);
 assert.equal(reader.index,data.length);
});
test('legacy binary reader respects typed-array byte offsets',()=>{
 const encoded=encode('模型');const padded=Uint8Array.from([255,255,...encoded,255]);
 const reader=new ctx.BinaryInput(padded.subarray(2,padded.length-1));
 assert.equal(reader.readString(),'模型');assert.equal(reader.index,encoded.length);
});
test('signed numeric bytes retain negative Spine bend directions',()=>{
 assert.equal(new ctx.BinaryInput(Uint8Array.from([255])).readByte(),-1);
});
