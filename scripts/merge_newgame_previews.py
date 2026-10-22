#!/usr/bin/env python3
"""Publish verified previews through one shared policy for all newly imported games."""
from pathlib import Path
import json
import shutil
import argparse
from preview_policy import ROOT, filename, verified_file, apply_verified_preview, audit

parser=argparse.ArgumentParser()
parser.add_argument('--catalog',default='data/spine-newgames.json')
parser.add_argument('--incoming',default='tmp/newgame-merged/webps')
parser.add_argument('--audit',default='data/newgames-preview-audit.json')
args=parser.parse_args()
manifest = Path(args.catalog)
catalog = json.loads(manifest.read_text(encoding='utf-8'))
incoming = Path(args.incoming)
ROOT.mkdir(parents=True, exist_ok=True)
added = 0
for character in catalog['characters']:
    source = incoming / filename(character)
    if source.is_file():
        if verified_file(character, incoming) is None:
            print('REJECT_INVALID_PREVIEW', source)
        else:
            shutil.copyfile(source, ROOT / filename(character))
            added += 1
    if not apply_verified_preview(character):
        # Never pretend an upstream image is a real rendered model frame.
        character.pop('preview', None)
        character['previewSource'] = 'not-rendered'
        character['status'] = 'unverified-playback'

summary = audit(catalog['characters'])
manifest.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
Path(args.audit).write_text(json.dumps({
    'scope': 'new dynamic game batch',
    'counts': summary['counts'],
    'missing': summary['missing'],
    'newCapturesInThisRun': added,
    'status': 'shared exact-model WebP verification policy'
}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('NEWGAME_MERGED', added, summary['counts'])
