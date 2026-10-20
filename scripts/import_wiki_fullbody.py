#!/usr/bin/env python3
"""Import selected Full Body PNGs from NIKKE International Wiki.
Skip unavailable or suspicious files. Never import icons, cover shots or sprites.
"""
import json, pathlib, re, urllib.request, urllib.parse, time
ROOT=pathlib.Path(__file__).resolve().parents[1]
FILE=ROOT/'data/characters.json'
DIR=ROOT/'assets/portraits'
API='https://nikke-goddess-of-victory-international.fandom.com/api.php'
NAMES=['2B','9S','A2','Ade','K','Signal','Poli','Miranda','Vesti','Pepper','Milk','Sugar']
def read_json(params):
 url=API+'?'+urllib.parse.urlencode(params)
 req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; CharacterArchive/1.0)','Accept':'application/json'})
 with urllib.request.urlopen(req,timeout=25) as response:return json.load(response)
def get_page(title):
 d=read_json({'action':'query','titles':'File:'+title,'prop':'imageinfo','iiprop':'url|size|mime','format':'json','formatversion':'2'})
 p=d['query']['pages'][0];return p.get('imageinfo',[{}])[0]
def main():
 db=json.loads(FILE.read_text(encoding='utf-8'))
 DIR.mkdir(parents=True,exist_ok=True)
 known={x['name'].lower() for x in db['characters']}
 added=[]
 for name in NAMES:
  if name.lower() in known:continue
  try:
   info=get_page(name+' FB.png')
   url=info.get('url','')
   if not url or not 50000<int(info.get('size',0))<12000000:continue
   req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':'https://nikke-goddess-of-victory-international.fandom.com/'})
   with urllib.request.urlopen(req,timeout=40) as response:contents=response.read(12000001)
   if not contents.startswith(b'\\x89PNG\\r\\n\\x1a\\n') or not 50000<len(contents)<12000000:continue
   id_='wiki-'+re.sub('[^a-z0-9]+','-',name.lower()).strip('-')
   file=DIR/(id_+'.png')
   file.write_bytes(contents)
   db['characters'].append({'id':id_,'name':name,'zh':'','groupId':'','kind':'full','image':'./assets/portraits/'+file.name,'avatar':'','source':'https://nikke-goddess-of-victory-international.fandom.com/wiki/File:'+urllib.parse.quote(name.replace(' ','_')+'_FB.png'),'originalImage':url,'rarity':'','manufacturer':'','class':'','squad':'','variant':False,'license':'第三方游戏美术；权利归原作者'})
   added.append(name)
  except Exception as e:print('SKIP',name,type(e).__name__,str(e)[:150],flush=True)
  time.sleep(0.1)
 db['counts']={'full':len(db['characters']),'total':len(db['characters'])}
 if added:FILE.write_text(json.dumps(db,ensure_ascii=False,indent=2)+'\\n',encoding='utf-8')
 print('Imported:',','.join(added),'count',len(added))
if __name__=='__main__':main()
