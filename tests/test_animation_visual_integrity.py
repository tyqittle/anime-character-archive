import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
from PIL import Image, ImageDraw
from audit_animation_visual_integrity import connectivity, is_fragmented_character

class VisualIntegrityTest(unittest.TestCase):
    def setUp(self):
        self.bg = (20,34,56)
    def test_separated_parts_are_detected(self):
        img=Image.new('RGB',(360,420),self.bg)
        draw=ImageDraw.Draw(img)
        for r in ((20,30,95,130),(140,40,215,140),(35,200,115,290),(210,260,300,350)):
            draw.rectangle(r,fill=(190,150,165))
        self.assertGreaterEqual(connectivity(img)['majorComponents'],3)
        self.assertTrue(is_fragmented_character(img))
    def test_coherent_body_is_not_rejected(self):
        img=Image.new('RGB',(360,420),self.bg)
        draw=ImageDraw.Draw(img)
        draw.ellipse((135,30,225,125),fill=(210,145,130))
        draw.rectangle((140,100,230,340),fill=(190,120,160))
        draw.rectangle((95,135,155,250),fill=(200,130,140))
        draw.rectangle((220,135,285,250),fill=(200,130,140))
        self.assertFalse(is_fragmented_character(img))
        self.assertGreater(connectivity(img)['largestShare'],.9)

if __name__=='__main__':unittest.main()
