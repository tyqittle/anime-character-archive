import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const textFile = /\.(?:json|js|mjs|cjs|py|ps1|ya?ml|html|css|md|txt|toml|bat|cs|csproj)$/i;
const mediaFile = /^assets\/(?:portraits|thumbs|animation-previews)\/.+\.(?:png|webp|jpe?g|gif|avif)$/i;
const generatedDirectory = /(^|\/)(?:node_modules|__pycache__|\.pytest_cache|\.cache|\.vs)(?:\/|$)/;
const rootOutput = /^(?:tmp|temp|build|dist|artifacts|coverage|test-results|playwright-report)\//;
const desktopOutput = /^(?:desktop|native-desktop)\/(?:[^/]+\/)*(?:bin|obj|dist|out)\//;

export function isGeneratedPath(file) {
  const name = file.replaceAll('\\', '/');
  return generatedDirectory.test(name) || rootOutput.test(name) || desktopOutput.test(name) || /\.py[co]$/i.test(name);
}

// Static references produce review candidates only. Dynamically built paths need
// human verification; this tool never deletes files or rewrites an audit.
export function auditRepository(files, readText) {
  const references = new Set();
  for (const file of files) {
    if (!textFile.test(file.path)) continue;
    const source = readText(file.path);
    for (const match of source.matchAll(/assets\/(?:portraits|thumbs|animation-previews)\/[^"'`\s<>\\)\]}]+/g)) {
      references.add(match[0].split(/[?#]/, 1)[0]);
    }
  }
  const media = files.filter(file => mediaFile.test(file.path));
  const unreferencedMedia = media.filter(file => !references.has(file.path));
  return {
    trackedFiles: files.length,
    trackedBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    mediaFiles: media.length,
    mediaBytes: media.reduce((sum, file) => sum + file.bytes, 0),
    generatedTracked: files.filter(file => isGeneratedPath(file.path)),
    unreferencedMedia,
    note: 'unreferencedMedia are static-analysis candidates, not automatic deletion approvals; check dynamic paths and compatibility first.'
  };
}

export function main(args = process.argv.slice(2)) {
  if (args.some(arg => arg !== '--check')) throw new Error('Usage: node scripts/audit_repository_hygiene.mjs [--check]');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const files = tracked.split('\0').filter(Boolean).flatMap(name => {
    const absolute = path.join(root, name);
    if (!fs.existsSync(absolute)) return [];
    const stat = fs.lstatSync(absolute);
    return stat.isFile() ? [{ path: name, bytes: stat.size }] : [];
  });
  const result = auditRepository(files, name => fs.readFileSync(path.join(root, name), 'utf8'));
  console.log(JSON.stringify(result, null, 2));
  if (args.includes('--check') && result.generatedTracked.length) process.exitCode = 1;
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
