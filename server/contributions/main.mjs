import { readFile } from 'node:fs/promises';
import { contributionConfig, contributionSyncConfig } from '../../src/lib/contributions/config.ts';
import { contributionActivity, contributionDetails } from '../../src/lib/contributions/snapshots.ts';
import { openStore } from './store.mjs';
import { createGitHubApi } from './api.mjs';
import { syncContributions } from './sync.mjs';
import { createContributionService } from './service.mjs';

const directory = process.env.CONTRIBUTION_DATA_DIR;
if (!directory) throw new Error('CONTRIBUTION_DATA_DIR is required');
const port = Number(process.env.CONTRIBUTION_PORT ?? 4336);
const intervalMs = Number(process.env.CONTRIBUTION_SYNC_SECONDS ?? 900) * 1000;
if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isFinite(intervalMs) || intervalMs < 60_000) throw new Error('Invalid service configuration');
const store = await openStore(directory, { version: 1, activity: contributionActivity, details: contributionDetails });
let release = 'local';
try { release = JSON.parse(await readFile(new URL('../deployment.json', import.meta.url), 'utf8')).release; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const api = createGitHubApi({ token: process.env.GITHUB_TOKEN });
const detailCache = new Map(contributionDetails.records.map((record) => [record.url, record]));
const service = createContributionService({ store, release, intervalMs,
  sync: (previous) => syncContributions({ previous, api, detailCache, config: contributionSyncConfig, projects: contributionConfig.projects }) });
service.server.listen(port, '127.0.0.1', () => {
  console.info(`Contribution service ready on 127.0.0.1:${port}`);
  if (process.env.CONTRIBUTION_SYNC_DISABLED !== '1') service.startSync();
});
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
  const deadline = setTimeout(() => process.exit(1), 20_000);
  deadline.unref();
  void service.stop().then(() => process.exit(0));
});
