#!/usr/bin/env python3
"""Create model-specific, subject-fitted WebP covers from nonblank WebGL frames."""
from pathlib import Path
from PIL import Image, ImageChops, ImageOps, ImageStat

source=Path('tmp/newgame-output/frames')
output=Path('tmp/newgame-output/webps')
output.mkdir(parents=True,exist_ok=True)
converted=0
for file in source.glob('*.png'):
    try:
        im=Image.open(file).convert('RGBA')
        w,h=im.size
        if w<120 or h<120: raise ValueError('frame too small')
        alpha=im.getchannel('A')
        if alpha.getextrema()[0]<80 and alpha.getextrema()[1]>140:
            mask=alpha.point(lambda x: 255 if x>45 else 0)
        else:
            rgb=im.convert('RGB')
            pts=[rgb.getpixel(p) for p in [(1,1),(w-2,1),(1,h-2),(w-2,h-2)]]
            background=tuple(sorted(p[k] for p in pts)[2] for k in range(3))
            diff=ImageChops.difference(rgb,Image.new('RGB',rgb.size,background))
            bands=diff.split()
            channel=ImageChops.lighter(ImageChops.lighter(bands[0],bands[1]),bands[2])
            mask=channel.point(lambda x:255 if x>23 else 0)
        bbox=mask.getbbox()
        if not bbox: raise ValueError('empty model canvas')
        x0,y0,x1,y1=bbox
        if x1-x0<30 or y1-y0<30: raise ValueError('tiny subject bounds')
        if max(ImageStat.Stat(im.convert('RGB')).stddev)<9: raise ValueError('near-blank screenshot')
        padx=max(10,round((x1-x0)*.15));pady=max(10,round((y1-y0)*.15))
        crop=im.crop((max(0,x0-padx),max(0,y0-pady),min(w,x1+padx),min(h,y1+pady)))
        crop=ImageOps.contain(crop,(360,420),method=Image.Resampling.LANCZOS)
        bg=Image.new('RGBA',(360,420),(20,34,56,255))
        bg.alpha_composite(crop,((360-crop.width)//2,(420-crop.height)//2))
        bg.convert('RGB').save(output/(file.stem+'.webp'),'WEBP',quality=84,method=5)
        converted+=1
    except Exception as e: print('NEWGAME_PREVIEW_REJECT',file.name,str(e))
print('NEWGAME_PREVIEWS_CONVERTED',converted)
