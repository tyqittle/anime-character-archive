#!/usr/bin/env python3
"""Install locally rendered Spine previews atomically after all CI shards finish.

Only an exact catalog-wide mapping can replace any existing preview metadata.
No name-based portrait fallback, no "same base art for all skins".
"""
import hashlib
import json
import pathlib
import sys

ROOT=pathlib.Path(__file__).resolve().parent.parent
DIRECTORY=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path('/tmp/spine-previews')
MANIFEST=ROOT/'data/spine-characters.json'
raw=json.loads(MANIFEST.read_text(encoding='utf-8'))
characters=raw['characters']
valid={(entry.get('gameId','nikke'),entry['id']):entry for entry in characters}
if len(valid)!=len(characters):
    raise RuntimeError('Duplicate catalog character IDs')

reports=list(DIRECTORY.glob('preview-mapping-*.json'))
if len(reports)!=10:raise RuntimeError(f'Expected 10 shard reports, got {len(reports)}')
found={}
for report in reports:
    content=json.loads(report.read_text(encoding='utf-8'))
    if content['failed'] or content['success']!=content['total']:
        raise RuntimeError('There are failed preview renders in '+str(report))
    for entry in content['entries']:
        key=(entry['gameId'],entry['id'])
        if key not in valid or key in found or entry['status']!='ok':
            raise RuntimeError('Unrecognized, duplicate or failed preview: '+str(key))
        name=entry['preview']
        if name!='./assets/animation-previews/'+key[0]+'-'+key[1]+'.webp':
            raise RuntimeError('Preview points to a different animation: '+str(key)+' '+name)
        file=DIRECTORY/name.removeprefix('./')
        buf=file.read_bytes()
        if len(buf)<1000 or buf[:4]!=b'RIFF' or buf[8:12]!=b'WEBP':
            raise RuntimeError('Preview file is missing or corrupt: '+str(file))
        if hashlib.sha256(buf).hexdigest()!=entry['sha256']:
            raise RuntimeError('Preview hash mismatch: '+str(file))
        found[key]=entry
if set(found)!=set(valid):
    missing=set(valid)-set(found)
    raise RuntimeError(f'Catalog coverage is incomplete: {len(missing)} missing: {str(missing)[:400]}')

for key,record in valid.items():
    image=found[key]
    dest=ROOT/image['preview'][2:]
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_bytes((DIRECTORY/image['preview'][2:]).read_bytes())
    record['preview']=image['preview']
    record['previewSource']='matching-spine-animation-frame'
    record['previewSha256']=image['sha256']
    record['previewAnimation']=image['animation']
MANIFEST.write_text(json.dumps(raw,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
summary={
    'total':len(characters),
    'source':'All preview images rendered from the matching animation on the same Spine player',
    'byGame':{game:sum(x['gameId']==game for x in characters) for game in ['nikke','bluearchive']},
    'warning':'Pose is a frame of the same animation; costumes and backgrounds may differ from official marketing portraits.'
}
(ROOT/'data/spine-preview-build.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('SPINE_PREVIEWS_COMPLETE',json.dumps(summary,ensure_ascii=False))
