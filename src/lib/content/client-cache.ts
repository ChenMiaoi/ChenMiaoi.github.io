// Concurrent readers share a request. Failed requests are evicted so Retry works.
export function createResourceCache<T>(read: (url: string) => Promise<T>) {
	const requests = new Map<string, Promise<T>>();
	return (url: string): Promise<T> => {
		let request = requests.get(url);
		if (!request) {
			request = read(url).catch((error: unknown) => {
				requests.delete(url);
				throw error;
			});
			requests.set(url, request);
		}
		return request;
	};
}

async function response(url: string) {
	const result = await fetch(url, { signal: AbortSignal.timeout(15000) });
	if (!result.ok) throw new Error(`Unable to load ${url}: ${result.status}`);
	return result;
}
const json = createResourceCache<unknown>(async (url) =>
	(await response(url)).json(),
);
export function loadJson<T>(url: string): Promise<T> {
	return json(url) as Promise<T>;
}
