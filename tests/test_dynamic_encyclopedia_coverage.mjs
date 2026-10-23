import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCoverage} from '../scripts/dynamic_encyclopedia_coverage.mjs';
test('source completeness cannot certify game completeness or hide unindexed skins',()=>{
 const records=[{id:'one',gameId:'g'},{id:'battle',gameId:'g',assetType:'battle-spine'}];
 const source={gameId:'g',sourceModelSettings:3,indexedModelSettings:1,scopeComplete:false,unindexedSourceSettings:[{path:'skin-two'},{path:'skin-three'}]};
 const report=buildCoverage(records,[source],[],{}).games[0];
 assert.equal(report.indexedPortraits,1);assert.equal(report.battleModels,1);
 assert.equal(report.sourceScopes[0].unindexedSettings.length,2);
 assert.equal(report.gameCompleteness,'not-verified');
 const complete=buildCoverage(records,[{...source,scopeComplete:true}],[],{}).games[0];
 assert.equal(complete.sourceScopes[0].sourceDirectoryComplete,true);
 assert.equal(complete.gameCompleteness,'not-verified');
});
test('a curated Spine list remains incomplete even if every selected model loaded',()=>{
 const report=buildCoverage([{id:'one',gameId:'g'}],[],[{id:'s',gameId:'g',treePrefix:'res/',directory:'models'}],
  {s:{selected:1,checked:1,failed:[],qualityExclusions:[]}}).games[0];
 assert.equal(report.sourceScopes[0].sourceDirectoryComplete,false);
});
