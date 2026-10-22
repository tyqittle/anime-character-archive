"""Full-art compression must preserve all RGBA pixels and skip unsafe paths."""
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image

module_path=Path(__file__).resolve().parents[1]/'scripts/optimize_static_storage.py'
spec=importlib.util.spec_from_file_location('static_storage',module_path)
storage=importlib.util.module_from_spec(spec);spec.loader.exec_module(storage)

class StorageTest(unittest.TestCase):
    def test_lossless_keeps_transparent_rgb_and_dimensions(self):
        original=Image.new('RGBA',(320,640))
        for y in range(640):
            for x in range(320):
                original.putpixel((x,y),(x%256,y%256,(x+y)%256,0 if x<10 else 255))
        raw=io.BytesIO();original.save(raw,'PNG')
        payload=storage.lossless_bytes(io.BytesIO(raw.getvalue()))
        with Image.open(io.BytesIO(payload)) as result:
            self.assertEqual(result.size,original.size)
            self.assertEqual(result.convert('RGBA').tobytes(),original.tobytes())
    def test_only_archive_png_paths_can_be_modified(self):
        for image in ('../outside.png','./assets/portraits/../outside.png','./other/outside.png','https://example.test/image.png'):
            self.assertIsNone(storage.optimize_one({'id':'demo','image':image}))

if __name__=='__main__':unittest.main()
