#!/usr/bin/env python3
"""Import a curated batch of SchaleDB student character portraits, as static WebP."""
import json
import pathlib
import urllib.request
import os
import re

ROOT=pathlib.Path(__file__).resolve().parents[1]
MANIFEST=ROOT/'data/characters.json'
ASSETS=ROOT/'assets/portraits'
BASE='https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/'
def download(url, maximum):
 req=urllib.request.Request(url,headers={'User-Agent':'character-archive/1.0'})
 with urllib.request.urlopen(req,timeout=40) as response:
  data=response.read(maximum+1)
 if len(data)>maximum:
  raise ValueError('File exceeds size limit: '+url)
 return data
def main():
 db=json.loads(MANIFEST.read_text(encoding='utf-8'))
 print('Fetching SchaleDB student index',flush=True)
 raw=download(BASE+'data/en/students.json',12_000_000)
 students=json.loads(raw)
 print('Metadata container:',type(students).__name__,'count',len(students),flush=True)
 if isinstance(students,dict):
  if 'Students' in students:students=students['Students']
  else:students=list(students.values())
 if not isinstance(students,list):raise RuntimeError('Unknown student index format')
 lookup={}
 for student in students:
  if isinstance(student,dict):
   sid=student.get('Id',student.get('id'))
   if sid is not None:lookup[str(sid)]=student
 print('Matched student IDs:',len(lookup),flush=True)
 existing={x['id'] for x in db['characters']}
 ASSETS.mkdir(parents=True,exist_ok=True)
 count=0
 # Scan every student in the source index, not only four hard-coded ID slices.
 # Limit additions per run to keep Actions commits and bandwidth manageable.
 limit=max(1,int(os.environ.get('BA_IMPORT_LIMIT','150')))
 for sid in sorted(lookup, key=lambda x: int(x) if x.isdigit() else 10**12):
  if count>=limit:break
  if not sid.isdigit():continue
  student=lookup.get(str(sid))
  if not student:continue
  name=student.get('Name',student.get('name'))
  if not isinstance(name,str) or not name.strip():continue
  id_='ba-'+str(sid)
  if id_ in existing:continue
  url=BASE+f'images/student/portrait/{sid}.webp'
  try:
   data=download(url,3_000_000)
   if not(data[:4]==b'RIFF' and data[8:12]==b'WEBP' and len(data)>30000):
    print('SKIP non-WebP',sid,len(data),flush=True);continue
   file=ASSETS/(id_+'.webp')
   file.write_bytes(data)
   character_key=re.sub(r'\s*\([^)]*\)\s*','',name).strip()
   db['characters'].append({'id':id_,'name':name,'zh':'','characterKey':character_key,'gameId':'bluearchive','game':'蔚蓝档案','groupId':'','kind':'full','image':'./assets/portraits/'+file.name,'source':'https://github.com/SchaleDB/SchaleDB/blob/main/images/student/portrait/'+str(sid)+'.webp','originalImage':url,'rarity':'','manufacturer':'','class':'','squad':'','variant':' (' in name,'license':'游戏角色美术权利归原权利人，资源索引来自 SchaleDB'})
   existing.add(id_)
   count+=1;print('ADDED',sid,name,len(data),flush=True)
  except Exception as exc:
   print('SKIP',sid,str(exc)[:120],flush=True)
 if count:
  games=db.setdefault('games',[])
  if not any(g.get('id')=='bluearchive' for g in games):
   games.append({'id':'bluearchive','name':'蔚蓝档案','en':'Blue Archive'})
  db['counts']={'full':len(db['characters']),'total':len(db['characters'])}
  db['characters'].sort(key=lambda x:(x.get('gameId',''),x.get('characterKey',''),x.get('id','')))
  MANIFEST.write_text(json.dumps(db,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('BA ADDED TOTAL',count,flush=True)
if __name__=='__main__':main()