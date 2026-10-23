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

if __name__=='__main__':unittest.main()
