"""Conversion failures stay observable rather than silently disappearing."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from preview_pipeline import convert_batch
from catalog_registry import source_identity

class ConversionReportTest(unittest.TestCase):
    def test_blank_frame_is_reported_with_its_model_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);frames=root/'frames';frames.mkdir()
            character={'id':'demo','gameId':'demo','base':'https://example.test/pinned/demo'}
            manifest=root/'catalog.json';manifest.write_text(json.dumps({'characters':[character]}))
            Image.new('RGB',(240,300),(20,34,56)).save(frames/'demo-demo.png')
            with patch('preview_pipeline.load_registry',return_value=[{'path':str(manifest)}]):
                count,failures=convert_batch(root,3)
            self.assertEqual(count,0)
            self.assertEqual(failures[0]['id'],'demo')
            self.assertEqual(failures[0]['sourceIdentity'],source_identity(character))
            report=json.loads((root/'reports/shard-convert-3.json').read_text('utf-8'))
            self.assertEqual(report['fail'],failures)
            self.assertFalse((root/'webps/demo-demo.webp').exists())

if __name__=='__main__':unittest.main()
