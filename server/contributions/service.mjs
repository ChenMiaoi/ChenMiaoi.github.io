import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { prepareContributionDetails } from '../../src/utils/contribution-reader.ts';

export function createContributionService({ store, sync, release = 'local', intervalMs = 900_000, logger = console }) {
  let running;
  let timer;
  let lastError = false;
  let serialized;
  let source;
  let etag;
  async function refresh() {
    if (running) return running;
    running = (async () => {
      try {
        await store.replace(await sync(store.get()));
        lastError = false;
        logger.info(`Contributions synced at ${store.get().activity.syncedAt}`);
      } catch (error) {
        lastError = true;
        logger.error(`Contribution sync failed; last complete snapshot retained: ${error.message}`);
      } finally { running = undefined; }
    })();
    return running;
  }
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate');
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
    if (path === '/api/contributions/health') {
      response.end(JSON.stringify({ ok: true, release, syncedAt: store.get().activity.syncedAt, syncFailed: lastError })); return;
    }
    if (path !== '/api/contributions' && path !== '/contributions.json') { response.writeHead(404); response.end('{}'); return; }
    try {
      if (source !== store.get()) {
        const snapshot = store.get();
        serialized = JSON.stringify({ version: 1, activity: snapshot.activity, ...prepareContributionDetails(snapshot.details) });
        etag = `"${createHash('sha256').update(serialized).digest('hex')}"`;
        source = snapshot;
      }
      response.setHeader('ETag', etag);
      if (request.headers['if-none-match'] === etag) { response.writeHead(304); response.end(); return; }
      response.end(request.method === 'HEAD' ? undefined : serialized);
    } catch { response.writeHead(503); response.end('{"error":"Contribution data unavailable"}'); }
  });
  return { server, refresh,
    startSync() {
      // The listener and build-time seed are ready before the first network call.
      timer = setInterval(() => { void refresh(); }, intervalMs);
      timer.unref();
      void refresh();
    },
    async stop() {
      clearInterval(timer);
      server.closeIdleConnections();
      await new Promise((resolve) => server.close(resolve));
      if (running) await running;
    },
  };
}
