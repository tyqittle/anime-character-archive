#!/usr/bin/env python3
"""Import verified Arknights full character illustrations into the local archive.
Source: fexli/ArknightsResource charpack (game art copyright remains with Hypergryph).
"""
import json, os, pathlib, re, urllib.request, urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1]
FILE=ROOT/'data/characters.json'
ASSETS=ROOT/'assets/portraits'
SOURCE='https://api.github.com/repos/fexli/ArknightsResource/contents/charpack'
RAW='https://raw.githubusercontent.com/fexli/ArknightsResource/main/charpack/'
HEADERS={'User-Agent':'GameCharacterArchive/1.0','Accept':'application/vnd.github+json'}
def download(url, limit):
    with urllib.request.urlopen(urllib.request.Request(url,headers=HEADERS),timeout=45) as r:
        return r.read(limit+1)
def main():
    db=json.loads(FILE.read_text(encoding='utf8'))
    existing={r['id'] for r in db['characters']}
    entries=json.loads(download(SOURCE,5_000_000))
    limit=int(os.environ.get('ARKNIGHTS_IMPORT_LIMIT','30'))
    count=0
    ASSETS.mkdir(parents=True,exist_ok=True)
    # Only plain charpack png files (full illustrations). Skip thumbnails marked b.
    for entry in sorted(entries,key=lambda x:x['name']):
        if count>=limit:break
        name=entry.get('name','')
        m=re.fullmatch(r'(char_[a-zA-Z0-9_]+)_(1|2)\.png',name)
        if not m or entry.get('type')!='file':continue
        stem,phase=m.groups()
        character=re.sub(r'^char_\d+_','',stem).replace('_',' ').strip().title()
        if not character:continue
        item_id='ak-'+stem+'-'+phase
        if item_id in existing:continue
        if not 50_000 < entry.get('size',0) < 7_000_000:continue
        try:
            payload=download(RAW+urllib.parse.quote(name),7_000_000)
            if len(payload)>7_000_000 or not payload.startswith(b'\x89PNG\r\n\x1a\n'):continue
            (ASSETS/(item_id+'.png')).write_bytes(payload)
            db['characters'].append({
                'id':item_id,'name':character+(' E2' if phase=='2' else ''),
                'zh':'','gameId':'arknights','game':'明日方舟','characterKey':character,
                'groupId':'','kind':'full','image':'./assets/portraits/'+item_id+'.png',
                'source':'https://github.com/fexli/ArknightsResource/blob/main/charpack/'+name,
                'originalImage':RAW+name,'variant':phase=='2',
                'license':'游戏美术版权归鹰角网络；第三方来源不代表可自由再分发'
            })
            existing.add(item_id)
            count+=1
            print('ADDED',item_id,len(payload),flush=True)
        except Exception as exc:
            print('SKIP',name,str(exc)[:160],flush=True)
    if count:
        if not any(g['id']=='arknights' for g in db.get('games',[])):
            db.setdefault('games',[]).append({'id':'arknights','name':'明日方舟','en':'Arknights'})
        db['characters'].sort(key=lambda x:(x['gameId'],x['characterKey'],x['id']))
        db['counts']={'full':len(db['characters']),'total':len(db['characters'])}
        FILE.write_text(json.dumps(db,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print('Imported Arknights',count, 'total',len(db['characters']))
if __name__=='__main__':main()
