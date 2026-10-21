"""Start Anime Character Archive on an available localhost port.

This local helper is optional: the public gallery is served by GitHub Pages.
Run from any working directory with Python 3 (or start-local.bat on Windows).
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import webbrowser

ROOT = Path(__file__).resolve().parent
REQUIRED = (
    'index.html',
    'characters.html',
    'spine.html',
    'data/characters.json',
    'data/spine-characters.json',
)
missing = [name for name in REQUIRED if not (ROOT / name).is_file()]
if missing:
    print('ERROR: Anime Character Archive files are missing: ' + ', '.join(missing), flush=True)
    print('Download the complete current repository ZIP and extract all files.', flush=True)
    if sys.stdin.isatty():
        input('Press Enter to exit...')
    sys.exit(1)

handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
try:
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
except OSError as exc:
    print(f'Cannot start Anime Character Archive locally: {exc}', flush=True)
    if sys.stdin.isatty():
        input('Press Enter to exit...')
    sys.exit(1)

base = f'http://127.0.0.1:{server.server_port}'
url = base + '/characters.html'
print('Anime Character Archive · 次元角色档案馆', flush=True)
print('Website:', url, flush=True)
print('Spine player:', base + '/spine.html', flush=True)
print('Keep this window open. Press Ctrl+C to stop the server.', flush=True)
webbrowser.open(url)
try:
    server.serve_forever(poll_interval=0.2)
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
