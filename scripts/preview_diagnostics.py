#!/usr/bin/env python3
"""Model-agnostic reasons for missing animation screenshots.

Input is the capture jobs' shard reports. The classification never invents
a preview or treats a timed-out model as verified playback.
"""
import html
import json
import re
from collections import Counter
from pathlib import Path


def failure_category(message):
    reason = str(message or '').lower()
    if 'region not found in atlas' in reason or 'attachment not found' in reason:
        return 'atlas-mismatch'
    if 'timeout' in reason or 'timed out' in reason or '超时' in reason:
        return 'timeout'
    if 'blank/' in reason or 'blank frame' in reason or 'pixel variance' in reason:
        return 'blank-frame'
    if '404' in reason or 'not found' in reason or '无法获取' in reason:
        return 'source-missing'
    if 'could not load skeleton' in reason or 'unsupported' in reason or '不支持' in reason:
        return 'skeleton-error'
    return 'render-error'


def scrub_failure_message(message):
    clean = re.sub(r'<[^>]*>', ' ', html.unescape(str(message or '')))
    return ' '.join(clean.split())[:240]


def read_capture_failures(directory):
    results = {}
    root = Path(directory)
    for report_path in sorted(root.glob('shard-*.json')):
        try:
            report = json.loads(report_path.read_text(encoding='utf-8'))
            failures = report.get('fail', [])
            if not isinstance(failures, list):
                continue
            for failure in failures:
                if not isinstance(failure, dict):
                    continue
                model_id = failure.get('id')
                if not isinstance(model_id, str) or not model_id:
                    continue
                message = scrub_failure_message(failure.get('error', ''))
                results[model_id] = {
                    'id': model_id,
                    'gameId': str(failure.get('game') or ''),
                    'category': failure_category(message),
                    'message': message,
                }
        except (OSError, ValueError, UnicodeError) as error:
            raise ValueError('Invalid capture report: ' + str(report_path)) from error
    return results


def group_capture_failures(records):
    return dict(sorted(Counter(record['category'] for record in records).items()))
