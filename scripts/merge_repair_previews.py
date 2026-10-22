#!/usr/bin/env python3
"""Convert and publish exact-model frames with the shared image policy."""
import argparse
import json
from pathlib import Path
import shutil
from preview_frame_pipeline import convert_frames
from preview_policy import ROOT, filename, apply_verified_preview, verified_file, audit
from preview_diagnostics import failure_category

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--convert-only',action='store_true')
    args=parser.parse_args()
    incoming=Path('tmp/repair-output')
    if args.convert_only:
        convert_frames(incoming/'frames',incoming/'webps',lambda p:p.stem+'.webp')
        return
    incoming=Path('tmp/repair-merged')
    failures={}
    for path in incoming.rglob('shard-*.json'):
        for failure in json.loads(path.read_text('utf-8')).get('fail',[]):
            failures[failure['id']]=failure
    added=0;catalog_audits={}
    ROOT.mkdir(parents=True,exist_ok=True)
    for name in ['spine-characters','spine-newgames','spine-bd2-characters','live2d-azurlane','spine-arknights-illust']:
        manifest=Path('data')/(name+'.json')
        data=json.loads(manifest.read_text('utf-8'))
        for character in data['characters']:
            candidate=incoming/'webps'/filename(character)
            if candidate.is_file() and verified_file(character,incoming/'webps') is not None:
                shutil.copyfile(candidate,ROOT/filename(character));added+=1
            if apply_verified_preview(character):
                character.pop('previewFailureType',None);character.pop('previewFailureReason',None)
            elif character['id'] in failures:
                error=failures[character['id']]['error']
                character['previewFailureType']=failure_category(error)
                character['previewFailureReason']=error
        manifest.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n','utf-8')
        catalog_audits[name]=audit(data['characters'])
    Path('data/preview-repair-audit.json').write_text(json.dumps(
        {'newCaptures':added,'catalogs':catalog_audits,'failures':list(failures.values())},
        ensure_ascii=False,indent=2)+'\n','utf-8')
    print('REPAIR_PUBLISHED',added,flush=True)

if __name__=='__main__':main()
