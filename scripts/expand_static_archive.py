#!/usr/bin/env python3
"""Expand verified local full art from complete, commit-pinned source listings."""
from __future__ import annotations
import concurrent.futures
import hashlib
import io
import json
import os
from pathlib import Path
import re
import time
import urllib.parse
import urllib.request
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
GAMES = {'genshin':'原神','starrail':'崩坏：星穹铁道','arknights':'明日方舟',
         'bluearchive':'蔚蓝档案','nikke':'胜利女神：妮姬','zzz':'绝区零',
         'reverse1999':'重返未来：1999','gfl2':'少女前线2：追放','wutheringwaves':'鸣潮'}
HEADERS = {'User-Agent':'Mozilla/5.0 AnimeCharacterArchive/3.0'}
LIMIT = 18_000_000

def fetch(url, timeout=20, limit=LIMIT):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        payload = response.read(limit+1)
    if len(payload)>limit:
        raise ValueError('source exceeds size limit')
    return payload

def api(base, **params):
    return json.loads(fetch(base+'?'+urllib.parse.urlencode(
        {'action':'query','format':'json',**params}), timeout=8, limit=8_000_000))

def discover_wiki():
    """Use source file metadata, never substitute portraits or cropped UI icons."""
    records, errors = [], []
    try:
        base='https://iopwiki.com/api.php'
        result=api(base,list='categorymembers',cmtitle='Category:GFL2 Dolls',cmlimit='max')
        titles=[re.sub(r'\s*\(GFL2\)$','',p['title'].removeprefix('GFL2:')) for p in result.get('query',{}).get('categorymembers',[]) if p.get('ns',0)==0]
        if not titles: raise ValueError('source returned an empty character roster')
        for offset in range(0,len(titles),20):
            batch=titles[offset:offset+20]
            found=api(base,prop='imageinfo',iiprop='url|size',
                      titles='|'.join('File:'+name+suffix for name in batch for suffix in ['_Whole.png','_whole.png']))
            for page in found.get('query',{}).get('pages',{}).values():
                infos=page.get('imageinfo',[])
                if not infos: continue
                name=re.sub(r'^File:|[ _]Whole\.png$','',page['title'],flags=re.I)
                ident='gfl2-'+re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-')
                records.append({'id':ident,'gameId':'gfl2','name':name,'characterKey':name,
                                'url':infos[0]['url'],'source':infos[0].get('descriptionurl',base)})
    except Exception as exc:
        errors.append({'gameId':'gfl2','error':str(exc)})
    try:
        base='https://wiki.biligame.com/wutheringwaves/api.php'
        continuation={}
        for _ in range(12):
            found=api(base,list='allimages',aiprefix='角色_',ailimit='max',
                      aiprop='url|size',**continuation)
            for image in found.get('query',{}).get('allimages',[]):
                match=re.fullmatch(r'角色[ _](.+)[ _]立绘\.png',image['name'])
                if not match: continue
                name=match[1]
                ident='wutheringwaves-'+hashlib.sha1(name.encode()).hexdigest()[:12]
                records.append({'id':ident,'gameId':'wutheringwaves','name':name,'characterKey':name,
                                'url':image['url'],'source':image.get('descriptionurl',base)})
            continuation=found.get('continue',{})
            if not continuation: break
        if not any(r['gameId']=='wutheringwaves' for r in records):
            raise ValueError('source returned no full-art files')
    except Exception as exc:
        errors.append({'gameId':'wutheringwaves','error':str(exc)})
    return records, errors

def canonical(url):
    parsed=urllib.parse.urlsplit(url)
    if parsed.hostname=='raw.githubusercontent.com':
        parts=urllib.parse.unquote(parsed.path).strip('/').split('/')
        return '/'.join(parts[:2]+parts[3:])
    return urllib.parse.unquote(url)

def source_url(entry):
    if entry.get('url'): return entry['url']
    return 'https://raw.githubusercontent.com/'+entry['repo']+'/'+entry['ref']+'/'+urllib.parse.quote(entry['path'],safe='/')

def convert(payload):
    with Image.open(io.BytesIO(payload)) as original:
        original.load()
        image=ImageOps.exif_transpose(original).convert('RGBA')
        if image.width<160 or image.height<300:
            raise ValueError('source is too small for full art')
        bounds=image.getchannel('A').getbbox()
        if not bounds or bounds[3]-bounds[1]<260:
            raise ValueError('empty or tiny visible character')
        # Only transparent margins are trimmed. Opaque character art is retained.
        left,top,right,bottom=bounds
        image=image.crop((max(0,left-24),max(0,top-24),
                          min(image.width,right+24),min(image.height,bottom+24)))
        image.thumbnail((2300,2300),Image.Resampling.LANCZOS)
        output=io.BytesIO()
        image.save(output,'WEBP',quality=88,method=4)
        if output.tell()<500: raise ValueError('invalid output image')
        return output.getvalue(),image.size

def import_one(entry):
    error=None
    for attempt in range(2):
        try:
            payload=fetch(source_url(entry))
            converted,size=convert(payload)
            return entry,converted,size,None
        except Exception as exc:
            error=str(exc)
            if attempt==0: time.sleep(.2)
    return entry,None,None,error

def select_pending(catalog,plan):
    by_id={row['id']:row for row in catalog['characters']}
    by_source={canonical(row.get('originalImage','')):row for row in catalog['characters']}
    by_name={(row['gameId'],row.get('zh') or row.get('characterKey')) for row in catalog['characters']}
    known_keys={(row['gameId'],row['characterKey'].casefold()):row['characterKey'] for row in catalog['characters']}
    pending,seen_ids,seen_sources=[],set(),set()
    for entry in plan:
        entry=dict(entry)
        entry['characterKey']=known_keys.get((entry['gameId'],entry['characterKey'].casefold()),entry['characterKey'])
        url=source_url(entry)
        if entry['id'] in by_id or canonical(url) in by_source: continue
        # Wiki aliases are resolved by the source's character name.
        if entry.get('url') and (entry['gameId'],entry['characterKey']) in by_name: continue
        key=canonical(url)
        if entry['id'] in seen_ids or key in seen_sources: continue
        seen_ids.add(entry['id']);seen_sources.add(key);pending.append(entry)
    return pending

def main():
    catalog_path=ROOT/'data/characters.json'
    catalog=json.loads(catalog_path.read_text('utf-8'))
    plan=json.loads((ROOT/'data/static-source-plan.json').read_text('utf-8'))['entries']
    wiki,discovery_errors=discover_wiki()
    plan.extend(wiki)
    pending=select_pending(catalog,plan)
    by_id={row['id']:row for row in catalog['characters']}
    # Process small source catalogs first so one large game does not consume the budget.
    totals={g:sum(e['gameId']==g for e in pending) for g in GAMES}
    pending.sort(key=lambda e:(totals[e['gameId']],e['id']))
    output=ROOT/'assets/portraits'
    output.mkdir(parents=True,exist_ok=True)
    max_bytes=int(os.environ.get('STATIC_IMPORT_BYTE_BUDGET','314572800'))
    assets_used=sum(p.stat().st_size for p in (ROOT/'assets').rglob('*') if p.is_file())
    archive_limit=int(os.environ.get('STATIC_ARCHIVE_BYTE_LIMIT',str(920*1024*1024)))
    thumbnail_reserve=0
    imported,failed,deferred=[],[],[]
    written=0
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures=[pool.submit(import_one,e) for e in pending]
        for future in concurrent.futures.as_completed(futures):
            entry,payload,size,error=future.result()
            if error:
                failed.append({'id':entry['id'],'gameId':entry['gameId'],'error':error})
                print('STATIC_SKIP',entry['id'],error[:180],flush=True)
                continue
            if written+len(payload)>max_bytes or assets_used+written+thumbnail_reserve+len(payload)+90000>archive_limit:
                deferred.append(entry['id']);continue
            target=output/(entry['id']+'.webp')
            target.write_bytes(payload)
            source=entry.get('source') or ('https://github.com/'+entry['repo']+'/blob/'+entry['ref']+'/'+urllib.parse.quote(entry['path'],safe='/'))
            record={'id':entry['id'],'name':entry['name'],'zh':entry.get('zh',''),
                    'gameId':entry['gameId'],'game':GAMES[entry['gameId']],
                    'characterKey':entry['characterKey'],'groupId':'','kind':'full',
                    'image':'./assets/portraits/'+target.name,'source':source,
                    'originalImage':source_url(entry),'variant':bool(entry.get('variant')),
                    'imageWidth':size[0],'imageHeight':size[1],
                    'license':'游戏美术版权归原权利人；原始来源已保留'}
            catalog['characters'].append(record);by_id[record['id']]=record
            written+=len(payload);thumbnail_reserve+=90000;imported.append(record['id'])
            print('STATIC_ADDED',record['gameId'],record['id'],len(payload),flush=True)
    catalog['characters'].sort(key=lambda c:(c['gameId'],c['characterKey'],c['id']))
    catalog['counts']={'total':len(catalog['characters']),'full':len(catalog['characters'])}
    catalog_path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n','utf-8')
    coverage={'scope':'Recorded source snapshots, not complete released game rosters',
              'sourcesPlanned':len(plan),'added':len(imported),'writtenBytes':written,
              'archiveByteLimit':archive_limit,'failed':failed,'deferred':deferred,'discoveryErrors':discovery_errors,'games':{}}
    for game in GAMES:
        coverage['games'][game]={'registered':sum(c['gameId']==game for c in catalog['characters']),
                                'availableInSelectedSources':sum(e['gameId']==game for e in plan),
                                'added':sum(by_id[x]['gameId']==game for x in imported)}
    (ROOT/'data/static-coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2)+'\n','utf-8')
    print('STATIC_COVERAGE',json.dumps(coverage['games']),flush=True)
    print('STATIC_IMPORTED',len(imported),'failed',len(failed),'bytes',written,flush=True)

if __name__=='__main__': main()
