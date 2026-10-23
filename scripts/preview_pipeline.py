#!/usr/bin/env python3
"""Registry-driven plan / convert / publish commands for CI and local repair."""
import argparse
import json
from pathlib import Path
from catalog_registry import load_registry
from preview_policy import needs_capture,filename
from catalog_registry import source_identity
from preview_repository import publish_catalog,write_json
from preview_frame_pipeline import convert_frames

def convert_batch(root,shard):
    root=Path(root)
    if shard<0:raise ValueError('Invalid shard')
    by_frame={}
    for entry in load_registry():
        for character in json.loads(Path(entry['path']).read_text('utf-8'))['characters']:
            by_frame[filename(character).replace('.webp','.png')]=character
    from audit_animation_visual_integrity import is_fragmented_character
    def validate_character_frame(frame_path, preview):
        c=by_frame.get(frame_path.name)
        if c and c.get('visualIntegrityPolicy')=='coherent-character':
            if is_fragmented_character(preview):
                raise ValueError('fragmented-character-frame: disconnected body components')
    done,failed=convert_frames(root/'frames',root/'webps',lambda path:path.stem+'.webp',
                               validate=validate_character_frame)
    failures=[]
    for failure in failed:
        character=by_frame.get(failure['file'])
        if character is None:raise ValueError('Unregistered captured frame: '+failure['file'])
        failures.append({'id':character['id'],'gameId':character['gameId'],
            'sourceIdentity':source_identity(character),'error':'blank-frame: '+failure['error']})
    write_json(root/'reports'/('shard-convert-'+str(shard)+'.json'),{'pass':[],'fail':failures})
    return done,failures

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('command',choices=['plan','convert','publish'])
    parser.add_argument('--catalog',default='')
    parser.add_argument('--shard',type=int,default=0)
    parser.add_argument('--root',default='tmp/repair-output')
    parser.add_argument('--incoming',default='tmp/repair-merged/webps')
    parser.add_argument('--pending',default='tmp/repair-pending.json')
    args=parser.parse_args()
    entries=load_registry()
    if args.catalog:
        entries=[entry for entry in entries if entry['id']==args.catalog]
        if not entries:raise ValueError('Unknown registered catalog: '+args.catalog)
    if args.command=='plan':
        characters=[c for entry in entries for c in json.loads(Path(entry['path']).read_text('utf-8'))['characters']]
        ids=[c['id'] for c in characters if needs_capture(c)]
        if len(ids)!=len(set(ids)):raise ValueError('Duplicate model ids in preview queue')
        write_json(args.pending,ids)
        shards=list(range(min(8,len(ids))))
        print('PREVIEW_PLAN',json.dumps({'pending':len(ids),'shards':shards}))
        import os
        if os.environ.get('GITHUB_OUTPUT'):
            with open(os.environ['GITHUB_OUTPUT'],'a',encoding='utf-8') as stream:
                stream.write('matrix='+json.dumps({'shard':shards})+'\n')
                stream.write('count='+str(len(shards))+'\n')
                stream.write('pending='+str(len(ids))+'\n')
    elif args.command=='convert':
        convert_batch(args.root,args.shard)
    else:
        results={}
        for entry in entries:
            results[entry['id']]=publish_catalog(entry['path'],args.incoming,
                Path('data/preview-audits')/(entry['id']+'.json'),require_identity=True)
        write_json('data/preview-pipeline-audit.json',results)
        print('PREVIEW_PUBLISHED',sum(r['newCapturesInThisRun'] for r in results.values()))

if __name__=='__main__':main()
