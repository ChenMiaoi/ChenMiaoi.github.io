import { activitySchema, detailsSchema } from '../../src/lib/contributions/schema.ts';
import { createDetailReader } from './details.mjs';

export async function syncContributions({ config, projects, previous, api, now = () => new Date().toISOString() }) {
  const items = new Map();
  for (const repository of config.repositories) {
    const metadata = await api(`repos/${repository}`);
    if (metadata.private !== false) throw new Error('Contribution repository must be public');
    for (const relation of ['author', 'assignee']) {
      const query = `repo:${repository} is:open ${relation}:${config.account}`;
      for (let page = 1; ; page++) {
        const result = await api(`search/issues?q=${encodeURIComponent(query)}&per_page=100&page=${page}`);
        if (result.incomplete_results || result.total_count > 1000 || !Number.isInteger(result.total_count) || !Array.isArray(result.items)
            || (page * 100 < result.total_count && result.items.length !== 100)) throw new Error('Incomplete GitHub search; snapshot retained');
        for (const item of result.items) {
          const kind = item.pull_request ? 'pr' : 'issue';
          const expected = `https://github.com/${repository}/${kind === 'pr' ? 'pull' : 'issues'}/${item.number}`;
          if (item.html_url !== expected) throw new Error('Unexpected public record URL');
          items.set(expected, { repository, number: item.number, title: item.title, url: expected, kind,
            draft: Boolean(item.draft), updatedAt: item.updated_at,
            relations: [...new Set([...(items.get(expected)?.relations ?? []), relation])] });
        }
        if (page * 100 >= result.total_count) break;
      }
    }
  }
  const discovered = new Set(items.keys());
  // Keep previously tracked records after merge/closure or reassignment. Discovery
  // still targets open work, rather than importing an unbounded account history.
  for (const item of previous.activity.items) {
    if (previous.activity.account === config.account && config.repositories.includes(item.repository) && !items.has(item.url)) items.set(item.url, { ...item, relations: [...item.relations] });
  }
  const readDetail = createDetailReader(api, config.repositories);
  const oldDetails = new Map(previous.details.records.map((record) => [record.url, record]));
  const records = [];
  for (const project of projects) {
    const repository = project.repository.replace('https://github.com/', '').replace(/\/$/, '');
    for (const commit of project.items) {
      const url = `${project.repository}/commit/${commit.sha}`;
      records.push(oldDetails.get(url) ?? await readDetail({ repository, kind: 'commit', sha: commit.sha, url }));
    }
  }
  for (const item of items.values()) {
    const old = oldDetails.get(item.url);
    // Search supplies updated_at for open work. Unchanged records reuse their
    // validated details; disappeared records are read directly to resolve closure.
    if (discovered.has(item.url) && old?.updatedAt === item.updatedAt && old.state === (item.draft ? 'draft' : 'open')) {
      item.state = old.state;
      records.push(old);
      continue;
    }
    const path = `repos/${item.repository}/${item.kind === 'pr' ? 'pulls' : 'issues'}/${item.number}`;
    const record = await api(path);
    if (record.html_url !== item.url || record.repository?.private || record.base?.repo?.private) throw new Error('Record is no longer public at the expected URL');
    const state = record.merged_at ? 'merged' : record.state === 'closed' ? 'closed' : record.draft ? 'draft' : 'open';
    const detail = old && old.updatedAt === record.updated_at && old.state === state ? old : await readDetail(item, record);
    Object.assign(item, { state, title: record.title, draft: state === 'draft', updatedAt: record.updated_at });
    records.push(detail);
  }
  const syncedAt = now();
  return { version: 1,
    activity: activitySchema.parse({ ...config, syncedAt, items: [...items.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }),
    details: detailsSchema.parse({ syncedAt, activitySyncedAt: syncedAt, records }) };
}
