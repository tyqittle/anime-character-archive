#!/usr/bin/env python3
"""Convert new-game screenshots via the shared preview image pipeline."""
from pathlib import Path
import sys
from preview_frame_pipeline import convert_frames
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path('tmp/newgame-output')
convert_frames(root / 'frames', root / 'webps', lambda p:p.stem+'.webp')
