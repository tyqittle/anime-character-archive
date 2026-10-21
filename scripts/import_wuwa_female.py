#!/usr/bin/env python3
"""Import female Wuthering Waves full-body artworks from identified wiki files.
Only validated local files enter the catalog; never index avatars/half-body UI slices.
"""
import io, json, pathlib, urllib.parse, urllib.request, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image, ImageOps

ROOT=pathlib.Path(__file__).resolve().parents[1]
DB=ROOT/'data/characters.json'
OUT=ROOT/'assets/portraits'
WIKI='https://wiki.biligame.com/wutheringwaves/'
HDR={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36','Accept':'*/*'}
# Female resonators: (stable identifier, Chinese name, English name, wiki's legacy image slug).
FEMALE=[
 ('yinlin','吟霖','Yinlin','yinlin'),
 ('sanhua','散华','Sanhua','sanhua'),
 ('baizhi','白芷','Baizhi','baizhi'),
 ('jianxin','鉴心','Jianxin','jianxin'),
 ('taoqi','桃祈','Taoqi','taoqi'),
 ('danjin','丹瑾','Danjin','danjin'),
 ('verina','维里奈','Verina','verina'),
 ('encore','安可','Encore','encore'),
 ('chixia','炽霞','Chixia','chixia'),
 ('yangyang','秧秧','Yangyang','yangyang'),
 ('zhezhi','折枝','Zhezhi','zhezhi'),
 ('youhu','釉瑚','Youhu','youhu'),
 ('lumi','灯灯','Lumi','lumi'),
 ('phoebe','菲比','Phoebe','feibi'),
 ('carlotta','珂莱塔','Carlotta','kelaita'),
 ('roccia','洛可可','Roccia','luokeke'),
 ('cantarella','坎特蕾拉','Cantarella','kanteleila'),
 ('ciaccona','夏空','Ciaccona','xiakong'),
 ('zani','赞妮','Zani','zanni'),
 ('cartethyia','卡提希娅','Cartethyia','katixiya'),
]
def get(url,limit=18_000_000):
 req=urllib.request.Request(url,headers=HDR)
 with urllib.request.urlopen(req,timeout=12) as resp:
  data=resp.read(limit+1)
  if len(data)>limit:raise ValueError('oversized file')
  return data
def sources(zh,slug,en):
 # Community wiki older and newer file naming conventions.
 for name in [f'角色_{zh}_立绘.png',f'Mc wiki role {slug} x1500.png']:
  yield WIKI+'Special:FilePath/'+urllib.parse.quote(name,safe=''),name
  try:
   q=urllib.parse.urlencode({'action':'query','format':'json','prop':'imageinfo','iiprop':'url','titles':'File:'+name})
   api=json.loads(get(WIKI+'api.php?'+q,3_000_000))
   for page in api.get('query',{}).get('pages',{}).values():
    for info in page.get('imageinfo',[]):
     if info.get('url'):yield info['url'],name
  except Exception as exc:print('WIKI_API_SKIP',zh,str(exc)[:95],flush=True)
 # Fandom mirrors retain full splash images when BWIKI's file service returns 567.
 fandom='https://wutheringwaves.fandom.com/'
 english=en.replace(' ','_')
 for filename in (english+'_Splash_Art.png',english+'_Convene_Splash_Art.png'):
  yield fandom+'wiki/Special:FilePath/'+urllib.parse.quote(filename,safe=''),filename
  try:
   params=urllib.parse.urlencode({'action':'query','format':'json','prop':'imageinfo','iiprop':'url','titles':'File:'+filename})
   db=json.loads(get(fandom+'api.php?'+params,3000000))
   for page in db.get('query',{}).get('pages',{}).values():
    for info in page.get('imageinfo',[]):
     if info.get('url'):yield info['url'],filename
  except Exception as exc:print('FANDOM_API_SKIP',zh,str(exc)[:95],flush=True)
def convert(data):
 if not(data.startswith(b'\x89PNG\r\n\x1a\n') or data.startswith(b'RIFF') or data.startswith(b'\xff\xd8\xff')):
  raise ValueError('not PNG/WebP/JPEG')
 with Image.open(io.BytesIO(data)) as img:
  img.load();w,h=img.size
  if w<650 or h<950 or w/h>1.20 or w/h<.30:raise ValueError(f'not full-height art {w}x{h}')
  im=ImageOps.exif_transpose(img).convert('RGBA')
  box=im.getchannel('A').getbbox()
  if not box or box[3]-box[1]<max(700,h*.7):raise ValueError('visible art insufficient')
  x0,y0,x1,y1=box
  im=im.crop((max(0,x0-24),max(0,y0-24),min(w,x1+24),min(h,y1+24)))
  if max(im.size)>2200:im.thumbnail((2200,2200),Image.Resampling.LANCZOS)
  out=io.BytesIO();im.save(out,'WEBP',quality=89,method=4)
  if out.tell()<18000:raise ValueError('invalid tiny image')
  return out.getvalue(),(w,h)
def fetch_one(item):
 key,zh,en,slug=item
 for url,filename in sources(zh,slug,en):
  try:
   raw=get(url);payload,dimension=convert(raw)
   return item,url,filename,payload,dimension
  except Exception as exc:print('CANDIDATE_FAILED',zh,filename,str(exc)[:130],flush=True)
 return item,None,None,None,None
def main():
 db=json.loads(DB.read_text('utf8'));OUT.mkdir(parents=True,exist_ok=True)
 known={c['id']:c for c in db['characters']}
 todo=[item for item in FEMALE if 'wutheringwaves-'+item[0] not in known or item[0]=='yinlin']
 added=[];replaced=[];skipped=[]
 with ThreadPoolExecutor(max_workers=4) as ex:
  futures=[ex.submit(fetch_one,item) for item in todo]
  for f in as_completed(futures):
   item,url,filename,payload,dimension=f.result()
   key,zh,en,_=item;ident='wutheringwaves-'+key
   if payload is None:skipped.append(zh);continue
   target=OUT/(ident+'.webp');target.write_bytes(payload)
   entry={'id':ident,'name':zh,'zh':zh,'nameEn':en,'gameId':'wutheringwaves','game':'鸣潮',
          'characterKey':zh,'groupId':'','kind':'full','image':'./assets/portraits/'+target.name,
          'source':WIKI+'文件:'+urllib.parse.quote(filename),
          'originalImage':url,'variant':False,
          'license':'《鸣潮》美术版权属于库洛游戏及原权利人；来源公开不等于获准再分发'}
   if ident in known:known[ident].update(entry);replaced.append(zh)
   else:db['characters'].append(entry);known[ident]=entry;added.append(zh)
   print('IMPORTED',zh,dimension,'bytes',len(payload),url,flush=True)
 # Never advertise cropped-up torso UI images as complete illustrations.
 for key,oldurl in [('jiyan','T_RoleImgjiyan_UI.png'),('yinlin','T_RoleImgyinlin_UI.png')]:
  old=known.get('wutheringwaves-'+key)
  if old and oldurl in old.get('originalImage',''):
   db['characters']=[c for c in db['characters'] if c['id']!='wutheringwaves-'+key]
   print('REMOVED_MISLABELLED_HALF_BODY',key,flush=True)
 db['characters'].sort(key=lambda c:(c.get('gameId',''),c.get('characterKey',''),c.get('id','')))
 db['counts']={'total':len(db['characters']),'full':sum(c.get('kind')=='full' for c in db['characters'])}
 DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+'\n','utf8')
 print('SUMMARY',{'added':added,'replaced':replaced,'not_available':skipped,'total':len(db['characters'])},flush=True)
if __name__=='__main__':main()
