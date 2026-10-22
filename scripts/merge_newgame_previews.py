#!/usr/bin/env python3
"""Publish verified previews through one shared policy for all newly imported games."""
from pathlib import Path
import json
import shutil
import argparse
from preview_policy import ROOT, filename, verified_file, apply_verified_preview, audit
from preview_diagnostics import read_capture_failures, group_capture_failures

parser=argparse.ArgumentParser()
parser.add_argument('--catalog',default='data/spine-newgames.json')
parser.add_argument('--incoming',default='tmp/newgame-merged/webps')
parser.add_argument('--audit',default='data/newgames-preview-audit.json')
args=parser.parse_args()
manifest = Path(args.catalog)
catalog = json.loads(manifest.read_text(encoding='utf-8'))
incoming = Path(args.incoming)
ROOT.mkdir(parents=True, exist_ok=True)
failures = read_capture_failures(incoming.parent / 'reports')
added = 0
for character in catalog['characters']:
    source = incoming / filename(character)
    if source.is_file():
        # A fresh same-model frame has a new digest. Verify its format and size
        # before replacement, without comparing it to the old cached digest.
        incoming_character = {k: v for k, v in character.items()
                              if k not in ('previewSha256', 'previewWidth', 'previewHeight')}
        if verified_file(incoming_character, incoming) is None:
            print('REJECT_INVALID_PREVIEW', source)
        else:
            shutil.copyfile(source, ROOT / filename(character))
            for key in ('previewSha256', 'previewWidth', 'previewHeight'):
                character.pop(key, None)
            added += 1
    if apply_verified_preview(character):
        character.pop('previewFailureType', None)
        character.pop('previewFailureReason', None)
    else:
        # Only a matching, verified frame counts. Log specific failure reasons.
        character.pop('preview', None)
        character['previewSource'] = 'not-rendered'
        character['status'] = 'unverified-playback'
        failure = failures.get(character['id'])
        if failure:
            character['previewFailureType'] = failure['category']
            character['previewFailureReason'] = failure['message']
        else:
            character.pop('previewFailureType', None)
            character.pop('previewFailureReason', None)

summary = audit(catalog['characters'])
failed_records = [failures[c['id']] for c in summary['missing'] if c['id'] in failures]
manifest.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
Path(args.audit).write_text(json.dumps({
    'scope': 'new dynamic game batch',
    'counts': summary['counts'],
    'missing': summary['missing'],
    'newCapturesInThisRun': added,
    'failedCaptures': failed_records,
    'failureSummary': group_capture_failures(failed_records),
    'status': 'shared exact-model WebP verification policy'
}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('NEWGAME_MERGED', added, summary['counts'])
