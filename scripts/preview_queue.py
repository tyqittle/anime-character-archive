#!/usr/bin/env python3
"""Single missing-preview queue for all game capture jobs."""
import argparse, json
from pathlib import Path
from preview_policy import audit, needs_capture
CATALOGS=['data/spine-characters.json','data/spine-newgames.json','data/spine-bd2-characters.json','data/live2d-azurlane.json','data/spine-arknights-illust.json','data/live2d-moregames.json','data/live2d-highquality.json']
p=argparse.ArgumentParser()
p.add_argument('--catalog',choices=CATALOGS,action='append')
p.add_argument('--write',type=Path)
args=p.parse_args()
items=[c for path in (args.catalog or CATALOGS) for c in json.loads(Path(path).read_text(encoding='utf-8'))['characters']]
pending=[c['id'] for c in items if needs_capture(c)]
if len(pending)!=len(set(pending)): raise ValueError('Duplicate model ids in preview queue')
if args.write:
    args.write.parent.mkdir(parents=True,exist_ok=True)
    args.write.write_text(json.dumps(pending,ensure_ascii=False)+'\n',encoding='utf-8')
print(json.dumps(audit(items),ensure_ascii=False,indent=2))
