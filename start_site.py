"""Start the private Winter gallery with an automatically selected localhost port."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import webbrowser

ROOT = Path(__file__).resolve().parent
REQUIRED = ('gallery.html', 'spine.html', 'data/catalog.json',
            'data/characters.json', 'data/spine-characters.json')
missing = [name for name in REQUIRED if not (ROOT / name).is_file()]
if missing:
    print('ERROR: Site files are missing:', ', '.join(missing), flush=True)
    print('Download the complete latest ZIP and extract the whole folder.', flush=True)
    input('Press Enter to exit...')
    sys.exit(1)

handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
try:
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
except OSError as exc:
    print(f'Cannot start local website: {exc}', flush=True)
    input('Press Enter to exit...')
    sys.exit(1)

url = f'http://127.0.0.1:{server.server_port}/gallery.html'
print('Winter Gallery is running.', flush=True)
print('Website:', url, flush=True)
print('Player:', f'http://127.0.0.1:{server.server_port}/spine.html', flush=True)
print('Keep this window open. Press Ctrl+C to stop the server.', flush=True)
webbrowser.open(url)
try:
    server.serve_forever(poll_interval=0.2)
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
