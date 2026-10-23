"""Check executable CI topology rather than workflow source text."""
from pathlib import Path
import unittest
import yaml

ROOT=Path(__file__).resolve().parents[1]
class WorkflowContractsTest(unittest.TestCase):
    def test_all_workflows_parse(self):
        for file in (ROOT/'.github/workflows').glob('*.yml'):
            with self.subTest(workflow=file.name):
                data=yaml.safe_load(file.read_text('utf-8'))
                self.assertIn('jobs',data)
    def test_preview_publish_requires_successful_captures(self):
        workflow=yaml.safe_load((ROOT/'.github/workflows/preview-pipeline.yml').read_text('utf-8'))
        self.assertIn('capture',workflow['jobs']['publish']['needs'])
        self.assertEqual(workflow['jobs']['publish']['if'],"needs.capture.result == 'success'")
        self.assertEqual(workflow['jobs']['publish']['permissions']['contents'],'write')
        self.assertEqual(workflow['jobs']['capture']['strategy']['max-parallel'],4)
    def test_legacy_preview_workflows_are_manual_delegates(self):
        for name in ["newgame-previews.yml","highquality-live2d-previews.yml","more-live2d-previews.yml","mature-live2d-previews.yml","azurlane-preview-images.yml","arknights-illust-previews.yml","bd2-bulk-previews.yml","render-spine-previews.yml"]:
            data=yaml.safe_load((ROOT/'.github/workflows'/name).read_text('utf-8'))
            triggers=data.get('on',data.get(True))
            self.assertNotIn('push',triggers)
            self.assertEqual(data['jobs']['previews']['uses'],'./.github/workflows/preview-pipeline.yml')

if __name__=='__main__':unittest.main()
