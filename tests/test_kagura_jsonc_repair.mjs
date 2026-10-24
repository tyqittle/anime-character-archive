import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSourceSettings} from '../scripts/cubism_source_settings.mjs';
test('Only opted-in Kagura Cubism2 source punctuation is repaired',()=>{
 const malformed='{"model":"x.moc","textures":["t.png"],"motions":{"idle":[{"file":"idle.mtn","fade_out":0    "lip_offset":1.0}]}}';
 assert.throws(()=>parseSourceSettings(malformed,true),SyntaxError);
 const repaired=parseSourceSettings(malformed,true,true);
 assert.equal(repaired.motions.idle[0].lip_offset,1);
 assert.equal(repaired.motions.idle[0].fade_out,0);
});
test('Opted-in punctuation repair does not turn arbitrary broken JSON into valid settings',()=>{
 assert.throws(()=>parseSourceSettings('{"model":"x.moc"  "textures":["t.png"]}',true,true),SyntaxError);
 assert.throws(()=>parseSourceSettings('{"model":"x.moc"}; process.exit(1)',true,true),SyntaxError);
});
