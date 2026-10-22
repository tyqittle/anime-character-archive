#!/usr/bin/env python3
"""Emit machine-readable incomplete preview queue across every dynamic catalog."""
from pathlib import Path
import json
from preview_policy import audit
catalogs = [
    'data/spine-characters.json', 'data/spine-newgames.json',
    'data/spine-bd2-characters.json', 'data/live2d-azurlane.json'
]
items=[]
for name in catalogs:
    p=Path(name)
    items.extend(json.loads(p.read_text(encoding='utf-8'))['characters'])
report=audit(items)
print(json.dumps(report,ensure_ascii=False,indent=2))
