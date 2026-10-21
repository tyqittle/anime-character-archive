// Merge finished real Spine renders; do not publish thumbnails for failures.
// Run after actions/download-artifact extracts bd2-shard-* subdirectories.
import fs from 'node:fs';
import path from 'node:path';
const root='build/bd2-results',target='assets/animation-previews';
const manifestFile='data/spine-bd2-characters.json';
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
const index=new Map(manifest.characters.map(c=>[c.id,c]));
const dirs=fs.readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name.startsWith('bd2-shard-')).sort((a,b)=>a.name.localeCompare(b.name));
if(dirs.length!==12)throw Error('Expected exactly 12 shards; got '+dirs.length);
fs.mkdirSync(target,{recursive:true});
const audits=[],successIds=new Set();
for(const folder of dirs){
 const directory=path.join(root,folder.name);
 const report=JSON.parse(fs.readFileSync(path.join(directory,'results.json'),'utf8'));
 audits.push({shard:report.shard,attempted:report.attempted,succeeded:report.success.length,failed:report.failed});
 for(const result of report.success){
  const model=index.get(result.id);if(!model)throw Error('Unknown BD2 model in result: '+result.id);
  const expected='browndust2-'+model.id+'.webp';
  if(result.thumbnail!==expected)throw Error('Thumbnail identity mismatch '+result.id);
  if(successIds.has(model.id))throw Error('Duplicate successful model '+model.id);
  const source=path.join(directory,'previews',expected),dest=path.join(target,expected);
  const buffer=fs.readFileSync(source);
  if(buffer.length<2000||buffer.toString('ascii',0,4)!=='RIFF'||buffer.toString('ascii',8,12)!=='WEBP')throw Error('Invalid WebP '+expected);
  fs.writeFileSync(dest,buffer);
  model.preview='./assets/animation-previews/'+expected;
  model.previewSource='matching-spine-animation-frame';
  model.status='verified-playback';
  model.versionUnverified=false;
  successIds.add(model.id);
 }
}
const allFailures=audits.flatMap(x=>x.failed);
const verified=manifest.characters.filter(c=>c.status==='verified-playback').length;
const audit={upstreamCommit:manifest.pinnedSourceCommit,modelCount:manifest.characters.length,verifiedCount:verified,newPreviews:successIds.size,attempted:audits.reduce((a,b)=>a+b.attempted,0),failures:allFailures};
manifest.previewStatus='Live Spine Chromium WebP preview capture: '+verified+' verified out of '+manifest.characters.length+'; others retain unverified status';
fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync('data/bd2-preview-audit.json',JSON.stringify(audit,null,2)+'\n');
console.log('BD2_CATALOG_UPDATED',JSON.stringify({verified,new:successIds.size,failures:allFailures.length}));
