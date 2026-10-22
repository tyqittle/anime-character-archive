"""A newly captured frame must replace an older verified frame of the same model."""
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'merge_newgame_previews.py'

class MergeNewgamePreviewsTest(unittest.TestCase):
    def test_new_capture_replaces_stale_digest(self):
        with tempfile.TemporaryDirectory() as workspace:
            root = Path(workspace)
            (root / 'data').mkdir()
            (root / 'assets' / 'animation-previews').mkdir(parents=True)
            incoming = root / 'tmp' / 'newgame-merged' / 'webps'
            incoming.mkdir(parents=True)
            file_name = 'girlsfrontline-gf-demo.webp'
            original = root / 'assets' / 'animation-previews' / file_name
            Image.effect_noise((360,420), 9).convert('RGB').save(original, 'WEBP')
            old_hash = hashlib.sha256(original.read_bytes()).hexdigest()
            candidate = incoming / file_name
            Image.effect_noise((360,420), 65).convert('RGB').save(candidate, 'WEBP')
            new_hash = hashlib.sha256(candidate.read_bytes()).hexdigest()
            self.assertNotEqual(old_hash, new_hash)
            character = {
                'id':'gf-demo', 'gameId':'girlsfrontline',
                'preview':'./assets/animation-previews/' + file_name,
                'previewSource':'matching-spine-animation-frame',
                'previewWidth':360, 'previewHeight':420,
                'previewSha256':old_hash
            }
            catalog = root / 'data' / 'spine-newgames.json'
            catalog.write_text(json.dumps({'characters':[character]}),encoding='utf-8')
            result = subprocess.run(
                [sys.executable,str(SCRIPT),'--catalog',str(catalog),'--incoming',str(incoming),
                 '--audit',str(root / 'data' / 'newgames-preview-audit.json')],
                cwd=root, capture_output=True,text=True,timeout=30)
            self.assertEqual(result.returncode,0,result.stdout+'\n'+result.stderr)
            merged = json.loads(catalog.read_text(encoding='utf-8'))['characters'][0]
            self.assertEqual(merged['previewSha256'],new_hash)
            self.assertEqual(original.read_bytes(),candidate.read_bytes())
            self.assertEqual(merged['previewSource'],'matching-spine-animation-frame')

if __name__=='__main__':
    unittest.main()
