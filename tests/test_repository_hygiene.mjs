import test from 'node:test';
import assert from 'node:assert/strict';
import { auditRepository, isGeneratedPath } from '../scripts/audit_repository_hygiene.mjs';

test('hygiene flags disposable output but preserves native build source and incremental thumbnail state', () => {
  for (const name of ['tmp/render.png', 'build/bd2/results.json', 'desktop/dist/app.exe', 'native-desktop/bin/a.dll', 'native-desktop/X/obj/state', 'scripts/__pycache__/x.pyc', 'node_modules/x/index.js', 'scripts\\__pycache__\\x.pyc']) {
    assert.equal(isGeneratedPath(name), true, name);
  }
  for (const name of ['native-desktop/build/Test-Installer.ps1', 'scripts/build_portrait_thumbs.py', 'assets/thumbs/.thumb-build-state.json', 'data/spine-bd2-pilot.json']) {
    assert.equal(isGeneratedPath(name), false, name);
  }
});

test('hygiene distinguishes indexed media, cache-busted links and unreferenced candidates', () => {
  const sources = {
    'data/example.json': JSON.stringify({ image: './assets/portraits/used.webp', preview: './assets/animation-previews/frame.webp' }),
    'characters.html': '<img src="./assets/thumbs/used.webp?v=1">'
  };
  const files = [
    ...Object.keys(sources).map(path => ({ path, bytes: 1 })),
    ...['assets/portraits/used.webp', 'assets/thumbs/used.webp', 'assets/animation-previews/frame.webp', 'assets/portraits/orphan.webp'].map(path => ({ path, bytes: 10 }))
  ];
  const result = auditRepository(files, name => sources[name]);
  assert.equal(result.mediaFiles, 4);
  assert.equal(result.mediaBytes, 40);
  assert.deepEqual(result.unreferencedMedia, [{ path: 'assets/portraits/orphan.webp', bytes: 10 }]);
  assert.deepEqual(result.generatedTracked, []);
});

test('hygiene reports generated tracked files without rewriting inputs or reading binary media as text', () => {
  const files = Object.freeze([Object.freeze({ path: 'assets/portraits/a.webp', bytes: 12 }), Object.freeze({ path: 'tmp/results.json', bytes: 2 })]);
  const reads = [];
  const result = auditRepository(files, name => { reads.push(name); return '{}'; });
  assert.deepEqual(reads, ['tmp/results.json']);
  assert.equal(result.trackedBytes, 14);
  assert.deepEqual(result.generatedTracked, [{ path: 'tmp/results.json', bytes: 2 }]);
  assert.match(result.note, /not automatic deletion/);
});
