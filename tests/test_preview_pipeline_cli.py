"""Exercise the shipped plan -> convert -> publish CLI in an isolated workspace."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from PIL import Image

CODE=Path(__file__).resolve().parents[1]/'scripts'

class PreviewPipelineCliTest(unittest.TestCase):
    def test_full_transaction_and_source_revision_invalidation(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'scripts').mkdir();(root/'data').mkdir()
            for file in ('catalog_registry.py','preview_policy.py','preview_repository.py',
                         'preview_pipeline.py','preview_frame_pipeline.py','preview_diagnostics.py',
                         'audit_animation_visual_integrity.py'):
                shutil.copyfile(CODE/file,root/'scripts'/file)
            (root/'data/animation-catalogs.json').write_text(json.dumps({
                'schemaVersion':1,'catalogs':[{'id':'fixture','name':'Fixture','path':'data/fixture.json'}]}))
            character={'id':'demo','gameId':'fixture','name':'Demo','engine':'spine',
                       'base':'https://example.test/ref1/demo','spineVersion':'4.1'}
            manifest=root/'data/fixture.json'
            manifest.write_text(json.dumps({'characters':[character]}))
            environment=os.environ.copy();environment.pop('GITHUB_OUTPUT',None)
            def run(*arguments):
                result=subprocess.run([sys.executable,str(root/'scripts/preview_pipeline.py'),*arguments],
                    cwd=root,env=environment,capture_output=True,text=True,timeout=30)
                self.assertEqual(result.returncode,0,result.stdout+'\n'+result.stderr)
            run('plan')
            self.assertEqual(json.loads((root/'tmp/repair-pending.json').read_text()),['demo'])
            output=root/'tmp/repair-output';(output/'frames').mkdir(parents=True)
            Image.effect_noise((600,700),30).convert('RGB').save(output/'frames/fixture-demo.png')
            (output/'reports').mkdir()
            identity=['spine',character['base'],'','','','','4.1']
            (output/'reports/shard-0.json').write_text(json.dumps({
                'pass':[{'id':'demo','gameId':'fixture','sourceIdentity':identity}],'fail':[]}))
            run('convert','--shard','0')
            run('publish','--incoming','tmp/repair-output/webps')
            published=json.loads(manifest.read_text())['characters'][0]
            self.assertEqual(published['previewSourceIdentity'],identity)
            self.assertEqual(published['previewSource'],'matching-spine-animation-frame')
            self.assertEqual((published['previewWidth'],published['previewHeight']),(360,420))
            self.assertTrue((root/published['preview'].removeprefix('./')).is_file())
            global_audit=root/'data/preview-pipeline-audit.json'
            prior=json.loads(global_audit.read_text());prior['other-catalog']={'sentinel':'preserve this independent result'}
            global_audit.write_text(json.dumps(prior))
            run('publish','--catalog','fixture','--incoming','tmp/repair-output/webps')
            self.assertEqual(json.loads(global_audit.read_text())['other-catalog'],prior['other-catalog'])
            run('plan')
            self.assertEqual(json.loads((root/'tmp/repair-pending.json').read_text()),[])
            published['base']='https://example.test/ref2/demo'
            manifest.write_text(json.dumps({'characters':[published]}))
            run('plan')
            self.assertEqual(json.loads((root/'tmp/repair-pending.json').read_text()),['demo'])
            run('publish','--incoming','tmp/repair-output/webps')
            final=json.loads(manifest.read_text())['characters'][0]
            self.assertNotIn('preview',final)
            report=json.loads((root/'data/preview-audits/fixture.json').read_text())
            self.assertEqual(report['rejectedCaptures'],['demo'])

if __name__=='__main__':unittest.main()
