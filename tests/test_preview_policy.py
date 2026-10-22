"""Regression tests for the one shared dynamic preview policy."""
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path, PureWindowsPath
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import preview_policy as p

class PreviewPolicyTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)
        self.character = {'gameId':'azurlane','id':'al-demo','engine':'cubism',
            'preview':'./assets/animation-previews/azurlane-al-demo.webp',
            'previewSource':'matching-live2d-animation-frame'}
        self.file = self.path / p.filename(self.character)
        Image.effect_noise((360,420),20).convert('RGB').save(self.file,'WEBP')
    def test_web_paths_use_forward_slashes_on_windows(self):
        previous = p.ROOT
        try:
            p.ROOT = PureWindowsPath('assets/animation-previews')
            self.assertEqual(p.relative_path(self.character), './assets/animation-previews/azurlane-al-demo.webp')
        finally: p.ROOT = previous
    def test_correct_model_path_and_image(self):
        self.assertIsNotNone(p.verified_file(self.character,self.path))
        previous = p.ROOT
        try:
            p.ROOT = self.path
            self.character['preview'] = p.relative_path(self.character)
            self.assertFalse(p.needs_capture(self.character))
            self.character['previewSource'] = 'upstream-thumbnail'
            self.assertTrue(p.needs_capture(self.character))
        finally: p.ROOT = previous
    def test_reject_wrong_size_and_corruption(self):
        self.file.write_bytes(b'not webp')
        self.assertIsNone(p.verified_file(self.character,self.path))
        Image.new('RGB',(20,20)).save(self.file,'WEBP')
        self.assertIsNone(p.verified_file(self.character,self.path))
    def test_legacy_spine_sha_and_format(self):
        spine = {'gameId':'nikke','id':'c010','previewSource':'matching-spine-animation-frame'}
        legacy = self.path / p.filename(spine)
        Image.effect_noise((480,360),20).convert('RGB').save(legacy,'WEBP')
        spine['previewSha256'] = hashlib.sha256(legacy.read_bytes()).hexdigest()
        self.assertIsNotNone(p.verified_file(spine,self.path))
        spine['previewSha256'] = '0'*64
        self.assertIsNone(p.verified_file(spine,self.path))
    def test_preserve_verified_status(self):
        local = self.path / 'assets' / 'animation-previews'
        local.mkdir(parents=True)
        file = local / p.filename(self.character)
        file.write_bytes(self.file.read_bytes())
        previous = p.ROOT
        try:
            p.ROOT = local
            self.character['status'] = 'verified-playback'
            self.assertTrue(p.apply_verified_preview(self.character))
            self.assertEqual(self.character['status'],'verified-playback')
        finally: p.ROOT = previous

if __name__ == '__main__': unittest.main()
