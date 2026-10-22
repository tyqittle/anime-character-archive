import fs from 'node:fs';
export function selectPending(catalogPath,shard,shards,pendingPath='tmp/preview-pending.json'){
  if(!Number.isInteger(shard)||!Number.isInteger(shards)||shard<0||shards<1||shard>=shards)throw Error('Invalid shard');
  const characters=JSON.parse(fs.readFileSync(catalogPath,'utf8')).characters;
  const pending=JSON.parse(fs.readFileSync(pendingPath,'utf8'));
  if(!Array.isArray(pending)||pending.some(x=>typeof x!=='string')||new Set(pending).size!==pending.length)throw Error('Invalid preview queue');
  const known=new Set(characters.map(c=>c.id));
  for(const id of pending)if(!known.has(id))throw Error('Unknown preview id '+id);
  const ids=new Set(pending);
  return characters.filter(c=>ids.has(c.id)).filter((_,i)=>i%shards===shard);
}
