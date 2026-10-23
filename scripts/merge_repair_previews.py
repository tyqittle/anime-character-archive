#!/usr/bin/env python3
"""Compatibility CLI for the original repair job."""
import argparse
from pathlib import Path
from catalog_registry import load_registry
from preview_frame_pipeline import convert_frames
from preview_repository import publish_catalog,write_json

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--convert-only',action='store_true')
    args=parser.parse_args()
    if args.convert_only:
        convert_frames(Path('tmp/repair-output/frames'),Path('tmp/repair-output/webps'),lambda p:p.stem+'.webp')
        return
    results={}
    for entry in load_registry():
        results[entry['id']]=publish_catalog(entry['path'],'tmp/repair-merged/webps',
            Path('data/preview-audits')/(entry['id']+'.json'))
    write_json('data/preview-repair-audit.json',{'newCaptures':sum(r['newCapturesInThisRun'] for r in results.values()),'catalogs':results})
    print('REPAIR_PUBLISHED',sum(r['newCapturesInThisRun'] for r in results.values()))

if __name__=='__main__':main()
