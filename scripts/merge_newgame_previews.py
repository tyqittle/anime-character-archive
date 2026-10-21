#!/usr/bin/env python3
"""Merge only captured exact-character WebP files into the active catalog."""
from pathlib import Path
from PIL import Image
import json, shutil

manifest=Path('data/spine-newgames.json')
catalog=json.loads(manifest.read_text(encoding='utf-8'))
captures=Path('tmp/newgame-merged/webps')
destination=Path('assets/animation-previews')
destination.mkdir(parents=True,exist_ok=True)
counts={}
already=0
added=0
for c in catalog['characters']:
    game=c['gameId'];counts.setdefault(game,{'indexed':0,'captured':0})
    counts[game]['indexed']+=1
    filename=f"{game}-{c['id']}.webp"
    path=captures/filename
    stored=destination/filename
    if path.exists():
        if path.stat().st_size<500: raise ValueError('Invalid preview '+filename)
        with Image.open(path) as im:
            im.verify()
        shutil.copyfile(path,stored)
    if stored.is_file() and stored.stat().st_size>500:
        with Image.open(stored) as im:
            if im.size!=(360,420): raise ValueError('Unexpected preview size: '+filename)
        c['preview']='./assets/animation-previews/'+filename
        c['previewSource']='matching-live2d-animation-frame' if c.get('engine')=='cubism' else 'matching-spine-animation-frame'
        c['status']='browser-preview-captured'
        counts[game]['captured']+=1
        if path.exists():added+=1
        else:already+=1
    else:
        c.pop('preview',None)
        c['previewSource']='not-rendered'
        c['status']='unverified-playback'
manifest.write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
Path('data/newgames-preview-audit.json').write_text(json.dumps({
 'date':'2026-10-22','scope':'new dynamic game batch','counts':counts,
 'newCapturesInThisRun':added,'previousCapturesRetained':already,
 'status':'only actual nonblank browser frames linked to the same model id',
 'unverifiedNotice':'No preview is assigned to models that did not pass capture; index presence is not universal playback proof.'
},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('NEWGAME_MERGED',added,'previous',already,'summary',counts)
