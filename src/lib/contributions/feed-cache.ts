import type {
	ContributionActivitySnapshot,
	ContributionDetailsSnapshot,
} from "./types";

export type ContributionResponse = ContributionDetailsSnapshot & {
	version?: 1;
	activity?: ContributionActivitySnapshot;
};

function validFeed(value: unknown): value is ContributionResponse {
	if (!value || typeof value !== "object") return false;
	const feed = value as ContributionResponse;
	return (
		Array.isArray(feed.records) &&
		typeof feed.syncedAt === "string" &&
		Number.isFinite(Date.parse(feed.syncedAt)) &&
		(feed.version === undefined ||
			(feed.version === 1 && Array.isArray(feed.activity?.items)))
	);
}

type StorageAccess = Pick<Storage, "getItem" | "setItem">;

export function createContributionFeedCache(
	read: (url: string) => Promise<unknown>,
	storage?: StorageAccess,
	now = Date.now,
) {
	const snapshots = new Map<
		string,
		{ feed: ContributionResponse; readAt: number }
	>();
	const pending = new Map<string, Promise<ContributionResponse>>();
	const key = (url: string) => `orbital-contributions-v1:${url}`;
	function peek(url: string) {
		if (!snapshots.has(url)) {
			try {
				const saved = JSON.parse(storage?.getItem(key(url)) ?? "null");
				if (validFeed(saved?.feed) && typeof saved.readAt === "number")
					snapshots.set(url, saved);
			} catch {
				/* Storage may be unavailable or contain an obsolete snapshot. */
			}
		}
		return snapshots.get(url)?.feed;
	}
	function load(
		url: string,
		minimumSyncedAt = "",
	): Promise<ContributionResponse> {
		const cached = peek(url);
		const snapshot = snapshots.get(url);
		if (
			cached &&
			snapshot &&
			now() - snapshot.readAt < 5000 &&
			(!minimumSyncedAt ||
				Date.parse(cached.syncedAt) >= Date.parse(minimumSyncedAt))
		)
			return Promise.resolve(cached);
		const existing = pending.get(url);
		if (existing) return existing;
		const request = Promise.resolve()
			.then(() => read(url))
			.then((value) => {
				if (!validFeed(value)) throw new Error("Invalid contribution data");
				const snapshot = { feed: value, readAt: now() };
				snapshots.set(url, snapshot);
				try {
					const serialized = JSON.stringify(snapshot);
					if (serialized.length <= 2_000_000)
						storage?.setItem(key(url), serialized);
				} catch {
					/* Keep the in-memory snapshot if storage is full or disabled. */
				}
				return value;
			})
			.finally(() => pending.delete(url));
		pending.set(url, request);
		return request;
	}
	return { peek, load };
}

let client: ReturnType<typeof createContributionFeedCache> | undefined;
function cache() {
	if (!client) {
		let storage: Storage | undefined;
		try {
			storage = window.sessionStorage;
		} catch {
			/* Private browsing may block storage. */
		}
		client = createContributionFeedCache(async (url) => {
			const response = await fetch(url, {
				cache: "no-cache",
				signal: AbortSignal.timeout(15000),
			});
			if (!response.ok) throw new Error("Contribution data unavailable");
			return response.json();
		}, storage);
	}
	return client;
}

export const cachedContributionFeed = (url: string) => cache().peek(url);
export const loadContributionFeed = (url: string, minimumSyncedAt = "") =>
	cache().load(url, minimumSyncedAt);
