import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGitHubApi } from './api.mjs';
import { syncContributions } from './sync.mjs';
import { openStore } from './store.mjs';
import { createContributionService } from './service.mjs';

const date = '2026-10-04T00:00:00.000Z';
const nextDate = '2026-10-05T00:00:00.000Z';
const config = { account: 'writer', repositories: ['example/public'] };
const url = 'https://github.com/example/public/pull/1';
const detail = { url, kind: 'pr', title: 'Public change', body: 'Hello<script>bad()</script>',
  author: 'writer', updatedAt: date, state: 'open', sha: null, files: [],
  filesComplete: true, comments: [], commentsTotal: 0, references: [],
  stats: { files: 0, additions: 0, deletions: 0 } };
const seed = { version: 1, activity: { ...config, syncedAt: date, items: [{
  repository: 'example/public', number: 1, title: detail.title, url, kind: 'pr',
  draft: false, updatedAt: date, relations: ['author'],
}] }, details: { syncedAt: date, activitySyncedAt: date, records: [detail] } };
const quiet = { info() {}, error() {} };
async function temporary(t) {
  const path = await mkdtemp(join(tmpdir(), 'orbital-contributions-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

test('seeding is one-time, restart preserves updates, invalid generations do not replace disk or memory', async (t) => {
  const path = await temporary(t);
  const store = await openStore(path, seed);
  const updated = structuredClone(seed);
  updated.activity.syncedAt = updated.details.activitySyncedAt = updated.details.syncedAt = nextDate;
  await store.replace(updated);
  const restarted = await openStore(path, seed);
  assert.equal(restarted.get().activity.syncedAt, nextDate);
  await assert.rejects(restarted.replace({ ...seed, details: { ...seed.details, records: [] } }), /Missing/);
  assert.equal(restarted.get().activity.syncedAt, nextDate);
  assert.equal(JSON.parse(await readFile(join(path, 'snapshot.json'), 'utf8')).activity.syncedAt, nextDate);
});

test('tracked PR remains after merge and unchanged detail is not downloaded again', async () => {
  const calls = [];
  const api = async (path) => {
    calls.push(path);
    if (path === 'repos/example/public') return { private: false };
    if (path.startsWith('search/')) return { total_count: 0, incomplete_results: false, items: [] };
    if (path.includes('/files')) return [[]];
    if (path.endsWith('/pulls/1')) return { html_url: url, number: 1, title: detail.title,
      updated_at: nextDate, state: 'closed', merged_at: nextDate, body: '', user: { login: 'writer' },
      changed_files: 0, additions: 0, deletions: 0, comments: 0, review_comments: 0 };
    throw new Error(`Unexpected endpoint ${path}`);
  };
  const before = JSON.stringify(seed);
  const result = await syncContributions({ config, projects: [], previous: seed, api, now: () => nextDate });
  assert.equal(JSON.stringify(seed), before);
  assert.equal(result.activity.items[0].state, 'merged');
  assert.equal(result.details.records[0].state, 'merged');
  calls.length = 0;
  await syncContributions({ config, projects: [], previous: result, api });
  assert.ok(!calls.some((path) => path.includes('/files')));
});

test('partial search, private repositories and failed detail requests preserve previous generation', async () => {
  const before = JSON.stringify(seed);
  for (const scenario of ['incomplete', 'private', 'detail']) {
    const api = async (path) => {
      if (path === 'repos/example/public') return { private: scenario === 'private' };
      if (path.startsWith('search/')) return { total_count: 0, incomplete_results: scenario === 'incomplete', items: [] };
      throw new Error('unavailable');
    };
    await assert.rejects(syncContributions({ config, projects: [], previous: seed, api }));
    assert.equal(JSON.stringify(seed), before);
  }
});

test('unchanged open work reuses details without consuming per-record requests', async () => {
  const api = async (path) => {
    if (path === 'repos/example/public') return { private: false };
    if (path.startsWith('search/')) return { total_count: 1, incomplete_results: false,
      items: [{ number: 1, html_url: url, title: detail.title, updated_at: date, pull_request: {}, draft: false }] };
    throw new Error(`Unnecessary request ${path}`);
  };
  const result = await syncContributions({ config, projects: [], previous: seed, api });
  assert.equal(result.activity.items[0].state, 'open');
  assert.equal(result.details.records[0].body, detail.body);
});

test('discover new authored/assigned issue once with both relations', async () => {
  const issueUrl = 'https://github.com/example/public/issues/2';
  const api = async (path) => {
    if (path === 'repos/example/public') return { private: false };
    if (path.startsWith('search/')) return { total_count: 1, incomplete_results: false, items: [{ number: 2, html_url: issueUrl, title: 'Issue', updated_at: nextDate }] };
    if (path.includes('/timeline')) return [[]];
    if (path.endsWith('/issues/2')) return { html_url: issueUrl, title: 'Issue', updated_at: nextDate, state: 'open', user: { login: 'writer' }, body: '', comments: 0 };
    throw new Error(`Unexpected endpoint ${path}`);
  };
  const result = await syncContributions({ config, projects: [], previous: { ...seed, activity: { ...seed.activity, items: [] } }, api });
  assert.equal(result.activity.items.length, 1);
  assert.deepEqual(result.activity.items[0].relations, ['author', 'assignee']);
});

test('HTTP feed is sanitized, validates cache, tracks updates and keeps last-good data after failure', async (t) => {
  const store = await openStore(await temporary(t), seed);
  let fail = false;
  let count = 0;
  const service = createContributionService({ store, release: 'test-release', logger: quiet,
    sync: async () => { count++; if (fail) throw new Error('offline');
      const value = structuredClone(seed);
      value.activity.syncedAt = value.details.syncedAt = value.details.activitySyncedAt = nextDate;
      return value;
    } });
  await new Promise((resolve) => service.server.listen(0, '127.0.0.1', resolve));
  t.after(() => service.stop());
  const base = `http://127.0.0.1:${service.server.address().port}`;
  const first = await fetch(`${base}/contributions.json`);
  const etag = first.headers.get('etag');
  const body = await first.json();
  assert.equal(body.activity.syncedAt, date);
  assert.doesNotMatch(body.records[0].bodyHtml, /script|bad\(\)/);
  assert.equal((await fetch(`${base}/contributions.json`, { headers: { 'If-None-Match': etag } })).status, 304);
  await Promise.all([service.refresh(), service.refresh()]);
  assert.equal(count, 1);
  fail = true;
  await service.refresh();
  const latest = await fetch(`${base}/contributions.json`);
  assert.notEqual(latest.headers.get('etag'), etag);
  assert.equal((await latest.json()).activity.syncedAt, nextDate);
  const health = await (await fetch(`${base}/api/contributions/health`)).json();
  assert.equal(health.release, 'test-release');
  assert.equal(health.syncFailed, true);
  assert.equal((await fetch(`${base}/contributions.json`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${base}/runtime/server.mjs`)).status, 404);
});

test('GitHub throttling honors reset time and rejects pagination to another host', async () => {
  let time = 1000;
  let calls = 0;
  const api = createGitHubApi({ clock: () => time, fetcher: async () => {
    calls++;
    return new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '120' } });
  } });
  await assert.rejects(api('repos/example/public'), /403/);
  await assert.rejects(api('repos/example/public'), /cooldown/);
  assert.equal(calls, 1);
  time = 122000;
  await assert.rejects(api('repos/example/public'), /403/);
  assert.equal(calls, 2);
  const paged = createGitHubApi({ fetcher: async () => new Response('[]', { headers: { link: '<https://other.invalid/steal>; rel="next"' } }) });
  await assert.rejects(paged('repos/example/public/issues', true), /origin/);
});
