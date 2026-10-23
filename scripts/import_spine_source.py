"""Import selected commit-pinned Spine illustration bundles into a registered catalog.

Uses source-scope data, exact Atlas pages and the common preview identity contract.
Raw assets remain upstream; only verified source references are indexed locally.
"""
import argparse, hashlib, json, re, struct, time, urllib.parse, urllib.request
from pathlib import Path, PurePosixPath
from catalog_registry import source_identity

ROOT = Path(__file__).resolve().parents[1]

def retrieve(url, budget=4_000_000, header_only=False):
    deadline=time.monotonic()+25
    with urllib.request.urlopen(url, timeout=25) as response:
        if header_only:
            return response.read(32)
        chunks, size = [], 0
        while True:
            chunk = response.read(min(65536, budget-size+1))
            if time.monotonic()>deadline:raise TimeoutError('Source transfer total deadline exceeded')
            if not chunk: break
            size += len(chunk)
            if size > budget: raise ValueError('Download exceeds source budget')
            chunks.append(chunk)
        return b''.join(chunks)

def git_blob(data):
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()

def binary_version(data):
    def string(offset):
        length, shift = 0, 0
        while True:
            value = data[offset]; offset += 1
            length |= (value & 127) << shift
            if value < 128: break
            shift += 7
            if shift > 28: raise ValueError('Invalid Spine header')
        if not 1 <= length <= 120: raise ValueError('Invalid Spine string')
        return data[offset:offset+length-1].decode('utf-8'), offset+length-1
    _, offset = string(0)
    return string(offset)[0]

def model_record(scope, stem, files, download=retrieve):
    if not re.fullmatch(r'[a-zA-Z0-9_ -]+',stem) or not re.fullmatch(scope['modelPattern'], stem): raise ValueError('Unexpected model identity')
    folder=(scope['directory']+'/' if scope['directory'] else '')+stem+'/'
    extension=scope.get('skeletonExtension','skel')
    if extension not in ('skel','json'):raise ValueError('Unexpected skeleton extension')
    names=[folder+stem+'.'+extension,folder+stem+'.atlas']
    if any(not files.get(p,{}).get('size',0) for p in names): raise ValueError('Missing skeleton or Atlas')
    prefix='https://raw.githubusercontent.com/'+scope['sourceRepo']+'/'+scope['sourceCommit']+'/'+urllib.parse.quote(scope['treePrefix'],safe='/')
    def raw(p, header_only=False):
        data=download(prefix+urllib.parse.quote(p, safe='/'), header_only=header_only)
        if not header_only and git_blob(data)!=files[p]['sha']: raise ValueError('Source Git blob mismatch: '+p)
        return data
    skeleton=raw(names[0])
    is_json=skeleton.lstrip().startswith(b'{')
    version=json.loads(skeleton)['skeleton']['spine'] if is_json else binary_version(skeleton)
    if not version.startswith(scope['spineVersion']+'.'): raise ValueError('Unsupported Spine version '+version)
    atlas=raw(names[1]).decode('utf-8-sig')
    pages=list(dict.fromkeys(line.strip() for line in atlas.splitlines() if re.search(r'\.(?:png|webp|jpg)$',line.strip(),re.I) and ':' not in line))
    if not pages: raise ValueError('Atlas has no texture pages')
    textures=[]
    for page in pages:
        if PurePosixPath(page).name!=page or '\\' in page: raise ValueError('Atlas page escapes model directory')
        p=folder+page
        if not files.get(p,{}).get('size',0): raise ValueError('Missing Atlas texture '+p)
        header=raw(p,header_only=True)
        if header[:8]!=b'\x89PNG\r\n\x1a\n': raise ValueError('Texture is not decoded PNG '+p)
        width,height=struct.unpack('>II',header[16:24])
        if min(width,height)<256 or max(width,height)>16384: raise ValueError('Invalid texture dimensions')
        textures.append({'path':scope['treePrefix']+p,'sha':files[p]['sha'],'bytes':files[p]['size'],'width':width,'height':height})
    base=prefix+urllib.parse.quote(folder+stem,safe='/')
    model_id=scope.get('modelIds',{}).get(stem,stem)
    if not re.fullmatch(r'[a-zA-Z0-9_-]+',model_id):raise ValueError('Invalid catalog ID')
    return {'id':scope['idPrefix']+model_id,'gameId':scope['gameId'],'game':scope['name'],'collectionName':scope['name'],
        'engine':'spine','name':scope.get('names',{}).get(stem,'角色 / 服装 '+stem),'characterName':stem,'costumeName':stem,
        'skinCode':stem,'assetType':'character-spine','spineVersion':scope['spineVersion'],'skeletonFormat':'json' if is_json else 'skel',
        'atlasCoordinateSpace':'declared','resourceStem':stem,'base':base,'skeletonUrl':base+'.'+extension,'atlasUrl':base+'.atlas',
        'sourceRepo':scope['sourceRepo'],'sourceCommit':scope['sourceCommit'],'sourcePath':scope['treePrefix']+names[0],
        'sourceVersion':version,'skeletonBytes':len(skeleton),'atlasBytes':len(atlas.encode('utf-8')),'textures':textures,
        'status':'indexed-unverified','playbackStatus':'not-verified','previewSource':'not-rendered','visualIntegrityPolicy':'coherent-character'}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--scope',required=True);parser.add_argument('--dry-run',action='store_true');args=parser.parse_args()
    scope=next(s for s in json.loads((ROOT/'data/spine-source-scopes.json').read_text(encoding='utf-8'))['scopes'] if s['id']==args.scope)
    if not re.fullmatch(r'[\w.-]+/[\w.-]+',scope['sourceRepo']) or not re.fullmatch(r'[0-9a-f]{40}',scope['sourceCommit']):raise ValueError('Source must be pinned')
    tree=json.loads(retrieve('https://api.github.com/repos/'+scope['sourceRepo']+'/git/trees/'+scope['treeSha']+'?recursive=1',budget=12_000_000))
    if tree.get('truncated') or tree.get('sha')!=scope['treeSha']:raise ValueError('Cannot certify source tree')
    files={x['path']:x for x in tree['tree'] if x['type']=='blob'}
    dest=ROOT/scope['catalog'];catalog=json.loads(dest.read_text(encoding='utf-8'))
    previous={c['id']:c for c in catalog['characters']};accepted=[];failed=[];excluded=[]
    for stem in scope['models']:
        if stem in scope.get('qualityExclusions',{}):
            excluded.append({'stem':stem,'reason':scope['qualityExclusions'][stem]});continue
        try:
            entry=model_record(scope,stem,files)
            old=previous.get(entry['id'])
            if old and source_identity(old)==source_identity(entry):
                for key in ['preview','previewSource','previewSourceIdentity','previewSha256','previewWidth','previewHeight','status','playbackStatus','previewFailureType','previewFailureReason']:
                    if key in old:entry[key]=old[key]
            accepted.append(entry);print('SPINE_SOURCE_CHECKED',entry['id'],flush=True)
        except Exception as error:failed.append({'stem':stem,'error':str(error)});print('SPINE_SOURCE_FAILED',stem,str(error),flush=True)
    report={'scope':scope['id'],'sourceRepo':scope['sourceRepo'],'sourceCommit':scope['sourceCommit'],'selected':len(scope['models']),'checked':len(accepted),'wouldAdd':[c['id'] for c in accepted if c['id'] not in previous],'failed':failed,'qualityExclusions':excluded,'note':'Selected illustrations only; source and image-header validation is separate from browser playback.'}
    if not args.dry_run:
        incoming={c['id']:c for c in accepted};excluded_ids={scope['idPrefix']+x['stem'] for x in excluded}
        catalog['characters']=[incoming.pop(c['id'],c) for c in catalog['characters'] if c['id'] not in excluded_ids];catalog['characters']+=list(incoming.values())
        dest.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'data'/('spine-source-audit-'+scope['id']+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('SPINE_SOURCE_SUMMARY',json.dumps(report),flush=True)
    if failed:raise SystemExit(1)

if __name__=='__main__':main()
