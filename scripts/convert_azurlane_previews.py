#!/usr/bin/env python3
"""Convert Azur Lane screenshots via the shared preview image pipeline."""
from pathlib import Path
from preview_frame_pipeline import convert_frames
convert_frames(Path('tmp/al-frames'), Path('tmp/azurlane-output/webps'), lambda p:'azurlane-'+p.stem+'.webp')
