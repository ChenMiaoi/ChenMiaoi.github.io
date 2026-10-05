import assert from 'node:assert/strict';
import test from 'node:test';
import { readPullRequestStatus } from './pull-request-status.mjs';
import { summarizeChecks } from '../../src/lib/contributions/checks.ts';
import { syncContributions } from './sync.mjs';

const head = 'a'.repeat(40), base = 'b'.repeat(40), merge = 'c'.repeat(40);
const date = '2026-10-05T00:00:00Z';
const repository = 'example/public';
const url = `https://github.com/${repository}/pull/1`;
const record = { html_url: url, title: 'Change', state: 'open', updated_at: date,
  head: { sha: head, label: 'writer:feature' }, base: { sha: base, ref: 'main' },
  merge_commit_sha: merge, mergeable: true, mergeable_state: 'unstable',
  labels: [{ name: 'enhancement' }], requested_reviewers: [{ login: 'reviewer' }] };
const run = (sha, id, conclusion = 'success') => ({ id, name: 'build', head_sha: sha,
  app: { id: 1 }, status: 'completed', conclusion, html_url: `${url}/checks?check_run_id=${id}` });
function fixture({ racing = false, incomplete = false, wrongSha = false, failed = true } = {}) {
  return async (path) => {
    if (path.endsWith('/pulls/1')) return racing ? { ...record, head: { sha: 'd'.repeat(40) } } : record;
    const sha = path.split('/commits/')[1]?.split('/')[0];
    if (path.includes('/check-runs?')) return [
      { total_count: incomplete ? 3 : 2, check_runs: [run(wrongSha ? base : sha, 1)] },
      { total_count: 2, check_runs: [run(sha, 2, sha === merge && failed ? 'failure' : 'success')] },
    ];
    if (path.includes('/status?')) return [{ sha, total_count: 1,
      statuses: [{ context: 'external CI', state: 'pending', description: 'Queued', target_url: 'https://ci.example.com/run/1' }] }];
    throw new Error(`Unexpected endpoint ${path}`);
  };
}

test('CI includes head and merge-test checks, latest attempts and external statuses', async () => {
  const status = await readPullRequestStatus(fixture(), repository, 1, record);
  assert.equal(status.checks.length, 4);
  assert.equal(status.checks.filter(c => c.ref === 'merge').length, 2);
  assert.ok(status.checks.every(c => !c.url?.includes('check_run_id=1')));
  assert.equal(status.baseRef, 'main');
  assert.deepEqual(status.requestedReviewers, ['reviewer']);
  assert.deepEqual(summarizeChecks(status.checks), { passed: 1, failed: 1, pending: 2, neutral: 0, total: 4, state: 'failed' });
});

test('partial pagination, mismatched SHA and a push during CI collection reject the snapshot', async () => {
  for (const options of [{ incomplete: true }, { wrongSha: true }, { racing: true }])
    await assert.rejects(readPullRequestStatus(fixture(options), repository, 1, record));
});

test('no checks and neutral/skipped/cancelled outcomes never appear as all passing', () => {
  assert.equal(summarizeChecks([]).state, 'none');
  const check = { status: 'completed', conclusion: 'skipped' };
  assert.equal(summarizeChecks([check]).state, 'neutral');
  assert.equal(summarizeChecks([check, { ...check, conclusion: 'success' }]).state, 'neutral');
  assert.equal(summarizeChecks([{ ...check, conclusion: 'cancelled' }]).state, 'failed');
});

test('same PR timestamp and SHA still refresh CI while retaining expensive details', async () => {
  const old = { url, kind: 'pr', title: 'Change', state: 'open', updatedAt: date, fetchedAt: new Date().toISOString(),
    detailVersion: 3, headSha: head, baseSha: base, sha: null, body: 'Description', author: 'writer',
    files: [], filesComplete: true, stats: null, comments: [], commentsTotal: 0, references: [] };
  const previous = { activity: { account: 'writer', repositories: [repository], syncedAt: date, items: [] }, details: { records: [old] } };
  const ciApi = fixture({ failed: false });
  const api = async (path) => path === `repos/${repository}` ? { private: false } : path.startsWith('search/') ? {
    total_count: 1, incomplete_results: false, items: [{ number: 1, title: 'Change', html_url: url, updated_at: date, pull_request: {} }],
  } : ciApi(path);
  const first = await syncContributions({ config: { account: 'writer', repositories: [repository] }, projects: [], previous, api });
  assert.equal(first.details.records[0].body, 'Description');
  assert.equal(first.details.records[0].pullRequest.checks.length, 4);
  const failApi = fixture();
  const next = await syncContributions({ config: { account: 'writer', repositories: [repository] }, projects: [], previous: first,
    api: async path => path.includes('/commits/') ? failApi(path) : api(path) });
  assert.equal(summarizeChecks(next.details.records[0].pullRequest.checks).state, 'failed');
  assert.equal(summarizeChecks(first.details.records[0].pullRequest.checks).failed, 0);
});
