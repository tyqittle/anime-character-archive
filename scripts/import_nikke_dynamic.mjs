#!/usr/bin/env node
/**
 * Reconcile the NIKKE character + skin Spine source into the local catalog.
 * Exclude missing directories and event/story animations. Do not invent previews.
 * Run in the repository root: node scripts/import_nikke_dynamic.mjs
 */
import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const catalogURL = new URL('data/spine-characters.json', root);
const auditURL = new URL('data/nikke-import-audit.json', root);
const indexURL = 'https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/js/json/l2d.json';
const directoryURL = 'https://api.github.com/repos/Nikke-db/Nikke-db.github.io/contents/l2d';
async function getJSON(url) {
  const resp = await fetch(url, {headers: {'User-Agent': 'Anime-Character-Archive-NIKKE-Importer'}});
  if (!resp.ok) throw new Error(url + ' returned HTTP ' + resp.status);
  return resp.json();
}
const [source, entries] = await Promise.all([getJSON(indexURL), getJSON(directoryURL)]);
const dirs = new Set(entries.filter(e => e.type === 'dir').map(e => e.name));
const characterId = /^c\d{3}(?:_\d+|_old)?$/;
const eligible = source.filter(e => characterId.test(e.id) && dirs.has(e.id));
const missing = source.filter(e => characterId.test(e.id) && !dirs.has(e.id));
const original = JSON.parse(fs.readFileSync(catalogURL, 'utf8'));
const existing = original.characters.filter(e => e.gameId === 'nikke');
const known = new Map(existing.map(e => [e.id, e]));
const baseNames = new Map(eligible.filter(e => /^c\d{3}$/.test(e.id)).map(e => [e.id, e.name]));
if (new Set(eligible.map(e => e.id)).size !== eligible.length) throw new Error('Duplicate NIKKE source IDs');
const added = [];
const nikke = eligible.map(src => {
  const old = known.get(src.id), group = src.id.slice(0, 4);
  const item = {
    ...old,
    id: src.id,
    name: old?.name || src.name,
    spineVersion: old?.spineVersion || String(src.version || '4.0'),
    base: old?.base || 'https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/' + src.id + '/' + src.id + '_00',
    gameId: 'nikke',
    characterName: baseNames.get(group) || src.name.replace(/_old$/, '')
  };
  if (src.id !== group) item.costumeName = src.name;
  if (!old) {
    item.versionUnverified = true;
    added.push(src.id);
  }
  return item;
});
const indexedIds = new Set(nikke.map(e => e.id));
original.characters = [
  ...nikke,
  ...existing.filter(e => !indexedIds.has(e.id)),
  ...original.characters.filter(e => e.gameId !== 'nikke')
];
original.note = 'NIKKE character/skin directories indexed from upstream. Only per-character verified frame captures are shown as previews; Blue Archive lobby data preserved.';
fs.writeFileSync(catalogURL, JSON.stringify(original, null, 2) + '\n');
const audit = {
  source: 'https://github.com/Nikke-db/Nikke-db.github.io',
  sourceIndexCount: source.length,
  sourceCharacterSkinEntriesWithDirectory: eligible.length,
  previouslyIndexedNikke: existing.length,
  newlyIndexed: added.length,
  currentIndexedNikke: original.characters.filter(e => e.gameId === 'nikke').length,
  newIds: added,
  excludedCharacterEntriesWithoutDirectory: missing.map(e => ({id: e.id, name: e.name})),
  excludedSceneOrNonCharacterEntries: source.filter(e => !characterId.test(e.id)).map(e => ({id: e.id, name: e.name})),
  note: 'Source directory presence is not proof of successful skeleton download, renderer compatibility, or verified local preview. External model files are not mirrored.'
};
fs.writeFileSync(auditURL, JSON.stringify(audit, null, 2) + '\n');
console.log('NIKKE_INDEX_SYNC', JSON.stringify({added: added.length, charactersAndSkins: audit.currentIndexedNikke, missingFolders: missing.length}));
