'use strict';

// Trigger the existing branch-based Pages publisher after content bots finish.
// No repository settings, artifacts or credentials are copied between workflows.
async function requestPagesBuild({
  github, owner, repo, branch = 'main', attempts = 60, delayMs = 10000,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), log = () => {}
}) {
  const params = { owner, repo };
  const { data: site } = await github.rest.repos.getPages(params);
  if (site.build_type !== 'legacy' || site.source?.branch !== branch || site.source?.path !== '/') {
    throw new Error('Expected the existing Pages source at ' + branch + ':/; configure an explicit artifact deployment before changing this contract.');
  }
  const { data: head } = await github.rest.repos.getBranch({ ...params, branch });
  const expected = head.commit.sha;
  await github.rest.repos.requestPagesBuild(params);
  log('Requested Pages build containing ' + expected);
  const inclusion = new Map([[expected, true]]);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const { data: build } = await github.rest.repos.getLatestPagesBuild(params);
    if (build.commit && ['built', 'errored'].includes(build.status)) {
      if (!inclusion.has(build.commit)) {
        const { data: comparison } = await github.rest.repos.compareCommitsWithBasehead({
          ...params, basehead: expected + '...' + build.commit
        });
        inclusion.set(build.commit, ['identical', 'ahead'].includes(comparison.status));
      }
      if (inclusion.get(build.commit)) {
        if (build.status === 'errored') {
          throw new Error('Pages build failed: ' + (build.error?.message || build.commit));
        }
        return { expected, commit: build.commit, url: site.html_url };
      }
    }
    if (attempt + 1 < attempts) await sleep(delayMs);
  }
  throw new Error('Timed out waiting for Pages to publish commit ' + expected);
}

module.exports = { requestPagesBuild };
