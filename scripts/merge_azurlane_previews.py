#!/usr/bin/env python3
"""Publish Azur Lane previews using the identical validation policy as other games."""
from pathlib import Path
import json
from preview_policy import apply_verified_preview, audit

manifest = Path('data/live2d-azurlane.json')
audit_path = Path('data/azurlane-import-audit.json')
catalog = json.loads(manifest.read_text(encoding='utf-8'))
report = json.loads(audit_path.read_text(encoding='utf-8'))
for character in catalog['characters']:
    apply_verified_preview(character)
summary = audit(catalog['characters'])
report['sourceMatchedRenderedPreviews'] = sum(v['verifiedPreview'] for v in summary['counts'].values())
report['sourceMatchedMissingPreviews'] = [c['id'] for c in summary['missing']]
report['previewNotice'] = 'Same-model screenshots verified using shared preview policy; remaining models need capture.'
manifest.write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
audit_path.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('LIVE2D_PREVIEWS_PUBLISHED', report['sourceMatchedRenderedPreviews'], '/', len(catalog['characters']))
