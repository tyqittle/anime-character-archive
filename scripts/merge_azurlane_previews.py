from pathlib import Path
from PIL import Image
import json
cf=Path('data/live2d-azurlane.json'); af=Path('data/azurlane-import-audit.json')
catalog=json.loads(cf.read_text()); audit=json.loads(af.read_text())
count=0;missing=[]
for c in catalog['characters']:
 if c.get('gameId')!='azurlane':continue
 p=Path('assets/animation-previews')/('azurlane-'+c['id']+'.webp')
 if not p.exists():missing.append(c['id']);continue
 try:
  with Image.open(p) as im:im.verify()
 except Exception:missing.append(c['id']);continue
 c['preview']='./assets/animation-previews/'+p.name
 c['previewSource']='matching-live2d-animation-frame'
 c['playbackStatus']='browser-preview-captured'
 count+=1
audit['sourceMatchedRenderedPreviews']=count
audit['sourceMatchedMissingPreviews']=missing
audit['previewNotice']=f'{count} model-specific WebGL frame thumbnails captured; remaining skins retain exact-source thumbnails or placeholders.'
cf.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
af.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
print('LIVE2D_PREVIEWS_PUBLISHED',count,'/242')
