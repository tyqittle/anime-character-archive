#!/usr/bin/env python3
"""Shared screenshot-to-WebP conversion for Spine and Cubism animations.

Renderers produce PNG frames; games do not define their own crop/resize rules.
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageOps, ImageStat

OUTPUT_SIZE = (360, 420)
BACKGROUND = (20, 34, 56, 255)

def frame_to_preview(frame):
    im = frame.convert('RGBA')
    w, h = im.size
    if w < 120 or h < 120:
        raise ValueError('frame too small')
    rgb = im.convert('RGB')
    if max(ImageStat.Stat(rgb).stddev) < 9:
        raise ValueError('near blank screenshot')
    alpha = im.getchannel('A')
    lo, hi = alpha.getextrema()
    if lo < 80 and hi > 140:
        mask = alpha.point(lambda v: 255 if v > 45 else 0)
    else:
        corners = [rgb.getpixel(pt) for pt in [(1,1),(w-2,1),(1,h-2),(w-2,h-2)]]
        bg = tuple(sorted(c[i] for c in corners)[2] for i in range(3))
        delta = ImageChops.difference(rgb, Image.new('RGB', (w, h), bg))
        bands = delta.split()
        maximum = ImageChops.lighter(ImageChops.lighter(bands[0], bands[1]), bands[2])
        mask = maximum.point(lambda v: 255 if v > 23 else 0)
    bounds = mask.getbbox()
    if not bounds:
        raise ValueError('empty character canvas')
    x0,y0,x1,y1 = bounds
    if x1-x0 < 30 or y1-y0 < 30:
        raise ValueError('tiny character')
    padx = max(10, round((x1-x0)*.15))
    pady = max(10, round((y1-y0)*.15))
    crop = im.crop((max(0,x0-padx), max(0,y0-pady), min(w,x1+padx), min(h,y1+pady)))
    crop = ImageOps.contain(crop, OUTPUT_SIZE, method=Image.Resampling.LANCZOS)
    result = Image.new('RGBA', OUTPUT_SIZE, BACKGROUND)
    result.alpha_composite(crop, ((OUTPUT_SIZE[0]-crop.width)//2,(OUTPUT_SIZE[1]-crop.height)//2))
    return result.convert('RGB')

def convert_frames(source, destination, filename, validate=None):
    source, destination = Path(source), Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    done, failed = 0, []
    for path in sorted(source.glob('*.png')):
        try:
            with Image.open(path) as original:
                result = frame_to_preview(original)
            if validate is not None:
                validate(path, result)
            result.save(destination / filename(path), 'WEBP', quality=84, method=5)
            done += 1
        except (OSError, ValueError) as error:
            failed.append({'file':path.name,'error':str(error)})
            print('PREVIEW_FRAME_REJECT', path.name, error)
    print('PREVIEW_FRAMES_CONVERTED', done, 'rejected', len(failed))
    return done, failed
