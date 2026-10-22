#!/usr/bin/env python3
"""One exact-model preview policy across all game catalogs."""
from pathlib import Path
from PIL import Image
import hashlib

ROOT = Path('assets/animation-previews')
def filename(c): return f"{c['gameId']}-{c['id']}.webp"
def relative_path(c): return './' + (ROOT / filename(c)).as_posix()
def source(c): return 'matching-live2d-animation-frame' if c.get('engine') == 'cubism' else 'matching-spine-animation-frame'
def verified_file(c, directory=None):
    directory = ROOT if directory is None else directory
    p = directory / filename(c)
    if not p.is_file() or p.stat().st_size < 500: return None
    try:
        raw = p.read_bytes()
        if raw[:4] != b'RIFF' or raw[8:12] != b'WEBP': return None
        with Image.open(p) as im: im.verify()
        with Image.open(p) as im:
            if im.size != ((480,360) if c.get('previewSha256') else (360,420)): return None
        if c.get('previewSha256') and hashlib.sha256(raw).hexdigest() != c['previewSha256']: return None
    except (OSError, ValueError): return None
    return p
def needs_capture(c):
    return not (c.get('preview') == relative_path(c) and c.get('previewSource') == source(c) and verified_file(c) is not None)
def apply_verified_preview(c):
    if verified_file(c) is None: return False
    c['preview'] = relative_path(c)
    c['previewSource'] = source(c)
    if c.get('status') != 'verified-playback': c['status'] = 'browser-preview-captured'
    if c.get('playbackStatus') != 'verified-playback': c['playbackStatus'] = 'browser-preview-captured'
    return True
def audit(characters):
    counts, missing = {}, []
    for c in characters:
        rec = counts.setdefault(c['gameId'], {'indexed':0,'verifiedPreview':0,'missingPreview':0})
        rec['indexed'] += 1
        if needs_capture(c):
            rec['missingPreview'] += 1
            missing.append({'gameId':c['gameId'],'id':c['id']})
        else: rec['verifiedPreview'] += 1
    return {'counts':counts,'missing':missing}
