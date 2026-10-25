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
    identity = [character.get('engine') or 'spine', *[character.get(key) or '' for key in
        ('base','skeletonUrl','atlasUrl','modelUrl','resourceStem','spineVersion')]]
    if character.get('atlasCoordinateSpace'):
        identity.append('atlas-coordinate-space:' + character['atlasCoordinateSpace'])
    if 'atlasEdgeExtrusion' in character:
        identity.append('atlas-edge-extrusion:' + str(character['atlasEdgeExtrusion']))
    excluded=character.get('portraitFraming',{}).get('excludeDrawables',[])
    if excluded:
        identity.append('portrait-framing-excluded-drawables:'+json.dumps(sorted(set(excluded)),ensure_ascii=False,separators=(',',':')))
    return identity


def read_characters():
    records=[c for entry in load_registry() for c in json.loads((ROOT/entry['path']).read_text(encoding='utf-8'))['characters']]
    ids=[c.get('id') for c in records]
    if any(not isinstance(ident,str) or not ident for ident in ids) or len(ids)!=len(set(ids)):
        raise ValueError('Invalid or duplicate registered model ID')
    return records


def merge_catalog_records(existing,incoming,registered=None,update_existing=()):
    registered=existing if registered is None else registered
    global_ids={c['id']:c for c in registered};old_ids={c['id']:c for c in existing}
    if len(global_ids)!=len(registered) or len(old_ids)!=len(existing):raise ValueError('Duplicate registered model ID')
    replacements={};updates=set(update_existing)
    for c in incoming:
        ident=c.get('id')
        if not isinstance(ident,str) or not ident or ident in replacements:raise ValueError('Duplicate or invalid incoming model ID')
        old=old_ids.get(ident)
        if old is None and ident in global_ids:raise ValueError('Model ID belongs to another catalog: '+ident)
        if old is None:
            replacements[ident]=dict(c);continue
        for key in ('gameId','skinCode'):
            if (old.get(key) or '')!=(c.get(key) or ''):raise ValueError('Conflicting '+key+' for existing model: '+ident)
        if (old.get('engine') or 'spine')!=(c.get('engine') or 'spine'):raise ValueError('Conflicting engine for existing model: '+ident)
        same=source_identity(old)==source_identity(c)
        if not same and ident not in updates:raise ValueError('Source replacement requires --update-existing '+ident)
        result={**old,**c}
        for key in list(result):
            if key.startswith('preview') or key in ('status','playbackStatus'):
                if same and key in old:result[key]=old[key]
                else:result.pop(key)
        if not same:result.update(status='indexed-unverified',playbackStatus='not-verified',previewSource='not-rendered')
        replacements[ident]=result
    result=[replacements.pop(c['id'],c) for c in existing]
    return result+list(replacements.values())
