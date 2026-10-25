import json, subprocess, sys, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from catalog_registry import merge_catalog_records, source_identity

class CatalogMergeTests(unittest.TestCase):
    def setUp(self):
        self.old={'id':'old-hero','gameId':'old','base':'https://old.test/model','skinCode':'hero','sourcePath':'hero/model.skel',
            'preview':'./old.webp','previewSource':'matching-spine-animation-frame','previewSha256':'a'*64,'status':'browser-preview-captured'}
        self.new={'id':'new-hero','gameId':'new','base':'https://new.test/model','skinCode':'hero','sourcePath':'hero/model.skel'}
    def test_additive_idempotent_import_keeps_unrelated_records_and_preview(self):
        merged=merge_catalog_records([self.old],[self.new])
        self.assertEqual(merged,[self.old,self.new]);self.assertIs(merged[0],self.old)
        self.assertEqual(merge_catalog_records(merged,[self.new]),merged)
        update={**self.old,'previewSource':'not-rendered','status':'indexed-unverified','skeletonBytes':123}
        result=merge_catalog_records(merged,[update])
        self.assertEqual(result[0]['previewSource'],self.old['previewSource']);self.assertEqual(result[0]['skeletonBytes'],123)
    def test_conflicts_rejected_and_explicit_source_change_invalidates_preview(self):
        with self.assertRaisesRegex(ValueError,'replacement'):merge_catalog_records([self.old],[{**self.old,'base':'https://wrong.test'}])
        with self.assertRaisesRegex(ValueError,'another catalog'):merge_catalog_records([self.old],[self.new],registered=[self.old,self.new])
        with self.assertRaisesRegex(ValueError,'Duplicate'):merge_catalog_records([self.old],[self.new,self.new])
        with self.assertRaisesRegex(ValueError,'gameId'):merge_catalog_records([self.old],[{**self.old,'gameId':'new'}],update_existing=[self.old['id']])
        result=merge_catalog_records([self.old],[{**self.old,'base':'https://new.test'}],update_existing=[self.old['id']])[0]
        self.assertNotIn('preview',result);self.assertEqual(result['previewSource'],'not-rendered')
    def test_framing_identity_matches_javascript_and_leaves_old_identity_unchanged(self):
        plain=source_identity(self.old);self.assertEqual(len(plain),7)
        c={**self.old,'portraitFraming':{'excludeDrawables':['B','A','B']}}
        script="const m=require('./assets/js/shared/catalog-registry.js');process.stdout.write(JSON.stringify(m.sourceIdentity(JSON.parse(process.argv[1]))))"
        actual=json.loads(subprocess.check_output(['node','-e',script,json.dumps(c)],cwd=ROOT,text=True))
        self.assertEqual(source_identity(c),actual);self.assertEqual(actual[-1],'portrait-framing-excluded-drawables:["A","B"]')
    def test_hosted_integrity_identity_matches_javascript_and_blocks_unreviewed_change(self):
        c={**self.old,'premultipliedAlpha':False,'spineSkinLayers':['default','normal'],'spineAtlasPageMerge':True,'portraitFraming':{'excludeBones':['Z','A','Z']},'spineAttachmentPathRepairs':[{'skin':'default','slot':'face','name':'face','from':'face ','to':'face'}],'resourceIntegrity':[{'path':'b.png','sha256':'b'*64},{'path':'a.json','sha256':'a'*64}]}
        script="const m=require('./assets/js/shared/catalog-registry.js');process.stdout.write(JSON.stringify(m.sourceIdentity(JSON.parse(process.argv[1]))))"
        actual=json.loads(subprocess.check_output(['node','-e',script,json.dumps(c)],cwd=ROOT,text=True))
        self.assertEqual(source_identity(c),actual)
        changed={**c,'resourceIntegrity':[{'path':'b.png','sha256':'c'*64}]}
        with self.assertRaisesRegex(ValueError,'replacement'):merge_catalog_records([c],[changed])
    def test_companion_identity_is_recursive_and_matches_browser_contract(self):
        c={**self.old,'spineIdleAnimation':'Idle_Stand','spineCompanions':[{**self.new,'spineIdleAnimation':'idle','resourceIntegrity':[{'path':'back.png','sha256':'b'*64}]}]}
        script="const m=require('./assets/js/shared/catalog-registry.js');process.stdout.write(JSON.stringify(m.sourceIdentity(JSON.parse(process.argv[1]))))"
        actual=json.loads(subprocess.check_output(['node','-e',script,json.dumps(c)],cwd=ROOT,text=True))
        self.assertEqual(source_identity(c),actual)
        changed={**c,'spineCompanions':[{**c['spineCompanions'][0],'base':'https://changed.test/model'}]}
        self.assertNotEqual(source_identity(c),source_identity(changed))
        with self.assertRaisesRegex(ValueError,'replacement'):merge_catalog_records([c],[changed])

if __name__=='__main__':unittest.main()
