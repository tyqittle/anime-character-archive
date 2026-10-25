"""One publisher for every registered catalog; no game-specific branches."""
import json
from pathlib import Path
import shutil
from preview_policy import ROOT, filename, relative_path, source, verified_file, apply_verified_preview, audit
from preview_diagnostics import read_capture_failures, group_capture_failures
from catalog_registry import source_identity

def write_json(path,value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_name(path.name+'.tmp')
    temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n','utf-8')
    temporary.replace(path)

def publish_catalog(manifest,incoming,audit_path,require_identity=False):
    manifest,incoming=Path(manifest),Path(incoming)
    catalog=json.loads(manifest.read_text('utf-8'))
    if not isinstance(catalog.get('characters'),list):raise ValueError('Invalid character catalog')
    reports=incoming.parent/'reports'
    failures=read_capture_failures(reports)
    identities={};success_identities={}
    for report_path in sorted(reports.glob('shard-*.json')):
        report=json.loads(report_path.read_text('utf-8'))
        for result in report.get('pass',[]):
            if 'sourceIdentity' in result:success_identities[result['id']]=result['sourceIdentity']
        for result in report.get('pass',[])+report.get('fail',[]):
            if 'sourceIdentity' in result:identities[result['id']]=result['sourceIdentity']
    ROOT.mkdir(parents=True,exist_ok=True)
    added=0;rejected=[]
    for character in catalog['characters']:
        candidate=incoming/filename(character)
        current=identities.get(character['id'])==source_identity(character)
        if candidate.is_file():
            metadata={k:v for k,v in character.items() if k not in ('previewSha256','previewWidth','previewHeight')}
            if (require_identity and success_identities.get(character['id'])!=source_identity(character)) or verified_file(metadata,incoming) is None:
                rejected.append(character['id'])
            else:
                destination=ROOT/filename(character)
                temporary=destination.with_name(destination.name+'.tmp')
                shutil.copyfile(candidate,temporary);temporary.replace(destination)
                for key in ('previewSha256','previewWidth','previewHeight'):character.pop(key,None)
                character['previewSourceIdentity']=source_identity(character)
                added+=1
        legacy_metadata=character.get('previewSourceIdentity') is None and character.get('preview')==relative_path(character) and character.get('previewSource')==source(character) and bool(character.get('previewSha256'))
        proven_existing=character.get('previewSourceIdentity')==source_identity(character) or legacy_metadata
        if (not require_identity or proven_existing) and apply_verified_preview(character):
            for key in ('previewFailureType','previewFailureReason'):character.pop(key,None)
            if 'previewStatus' in character:character['previewStatus']='captured'
        else:
            if character.get('previewSource') in ('matching-spine-animation-frame','matching-live2d-animation-frame'):
                for key in ('preview','previewSha256','previewWidth','previewHeight','previewSourceIdentity'):character.pop(key,None)
                character['previewSource']='not-rendered'
            if character.get('status')!='verified-playback':character['status']='unverified-playback'
            failure=failures.get(character['id'])
            if failure and (not require_identity or current):
                character['previewFailureType']=failure['category']
                character['previewFailureReason']=failure['message']
    summary=audit(catalog['characters'])
    characters_by_id={c['id']:c for c in catalog['characters']}
    failed=[failures[c['id']] for c in summary['missing'] if c['id'] in failures and
            (not require_identity or identities.get(c['id'])==source_identity(characters_by_id[c['id']]))]
    result={'scope':'shared preview pipeline','counts':summary['counts'],'missing':summary['missing'],
            'newCapturesInThisRun':added,'rejectedCaptures':rejected,'failedCaptures':failed,
            'failureSummary':group_capture_failures(failed)}
    write_json(manifest,catalog);write_json(audit_path,result)
    return result
