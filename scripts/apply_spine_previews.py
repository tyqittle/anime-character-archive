#!/usr/bin/env python3
"""Apply verified matching animation previews; retain successful renders in incremental mode."""
import hashlib
import json
import pathlib
import sys
from PIL import Image
from preview_policy import needs_capture, audit
from preview_diagnostics import failure_category, scrub_failure_message

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIRECTORY = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else pathlib.Path('/tmp/spine-previews')
INCREMENTAL = '--incremental' in sys.argv[1:]
MANIFEST = ROOT / 'data/spine-characters.json'
raw = json.loads(MANIFEST.read_text(encoding='utf-8'))
characters = raw['characters']
valid = {(c.get('gameId', 'nikke'), c['id']): c for c in characters}
if len(valid) != len(characters):
    raise RuntimeError('Duplicate catalog game/id pairs')

reports = sorted(DIRECTORY.glob('preview-mapping-*.json'))
expected_shards = 40 if INCREMENTAL else 10
if len(reports) != expected_shards:
    raise RuntimeError(f'Expected {expected_shards} render shard reports, got {len(reports)}')
seen, good, bad = set(), {}, []
for report in reports:
    content = json.loads(report.read_text(encoding='utf-8'))
    for entry in content['entries']:
        key = (entry['gameId'], entry['id'])
        if key not in valid or key in seen:
            raise RuntimeError('Unrecognized or duplicate render ID: ' + str(key))
        seen.add(key)
        if entry['status'] != 'ok':
            bad.append({'gameId': key[0], 'id': key[1], 'error': str(entry.get('error', 'unknown'))[:240]})
            continue
        name = './assets/animation-previews/' + key[0] + '-' + key[1] + '.webp'
        if entry.get('preview') != name:
            raise RuntimeError('Preview linked to wrong animation: ' + str(key))
        file = DIRECTORY / name[2:]
        buf = file.read_bytes()
        if len(buf) < 1000 or buf[:4] != b'RIFF' or buf[8:12] != b'WEBP':
            raise RuntimeError('Preview invalid: ' + str(file))
        if hashlib.sha256(buf).hexdigest() != entry['sha256']:
            raise RuntimeError('Preview hash mismatch: ' + str(file))
        good[key] = entry

if INCREMENTAL:
    # Recheck real file bytes/format/hash, not just stale manifest metadata.
    expected = {key for key, c in valid.items() if needs_capture(c)}
    if seen != expected:
        raise RuntimeError(f'Incremental coverage mismatch: missing={expected - seen} unexpected={seen - expected}')
elif seen != set(valid) or bad:
    raise RuntimeError(f'Full render incomplete: missing={len(set(valid)-seen)}, failed={len(bad)}')

for key, entry in good.items():
    destination = ROOT / entry['preview'][2:]
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes((DIRECTORY / entry['preview'][2:]).read_bytes())
    c = valid[key]
    c['preview'] = entry['preview']
    c['previewSource'] = 'matching-spine-animation-frame'
    c['previewSha256'] = entry['sha256']
    c['previewAnimation'] = entry.get('animation', '')
    with Image.open(destination) as image:
        c['previewWidth'], c['previewHeight'] = image.size
    c.pop('previewStatus', None)
    c.pop('previewFailureType', None)
    c.pop('previewFailureReason', None)
for entry in bad:
    c = valid[(entry['gameId'], entry['id'])]
    c['previewStatus'] = 'render-failed'
    c['previewFailureType'] = failure_category(entry['error'])
    c['previewFailureReason'] = scrub_failure_message(entry['error'])
MANIFEST.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Cumulative coverage stays stable when a later incremental run only retries failures.
coverage = audit(characters)
verified = sum(g['verifiedPreview'] for g in coverage['counts'].values())
missing = sum(g['missingPreview'] for g in coverage['counts'].values())
recent = {'renderAttempted': len(seen), 'renderSucceeded': len(good), 'renderFailed': len(bad)}
summary = {
    'total': len(characters),
    **recent,  # Backwards-compatible latest-run counters; not lifetime totals.
    'lastRun': recent,
    'verifiedPreview': verified,
    'missingPreview': missing,
    'coverageByGame': coverage['counts'],
    'byGame': {g: sum(c.get('gameId') == g for c in characters) for g in ('nikke', 'bluearchive', 'konosuba')},
    'warning': 'renderAttempted/renderSucceeded/renderFailed describe only the latest batch. verifiedPreview/missingPreview are cumulative file-and-SHA-verified catalog coverage; previews do not prove every action plays.'
}
unresolved = []
for entry in coverage['missing']:
    c = valid[(entry['gameId'], entry['id'])]
    unresolved.append({
        **entry,
        'error': scrub_failure_message(c.get('previewFailureReason') or c.get('previewStatus') or 'Matching preview missing'),
        'category': c.get('previewFailureType') or 'unverified'
    })
(ROOT / 'data/spine-preview-build.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(ROOT / 'data/nikke-preview-audit.json').write_text(json.dumps({'summary': summary, 'failures': unresolved, 'lastRunFailures': bad}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('SPINE_PREVIEW_RESULT', json.dumps(summary, ensure_ascii=False), flush=True)
