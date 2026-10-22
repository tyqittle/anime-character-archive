"""Source discovery must normalize wiki filenames without importing UI icons."""
import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import expand_static_archive as archive

class StaticImportTest(unittest.TestCase):
    def test_wiki_suffixes_and_space_normalization(self):
        def api(base,**params):
            if params.get('list')=='categorymembers':
                return {'query':{'categorymembers':[{'ns':0,'title':'Daiyan (GFL2)'},{'ns':14,'title':'Category:Support'}]}}
            if params.get('prop')=='imageinfo':
                self.assertIn('File:Daiyan_Whole.png',params['titles'])
                self.assertIn('File:Daiyan_whole.png',params['titles'])
                self.assertNotIn('Category:',params['titles'])
                return {'query':{'pages':{'1':{'title':'File:Daiyan Whole.png','imageinfo':[{'url':'https://iopwiki.com/images/Daiyan_Whole.png'}]}}}}
            return {'query':{'allimages':[{'name':'角色 露帕 立绘.png','url':'https://example.test/full.png'},
                                          {'name':'角色_露帕_头像.png','url':'https://example.test/icon.png'}]}}
        with patch.object(archive,'api',side_effect=api):
            records,errors=archive.discover_wiki()
        self.assertEqual(errors,[])
        self.assertEqual([(r['id'],r['name']) for r in records],[('gfl2-daiyan','Daiyan'),('wutheringwaves-'+archive.hashlib.sha1('露帕'.encode()).hexdigest()[:12],'露帕')])
    def test_empty_source_is_reported_as_gap(self):
        with patch.object(archive,'api',return_value={'query':{}}):
            records,errors=archive.discover_wiki()
        self.assertEqual(records,[])
        self.assertEqual({e['gameId'] for e in errors},{'gfl2','wutheringwaves'})
    def test_conversion_preserves_visible_body_and_transparency(self):
        image=Image.new('RGBA',(800,1200))
        image.paste((250,160,90,255),(200,100,600,1100))
        raw=io.BytesIO();image.save(raw,'PNG')
        data,size=archive.convert(raw.getvalue())
        with Image.open(io.BytesIO(data)) as converted:
            self.assertEqual(size,(448,1048))
            self.assertEqual(converted.getchannel('A').getbbox(),(24,24,424,1024))
    def test_reject_small_portrait(self):
        raw=io.BytesIO();Image.new('RGB',(128,128)).save(raw,'PNG')
        with self.assertRaises(ValueError):archive.convert(raw.getvalue())

if __name__=='__main__':unittest.main()
