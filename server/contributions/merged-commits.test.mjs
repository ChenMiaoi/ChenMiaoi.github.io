import assert from 'node:assert/strict';
import test from 'node:test';
import { collectMergedCommits } from './merged-commits.mjs';

const repository = 'example/public';
const sha = 'a'.repeat(40);
const url = `https://github.com/${repository}/pull/1`;
const commitUrl = `https://github.com/${repository}/commit/${sha}`;
const date = '2026-10-06T17:09:29Z';
const activity = { account: 'writer', items: [{ repository, number: 1, kind: 'pr', url }] };
const pr = { kind: 'pr', url, author: 'Writer', state: 'merged', mergedAt: date, mergeCommitSha: sha,
  commits: Array.from({ length: 5 }, (_, i) => ({ sha: String(i).repeat(40) })) };
const commit = { kind: 'commit', url: commitUrl, sha, title: 'Upstream squash result', state: 'commit' };

test('five development commits produce one confirmed upstream result and cache on later refreshes', async () => {
  const calls = [];
  const readDetail = async descriptor => { calls.push(descriptor); return commit; };
  const before = structuredClone({ activity, records: [pr] });
  const result = await collectMergedCommits({ activity, records: [pr], readDetail });
  assert.deepEqual(calls, [{ repository, kind: 'commit', sha, url: commitUrl }]);
  assert.deepEqual(result, [pr, commit]);
  assert.deepEqual({ activity, records: [pr] }, before);
  const refreshed = await collectMergedCommits({ activity, records: [pr], previous: result,
    readDetail: () => { throw new Error('Immutable commit should be cached'); } });
  assert.deepEqual(refreshed, result);
});

test('open, unmerged closed and other authors PRs never become personal upstream commits', async () => {
  for (const extra of [{ state: 'open', mergedAt: null }, { state: 'closed', mergedAt: null },
    { author: 'someone-else' }, { mergeCommitSha: null }, { mergedAt: null }]) {
    const record = { ...pr, ...extra };
    assert.deepEqual(await collectMergedCommits({ activity, records: [record],
      readDetail: () => { throw new Error('No commit should be imported'); } }), [record]);
  }
});

test('curated abbreviated commits and repeated PR records are counted once per upstream SHA', async () => {
  const curated = { ...commit, url: commitUrl.slice(0, -30) };
  assert.deepEqual(await collectMergedCommits({ activity, records: [pr, curated],
    readDetail: () => { throw new Error('Already curated'); } }), [pr, curated]);
  let reads = 0;
  const result = await collectMergedCommits({ activity: { ...activity, items: [...activity.items, ...activity.items] },
    records: [pr], readDetail: async () => { reads++; return commit; } });
  assert.equal(reads, 1);
  assert.equal(result.filter(record => record.kind === 'commit').length, 1);
});

test('unavailable or mismatched merge results fail the complete refresh without fabricating a commit', async () => {
  for (const readDetail of [async () => { throw new Error('GitHub unavailable'); },
    async () => ({ ...commit, sha: 'b'.repeat(40) }), async () => ({ ...commit, url: 'https://github.com/other/repo/commit/' + sha })]) {
    await assert.rejects(collectMergedCommits({ activity, records: [pr], readDetail }));
  }
});
