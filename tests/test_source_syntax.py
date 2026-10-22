"""Compile every maintenance script without executing import/download side effects."""
import ast
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class SourceSyntaxTest(unittest.TestCase):
    def test_all_python_sources_parse(self):
        for file in [ROOT / 'start_site.py', *sorted((ROOT / 'scripts').glob('*.py'))]:
            with self.subTest(file=file.name):
                ast.parse(file.read_text(encoding='utf-8'), filename=str(file))
