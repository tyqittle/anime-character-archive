import hashlib, importlib.util, json, struct, sys, unittest
from pathlib import Path
from urllib.parse import unquote
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
spec=importlib.util.spec_from_file_location('spine_source',ROOT/'scripts/import_spine_source.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class SpineSourceTests(unittest.TestCase):
    def setUp(self):
        self.scope={'sourceRepo':'owner/repo','sourceCommit':'a'*40,'treePrefix':'res/','directory':'characters','gameId':'test','name':'Test','spineVersion':'3.8','idPrefix':'sample-','modelPattern':r'\d+'}
        self.skeleton=b'\x02h\x073.8.99'+b'\0'*10
        self.payload={'characters/123/123.skel':self.skeleton,'characters/123/123.atlas':b'\n123.png\nsize: 512,512\nformat: RGBA8888\n','characters/123/123.png':b'\x89PNG\r\n\x1a\n'+b'\0'*8+struct.pack('>II',512,512)+b'\0'*8}
        self.files={p:{'size':len(raw),'sha':m.git_blob(raw)} for p,raw in self.payload.items()}
    def download(self,url,**kwargs):return self.payload[unquote(url.split('/res/')[1])]
    def test_exact_bundle_has_pinned_urls_and_real_version(self):
        c=m.model_record(self.scope,'123',self.files,self.download)
        self.assertEqual(c['id'],'sample-123');self.assertEqual(c['sourceVersion'],'3.8.99')
        self.assertIn('a'*40,c['base']);self.assertEqual(c['textures'][0]['width'],512)
        self.assertEqual(c['status'],'indexed-unverified');self.assertNotIn('preview',c)
    def test_missing_atlas_or_texture_never_creates_partial_record(self):
        for path in ['characters/123/123.atlas','characters/123/123.png']:
            with self.assertRaisesRegex(ValueError,'Missing'):
                m.model_record(self.scope,'123',{p:x for p,x in self.files.items() if p!=path},self.download)
    def test_json_content_with_skel_extension_uses_json_renderer(self):
        self.payload['characters/123/123.skel']=json.dumps({'skeleton':{'spine':'3.8.55'}}).encode()
        self.files['characters/123/123.skel']['sha']=m.git_blob(self.payload['characters/123/123.skel'])
        c=m.model_record(self.scope,'123',self.files,self.download)
        self.assertEqual(c['skeletonFormat'],'json')
        self.assertTrue(c['skeletonUrl'].endswith('.skel'))
    def test_spaced_json_bundle_has_encoded_urls_and_explicit_stable_id(self):
        self.scope.update(directory='',modelPattern='Lust Stand',skeletonExtension='json',modelIds={'Lust Stand':'lust-stand'})
        self.payload={'Lust Stand/Lust Stand.json':json.dumps({'skeleton':{'spine':'3.8.95'}}).encode(),
            'Lust Stand/Lust Stand.atlas':b'123.png\nsize: 512,512\n',
            'Lust Stand/123.png':self.payload['characters/123/123.png']}
        self.files={p:{'size':len(raw),'sha':m.git_blob(raw)} for p,raw in self.payload.items()}
        c=m.model_record(self.scope,'Lust Stand',self.files,self.download)
        self.assertEqual(c['id'],'sample-lust-stand')
        self.assertIn('Lust%20Stand/Lust%20Stand.json',c['skeletonUrl'])
        self.assertEqual(c['sourcePath'],'res/Lust Stand/Lust Stand.json')
    def test_path_escape_wrong_blob_and_unsupported_versions_are_rejected(self):
        with self.assertRaisesRegex(ValueError,'identity'):m.model_record(self.scope,'../123',self.files,self.download)
        files={**self.files,'characters/123/123.skel':{'size':100,'sha':'b'*40}}
        with self.assertRaisesRegex(ValueError,'mismatch'):m.model_record(self.scope,'123',files,self.download)
        self.payload['characters/123/123.skel']=self.skeleton.replace(b'3.8.99',b'3.7.99')
        self.files['characters/123/123.skel']['sha']=m.git_blob(self.payload['characters/123/123.skel'])
        with self.assertRaisesRegex(ValueError,'Unsupported'):m.model_record(self.scope,'123',self.files,self.download)

if __name__=='__main__':unittest.main()
