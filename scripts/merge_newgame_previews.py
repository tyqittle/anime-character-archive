#!/usr/bin/env python3
"""Compatibility CLI; publishing behavior lives in preview_repository."""
import argparse
from preview_repository import publish_catalog

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--catalog',default='data/spine-newgames.json')
    parser.add_argument('--incoming',default='tmp/newgame-merged/webps')
    parser.add_argument('--audit',default='data/newgames-preview-audit.json')
    args=parser.parse_args()
    result=publish_catalog(args.catalog,args.incoming,args.audit)
    print('NEWGAME_MERGED',result['newCapturesInThisRun'],result['counts'])

if __name__=='__main__':main()
