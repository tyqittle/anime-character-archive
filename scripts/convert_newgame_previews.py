#!/usr/bin/env python3
"""Convert new-game screenshots via the shared preview image pipeline."""
from pathlib import Path
from preview_frame_pipeline import convert_frames
convert_frames(Path('tmp/newgame-output/frames'), Path('tmp/newgame-output/webps'), lambda p:p.stem+'.webp')
