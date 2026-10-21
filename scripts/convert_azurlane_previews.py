"""Produce fully framed portrait cards from real, model-specific WebGL screenshots.

The canvas screenshot includes large empty side margins, so a generic resized
landscape frame makes the actual character almost invisible. Crop only verified
background margins, adding generous breathing room; never crop to a fixed head
or torso rectangle.
"""
from pathlib import Path
from PIL import Image, ImageOps, ImageStat, ImageChops
import sys

src=Path('tmp/al-frames')
dest=Path('assets/animation-previews')
dest.mkdir(parents=True,exist_ok=True)
count=0

def fit_subject(im):
    im=im.convert('RGB')
    width,height=im.size
    # The canvas background can be transparent black or a dark stage color.
    # Estimate from all four corners to accommodate browser render settings.
    corners=[im.getpixel(pt) for pt in [(1,1),(width-2,1),(1,height-2),(width-2,height-2)]]
    bg=tuple(sorted(c[i] for c in corners)[len(corners)//2] for i in range(3))
    baseline=Image.new('RGB',im.size,bg)
    delta=ImageChops.difference(im,baseline)
    max_channel=ImageChops.lighter(ImageChops.lighter(*delta.split()[:2]),delta.split()[2])
    mask=max_channel.point(lambda v:255 if v>=23 else 0)
    bbox=mask.getbbox()
    if not bbox:
        raise ValueError('empty character canvas')
    left,top,right,bottom=bbox
    bw,bh=right-left,bottom-top
    if bw<35 or bh<35 or max(ImageStat.Stat(im).stddev)<10:
        raise ValueError('empty or tiny character pixels')
    # Detect almost-uniform empty margins only. 12% padding protects extremities.
    if bw < width*.96 or bh < height*.96:
        px=max(14,int(bw*.12))
        py=max(14,int(bh*.12))
        im=im.crop((max(0,left-px),max(0,top-py),min(width,right+px),min(height,bottom+py)))
    im=ImageOps.contain(im,(360,420),method=Image.Resampling.LANCZOS)
    out=Image.new('RGB',(360,420),(20,34,56))
    out.paste(im,((360-im.width)//2,(420-im.height)//2))
    return out

for f in src.glob('al-*.png'):
    try:
        image=fit_subject(Image.open(f))
        image.save(dest/('azurlane-'+f.stem+'.webp'),'WEBP',quality=86,method=5)
        count+=1
    except Exception as exc:
        print('FRAME_REJECTED',f.name,exc)
print('FRAMES_CONVERTED',count)
if count==0:
    sys.exit(1)
