"""A late capture must never attach an old model's frame to a new source."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import preview_policy as policy
import preview_repository as repository
from catalog_registry import source_identity

class PublisherTest(unittest.TestCase):
    def test_source_change_rejects_late_frame_for_every_engine(self):
        for engine in ('spine','cubism'):
            with self.subTest(engine=engine),tempfile.TemporaryDirectory() as directory:
                root=Path(directory);incoming=root/'incoming/webps';incoming.mkdir(parents=True)
                reports=incoming.parent/'reports';reports.mkdir()
                character={'id':'demo','gameId':'demo','engine':engine,'base':'https://example.test/new-ref/demo'}
                frame=incoming/policy.filename(character)
                Image.effect_noise((360,420),20).convert('RGB').save(frame,'WEBP')
                stale={**character,'base':'https://example.test/old-ref/demo'}
                (reports/'shard-0.json').write_text(json.dumps({'pass':[{'id':'demo','sourceIdentity':source_identity(stale)}],'fail':[]}))
                manifest=root/'catalog.json';manifest.write_text(json.dumps({'characters':[character]}))
                with patch.object(policy,'ROOT',root/'output'),patch.object(repository,'ROOT',root/'output'):
                    result=repository.publish_catalog(manifest,incoming,root/'audit.json',require_identity=True)
                self.assertEqual(result['newCapturesInThisRun'],0)
                self.assertEqual(result['rejectedCaptures'],['demo'])
                self.assertFalse((root/'output'/policy.filename(character)).exists())

    def test_changing_source_invalidates_an_existing_verified_preview(self):
        with tempfile.TemporaryDirectory() as directory:
            output=Path(directory);c={'id':'demo','gameId':'demo','base':'https://example.test/old/demo'}
            Image.effect_noise((360,420),20).convert('RGB').save(output/policy.filename(c),'WEBP')
            with patch.object(policy,'ROOT',output):
                self.assertTrue(policy.apply_verified_preview(c))
                self.assertFalse(policy.needs_capture(c))
                c['base']='https://example.test/new/demo'
                self.assertTrue(policy.needs_capture(c))
                self.assertFalse(policy.apply_verified_preview(c))
    def test_source_reset_cannot_adopt_an_orphaned_old_image_without_current_capture_proof(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);output=root/'output';output.mkdir();incoming=root/'incoming/webps';incoming.mkdir(parents=True)
            c={'id':'demo','gameId':'demo','base':'https://example.test/new/demo','previewSource':'not-rendered'}
            Image.effect_noise((360,420),20).convert('RGB').save(output/policy.filename(c),'WEBP')
            manifest=root/'catalog.json';manifest.write_text(json.dumps({'characters':[c]}))
            with patch.object(policy,'ROOT',output),patch.object(repository,'ROOT',output):
                result=repository.publish_catalog(manifest,incoming,root/'audit.json',require_identity=True)
            final=json.loads(manifest.read_text())['characters'][0]
            self.assertNotIn('preview',final);self.assertEqual(result['counts']['demo']['missingPreview'],1)

if __name__=='__main__':unittest.main()
