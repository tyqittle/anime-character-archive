from pathlib import Path
from PIL import Image, ImageOps, ImageStat
import sys
src=Path('tmp/al-frames'); dest=Path('assets/animation-previews'); dest.mkdir(parents=True,exist_ok=True)
count=0
for f in src.glob('al-*.png'):
 try:
  im=Image.open(f).convert('RGB')
  if max(ImageStat.Stat(im).stddev)<12: raise ValueError('blank canvas')
  im=ImageOps.contain(im,(300,200),method=Image.Resampling.LANCZOS)
  bg=Image.new('RGB',(300,200),(16,25,39));bg.paste(im,((300-im.width)//2,(200-im.height)//2))
  bg.save(dest/('azurlane-'+f.stem+'.webp'),'WEBP',quality=83,method=5)
  count+=1
 except Exception as exc: print('FRAME_REJECTED',f.name,exc)
print('FRAMES_CONVERTED',count)
if count==0: sys.exit(1)
