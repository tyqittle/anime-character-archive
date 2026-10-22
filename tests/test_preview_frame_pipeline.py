"""Common crop and preview WebP output checks."""
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from preview_frame_pipeline import frame_to_preview, convert_frames

class PreviewFrameTest(unittest.TestCase):
    def test_cubism_and_spine_use_same_output(self):
        img=Image.new('RGBA',(600,700),(20,34,56,255))
        ImageDraw.Draw(img).rectangle((140,100,470,650),fill=(220,90,110,255))
        rendered=frame_to_preview(img)
        self.assertEqual(rendered.size,(360,420))
        self.assertEqual(rendered.mode,'RGB')
    def test_blank_frames_rejected(self):
        with self.assertRaises(ValueError):
            frame_to_preview(Image.new('RGB',(600,700),(0,0,0)))
    def test_conversion_from_png(self):
        with tempfile.TemporaryDirectory() as tmp:
            inp,out=Path(tmp)/'input',Path(tmp)/'output'
            inp.mkdir()
            img=Image.new('RGB',(600,700),(20,34,56))
            ImageDraw.Draw(img).rectangle((130,120,460,610),fill=(220,95,130))
            img.save(inp/'model.png')
            count, errors=convert_frames(inp,out,lambda p:p.stem+'.webp')
            self.assertEqual(count,1)
            self.assertEqual(errors,[])
            with Image.open(out/'model.webp') as frame:
                self.assertEqual(frame.size,(360,420))
