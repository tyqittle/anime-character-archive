"""Model-neutral preview-failure classification and capture report merging."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from preview_diagnostics import failure_category, read_capture_failures, group_capture_failures

class PreviewDiagnosticsTest(unittest.TestCase):
    def test_error_categories(self):
        self.assertEqual(failure_category('Error: Region not found in atlas: hair'), 'atlas-mismatch')
        self.assertEqual(failure_category('page.waitForFunction: Timeout 60000ms exceeded.'), 'timeout')
        self.assertEqual(failure_category('Blank/tiny pixel variance 4.12'), 'blank-frame')
        self.assertEqual(failure_category('HTTP 404 model'), 'source-missing')
        self.assertEqual(failure_category('could not load skeleton .skel'), 'skeleton-error')
    def test_reports_and_labels(self):
        with tempfile.TemporaryDirectory() as tmp:
            report={'shard':0,'fail':[{'id':'ak-1','game':'arknights','error':'Region not found in atlas: <br> Hair'},
                                       {'id':'gf-2','game':'girlsfrontline','error':'Timeout 60000ms exceeded'}]}
            Path(tmp,'shard-0.json').write_text(json.dumps(report))
            records=read_capture_failures(tmp)
            self.assertEqual(len(records),2)
            self.assertEqual(records['ak-1']['category'],'atlas-mismatch')
            self.assertNotIn('<br>',records['ak-1']['message'])
            self.assertEqual(group_capture_failures(list(records.values())),{'atlas-mismatch':1,'timeout':1})
