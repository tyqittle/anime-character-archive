import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { requestPagesBuild } = createRequire(import.meta.url)('../scripts/request_pages_build.cjs');

function fixture({ builds = [{ commit: 'expected', status: 'built' }], site, relation = 'behind' } = {}) {
  const calls = [];
  let index = 0;
  const repos = {
    async getPages() { return { data: site || { build_type: 'legacy', source: { branch: 'main', path: '/' }, html_url: 'https://example.invalid/archive/' } }; },
    async getBranch() { return { data: { commit: { sha: 'expected' } } }; },
    async requestPagesBuild() { calls.push('request'); return { data: { status: 'queued' } }; },
    async getLatestPagesBuild() { calls.push('poll'); return { data: builds[Math.min(index++, builds.length - 1)] }; },
    async compareCommitsWithBasehead({ basehead }) { calls.push(basehead); return { data: { status: relation } }; }
  };
  return { calls, options: { github: { rest: { repos } }, owner: 'owner', repo: 'archive', attempts: 3, sleep: async () => { calls.push('sleep'); } } };
}

test('Pages publisher requests a build and verifies the published source revision', async () => {
  const f = fixture();
  assert.deepEqual(await requestPagesBuild(f.options), { expected: 'expected', commit: 'expected', url: 'https://example.invalid/archive/' });
  assert.deepEqual(f.calls, ['request', 'poll']);
});
test('an earlier successful deployment does not satisfy a fresh content publication', async () => {
  const f = fixture({ builds: [{ commit: 'old', status: 'built' }, { commit: 'expected', status: 'building' }, { commit: 'expected', status: 'built' }] });
  assert.equal((await requestPagesBuild(f.options)).commit, 'expected');
  assert.equal(f.calls.filter(x => x === 'sleep').length, 2);
});
test('a newer deployment containing the requested commit satisfies concurrent publication', async () => {
  const f = fixture({ builds: [{ commit: 'newer', status: 'built' }], relation: 'ahead' });
  assert.equal((await requestPagesBuild(f.options)).commit, 'newer');
  assert.ok(f.calls.includes('expected...newer'));
});
test('a failed build for the requested source is surfaced', async () => {
  const f = fixture({ builds: [{ commit: 'expected', status: 'errored', error: { message: 'invalid site' } }] });
  await assert.rejects(requestPagesBuild(f.options), /invalid site/);
});
test('an old failed build does not reject a still pending current deployment', async () => {
  const f = fixture({ builds: [{ commit: 'old', status: 'errored' }, { commit: 'expected', status: 'built' }] });
  assert.equal((await requestPagesBuild(f.options)).commit, 'expected');
});
test('Pages publisher times out on stale success rather than claiming new data is online', async () => {
  const f = fixture({ builds: [{ commit: 'old', status: 'built' }] });
  await assert.rejects(requestPagesBuild(f.options), /Timed out/);
  assert.equal(f.calls.filter(x => x === 'poll').length, 3);
  assert.equal(f.calls.filter(x => x === 'expected...old').length, 1);
});
test('Pages source changes require an explicit deployment migration before requesting builds', async () => {
  for (const site of [
    { build_type: 'workflow', source: { branch: 'main', path: '/' } },
    { build_type: 'legacy', source: { branch: 'gh-pages', path: '/' } },
    { build_type: 'legacy', source: { branch: 'main', path: '/docs' } }
  ]) {
    const f = fixture({ site });
    await assert.rejects(requestPagesBuild(f.options), /Expected the existing Pages source/);
    assert.deepEqual(f.calls, []);
  }
});
test('Pages permission failures are visible instead of being reported as a deployment', async () => {
  const f = fixture();
  f.options.github.rest.repos.requestPagesBuild = async () => { throw new Error('Resource not accessible'); };
  await assert.rejects(requestPagesBuild(f.options), /Resource not accessible/);
});
