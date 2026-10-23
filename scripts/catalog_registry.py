"""The same checked registry used by the browser and maintenance tools."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REGISTRY=ROOT/'data/animation-catalogs.json'

def load_registry(path=None):
    document=json.loads((Path(path) if path else REGISTRY).read_text('utf-8'))
    if document.get('schemaVersion')!=1 or not isinstance(document.get('catalogs'),list) or not document['catalogs']:
        raise ValueError('Unsupported catalog registry')
    ids,paths=set(),set()
    entries=[]
    import re
    for entry in document['catalogs']:
        ident,name,source=entry.get('id',''),entry.get('name',''),entry.get('path','')
        if not re.fullmatch(r'[a-z0-9-]+',ident) or not isinstance(name,str) or not name.strip() or not re.fullmatch(r'data/[a-zA-Z0-9_-]+\.json',source):
            raise ValueError('Invalid catalog registration')
        if ident in ids or source in paths:raise ValueError('Duplicate catalog registration')
        ids.add(ident);paths.add(source);entries.append(dict(entry))
    return entries

def catalog_paths():
    return [entry['path'] for entry in load_registry()]

def source_identity(character):
    return [character.get('engine') or 'spine', *[character.get(key) or '' for key in
        ('base','skeletonUrl','atlasUrl','modelUrl','resourceStem','spineVersion')]]
