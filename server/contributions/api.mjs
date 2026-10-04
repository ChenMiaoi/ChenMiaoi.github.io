// Only the service contacts GitHub. Tokens never enter the public response.
export function createGitHubApi({ token, fetcher = fetch, clock = Date.now } = {}) {
  let blockedUntil = 0;
  async function request(endpoint) {
    if (clock() < blockedUntil) throw new Error('GitHub rate limit cooldown');
    if (!/^(repos\/|search\/issues\?)/.test(endpoint) || endpoint.includes('..')) throw new Error('Invalid GitHub endpoint');
    const response = await fetcher(`https://api.github.com/${endpoint}`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'Miao-Blog-Contributions',
        ...(token ? { authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(30_000), redirect: 'error',
    });
    const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
    const retry = Number(response.headers.get('retry-after')) * 1000;
    if (response.headers.get('x-ratelimit-remaining') === '0' || response.status === 429 || (response.status === 403 && retry)) {
      blockedUntil = Math.max(clock() + Math.max(60_000, retry), Number.isFinite(reset) ? reset + 1000 : 0);
    }
    if (!response.ok) throw new Error(`GitHub request failed (${response.status})`);
    return { data: await response.json(), next: response.headers.get('link')?.match(/<([^>]+)>; rel="next"/)?.[1] };
  }
  return async (endpoint, paginate = false) => {
    const pages = [];
    let next = endpoint;
    for (let page = 0; ; page++) {
      if (page >= 100) throw new Error('GitHub pagination exceeded safe limit');
      const result = await request(next);
      if (!paginate) return result.data;
      pages.push(result.data);
      if (!result.next) return pages;
      const url = new URL(result.next);
      if (url.origin !== 'https://api.github.com') throw new Error('Unexpected pagination origin');
      next = url.pathname.slice(1) + url.search;
    }
  };
}
