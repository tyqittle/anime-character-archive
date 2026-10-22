#!/usr/bin/env python3
"""Common preview policy for every dynamic catalog. Game-specific renderers only capture frames."""
from pathlib import Path
from PIL import Image
import json

ROOT = Path('assets/animation-previews')
PREVIEW_SIZE = (360, 420)

def filename(character):
    return f"{character['gameId']}-{character['id']}.webp"

def verified_file(character, directory=ROOT):
    path = directory / filename(character)
    if not path.is_file() or path.stat().st_size <= 500:
        return None
    try:
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            if image.size != PREVIEW_SIZE:
                return None
    except (OSError, ValueError):
        return None
    return path

def needs_capture(character):
    """An upstream thumbnail is not equivalent to a rendered same-model preview."""
    expected = './' + str(ROOT / filename(character))
    source = character.get('previewSource', '')
    return not (character.get('preview') == expected
                and source == ('matching-live2d-animation-frame' if character.get('engine') == 'cubism' else 'matching-spine-animation-frame')
                and verified_file(character) is not None)

def apply_verified_preview(character):
    path = verified_file(character)
    if path is None:
        return False
    character['preview'] = './' + str(path)
    character['previewSource'] = ('matching-live2d-animation-frame'
                                  if character.get('engine') == 'cubism' else 'matching-spine-animation-frame')
    character['playbackStatus'] = 'browser-preview-captured'
    character['status'] = 'browser-preview-captured'
    return True

def audit(characters):
    counts = {}
    missing = []
    for c in characters:
        game = c['gameId']
        rec = counts.setdefault(game, {'indexed': 0, 'verifiedPreview': 0, 'missingPreview': 0})
        rec['indexed'] += 1
        if not needs_capture(c):
            rec['verifiedPreview'] += 1
        else:
            rec['missingPreview'] += 1
            missing.append({'gameId': game, 'id': c['id']})
    return {'counts': counts, 'missing': missing}
