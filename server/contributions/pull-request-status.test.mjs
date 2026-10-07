import assert from 'node:assert/strict';
import test from 'node:test';
import { readPullRequestStatus } from './pull-request-status.mjs';
import { conflictState, summarizeChecks } from '../../src/lib/contributions/checks.ts';
import { syncContributions } from './sync.mjs';
import { resolveReviewSummary, summarizeReviews } from '../../src/lib/contributions/reviews.ts';

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
function fixture({ racing = false, incomplete = false, wrongSha = false, failed = true, reviews = [] } = {}) {
  return async (path) => {
    if (path.endsWith('/pulls/1')) return racing ? { ...record, head: { sha: 'd'.repeat(40) } } : record;
    if (path.includes('/reviews?')) return reviews;
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

const review = (id, login, state) => ({ id, user: { login }, state, submitted_at: date });
test('review summary deduplicates reviewers, retains decisions through comments and ignores drafts', () => {
  assert.deepEqual(summarizeReviews([
    review(3, 'alice', 'COMMENTED'), review(1, 'Alice', 'APPROVED'),
    review(2, 'Bob', 'CHANGES_REQUESTED'), review(4, 'Bob', 'APPROVED'),
    review(5, 'Carol', 'COMMENTED'), { ...review(6, 'Dave', 'APPROVED'), submitted_at: null },
    review(7, 'Erin', 'PENDING'),
  ]), { approved: ['Alice', 'Bob'], changesRequested: [], commented: ['Carol'] });
});

test('dismissals and new change requests revoke prior approvals while preserving other reviewers', () => {
  assert.deepEqual(summarizeReviews([
    review(1, 'Alice', 'APPROVED'), review(2, 'Alice', 'DISMISSED'), review(3, 'Alice', 'COMMENTED'),
    review(4, 'Bob', 'APPROVED'), review(5, 'Bob', 'CHANGES_REQUESTED'), review(6, 'Carol', 'APPROVED'),
  ]), { approved: ['Carol'], changesRequested: ['Bob'], commented: [] });
});

test('submission time wins over review creation order', () => {
  assert.deepEqual(summarizeReviews([
    review(2, 'Alice', 'CHANGES_REQUESTED'),
    { ...review(1, 'Alice', 'APPROVED'), submitted_at: '2026-10-06T00:00:00Z' },
  ]), { approved: ['Alice'], changesRequested: [], commented: [] });
});

test('review summaries include later pages and refresh even when the PR timestamp is unchanged', async () => {
  const pages = [[review(1, 'Alice', 'APPROVED')], [review(2, 'Bob', 'CHANGES_REQUESTED')]];
  const approved = await readPullRequestStatus(fixture({ reviews: pages }), repository, 1, record);
  assert.deepEqual(approved.reviewSummary.approved, ['Alice']);
  assert.deepEqual(approved.reviewSummary.changesRequested, ['Bob']);
  pages[1].push(review(3, 'Alice', 'DISMISSED'));
  const dismissed = await readPullRequestStatus(fixture({ reviews: pages }), repository, 1, record);
  assert.deepEqual(dismissed.reviewSummary.approved, []);
  assert.deepEqual(approved.reviewSummary.approved, ['Alice']);
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

test('conflict checks distinguish code conflicts, pending computation and completed PRs', () => {
  assert.equal(conflictState({ mergeable: true, mergeState: 'blocked' }, 'open'), 'clear');
  assert.equal(conflictState({ mergeable: true, mergeState: 'behind' }, 'open'), 'clear');
  assert.equal(conflictState({ mergeable: false, mergeState: 'dirty' }, 'open'), 'conflict');
  assert.equal(conflictState({ mergeable: null, mergeState: 'unknown' }, 'open'), 'pending');
  assert.equal(conflictState(undefined, 'open'), 'unavailable');
  assert.equal(conflictState({ mergeable: true }, 'draft'), 'clear');
  assert.equal(conflictState({ mergeable: null }, 'merged'), 'not-applicable');
  assert.equal(conflictState({ mergeable: false }, 'closed'), 'not-applicable');
});

test('same PR timestamp and SHA still refresh CI and reviews while retaining expensive details', async () => {
  const old = { url, kind: 'pr', title: 'Change', state: 'open', updatedAt: date, fetchedAt: new Date().toISOString(),
    detailVersion: 3, headSha: head, baseSha: base, sha: null, body: 'Description', author: 'writer',
    files: [], filesComplete: true, stats: null, comments: [], commentsTotal: 0, references: [] };
  const previous = { activity: { account: 'writer', repositories: [repository], syncedAt: date, items: [] }, details: { records: [old] } };
  const ciApi = fixture({ failed: false, reviews: [[review(1, 'Alice', 'APPROVED')]] });
  const api = async (path) => path === `repos/${repository}` ? { private: false } : path.startsWith('search/') ? {
    total_count: 1, incomplete_results: false, items: [{ number: 1, title: 'Change', html_url: url, updated_at: date, pull_request: {} }],
  } : ciApi(path);
  const first = await syncContributions({ config: { account: 'writer', repositories: [repository] }, projects: [], previous, api });
  assert.equal(first.details.records[0].body, 'Description');
  assert.equal(first.details.records[0].pullRequest.checks.length, 4);
  assert.deepEqual(first.details.records[0].pullRequest.reviewSummary.approved, ['Alice']);
  const failApi = fixture({ reviews: [[review(1, 'Alice', 'DISMISSED')]] });
  const next = await syncContributions({ config: { account: 'writer', repositories: [repository] }, projects: [], previous: first,
    api: async path => path.includes('/commits/') || path.includes('/reviews?') ? failApi(path) : api(path) });
  assert.equal(summarizeChecks(next.details.records[0].pullRequest.checks).state, 'failed');
  assert.equal(summarizeChecks(first.details.records[0].pullRequest.checks).failed, 0);
  assert.deepEqual(next.details.records[0].pullRequest.reviewSummary.approved, []);
  assert.deepEqual(first.details.records[0].pullRequest.reviewSummary.approved, ['Alice']);
});

test('unavailable reviews reject the refresh instead of publishing an empty approval state', async () => {
  const api = fixture();
  await assert.rejects(readPullRequestStatus(async path => {
    if (path.includes('/reviews?')) throw new Error('Review API unavailable');
    return api(path);
  }, repository, 1, record), /Review API unavailable/);
});

test('legacy complete discussions resolve reviews without the new summary, while missing data stays unresolved', () => {
  const comment = (id, author, reviewState) => ({ kind: 'review', reviewState, author,
    url: `${url}#pullrequestreview-${id}`, createdAt: date });
  assert.deepEqual(resolveReviewSummary({ detailVersion: 3, comments: [comment(2, 'Bob', 'COMMENTED')] }),
    { approved: [], changesRequested: [], commented: ['Bob'] });
  assert.deepEqual(resolveReviewSummary({ detailVersion: 3, comments: [
    comment(1, 'Alice', 'APPROVED'), comment(3, 'Alice', 'DISMISSED'), comment(2, 'Bob', 'CHANGES_REQUESTED'),
  ] }), { approved: [], changesRequested: ['Bob'], commented: [] });
  assert.deepEqual(resolveReviewSummary({ detailVersion: 3, comments: [] }),
    { approved: [], changesRequested: [], commented: [] });
  assert.equal(resolveReviewSummary(), undefined);
  assert.equal(resolveReviewSummary({ detailVersion: 2, comments: [] }), undefined);
});

test('fresh review summary takes precedence over cached discussion approvals', () => {
  const reviewSummary = { fetchedAt: date, approved: [], changesRequested: ['Bob'], commented: [] };
  assert.equal(resolveReviewSummary({ detailVersion: 3, pullRequest: { reviewSummary }, comments: [
    { kind: 'review', reviewState: 'APPROVED', author: 'Alice', url: `${url}#pullrequestreview-1`, createdAt: date },
  ] }), reviewSummary);
});
