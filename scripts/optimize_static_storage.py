#!/usr/bin/env python3
"""Reduce archive size with pixel-identical WebP before filling source gaps."""
from concurrent.futures import ThreadPoolExecutor, as_completed
import io
import json
from pathlib import Path
import re
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]

def lossless_bytes(source):
    with Image.open(source) as original:
        original.load()
        if original.mode not in ('RGB','RGBA','P','L','LA'):
            return None
        rgba=original.convert('RGBA')
        info={key:original.info[key] for key in ('icc_profile','exif') if original.info.get(key)}
        output=io.BytesIO()
        rgba.save(output,'WEBP',lossless=True,exact=True,method=4,**info)
        payload=output.getvalue()
        with Image.open(io.BytesIO(payload)) as restored:
            if restored.size!=rgba.size or restored.convert('RGBA').tobytes()!=rgba.tobytes():
                raise ValueError('Lossless pixel verification failed')
        return payload

def optimize_one(character):
    image=character.get('image','')
    if not re.fullmatch(r'\./assets/portraits/[a-zA-Z0-9_-]+\.png',image):
        return None
    source=ROOT/image.removeprefix('./')
    if not source.is_file(): return None
    before=source.stat().st_size
    payload=lossless_bytes(source)
    if payload is None or len(payload)>=before: return None
    target=source.with_suffix('.webp')
    target.write_bytes(payload)
    source.unlink()
    return {'id':character['id'],'image':'./assets/portraits/'+target.name,
            'before':before,'after':len(payload)}

def main():
    manifest=ROOT/'data/characters.json'
    data=json.loads(manifest.read_text('utf-8'))
    by_id={c['id']:c for c in data['characters']}
    results,failed=[],[]
    with ThreadPoolExecutor(max_workers=4) as pool:
        tasks={pool.submit(optimize_one,c):c['id'] for c in data['characters'] if c['image'].endswith('.png')}
        for future in as_completed(tasks):
            try:
                result=future.result()
                if result:
                    by_id[result['id']]['image']=result['image']
                    results.append(result)
                    print('LOSSLESS_WEBP',result['id'],result['before']-result['after'],flush=True)
            except Exception as exc:
                failed.append({'id':tasks[future],'error':str(exc)})
    manifest.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n','utf-8')
    audit={'converted':len(results),'savedBytes':sum(r['before']-r['after'] for r in results),
           'policy':'Identical decoded RGBA pixels; original dimensions and source URLs retained',
           'failed':failed,'files':results}
    (ROOT/'data/static-storage-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n','utf-8')
    print('LOSSLESS_SUMMARY',json.dumps({k:v for k,v in audit.items() if k!='files'}),flush=True)

if __name__=='__main__':main()
