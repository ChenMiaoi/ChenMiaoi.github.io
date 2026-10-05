import {
	CONTENT_LOCALE,
	DEFAULT_LOCALE,
	type Locale,
} from "../../constants/locales.ts";

type Post = { id: string; data: { published: Date; draft?: boolean } };

// Pure selection shared by every content consumer through getRawSortedPosts.
// Clone navigation metadata so adding prev/next links cannot mutate the collection.
export function selectPosts<T extends Post>(
	entries: T[],
	locale?: string,
	includeDrafts = false,
) {
	const contentLocale =
		CONTENT_LOCALE[(locale as Locale) || DEFAULT_LOCALE] ?? "zh";
	const publicEntries = entries.filter(
		(entry) => includeDrafts || !entry.data.draft,
	);
	const translatedSlugs = new Set(
		publicEntries
			.filter((entry) => entry.id.endsWith(".en"))
			.map((entry) => entry.id.slice(0, -3)),
	);
	return publicEntries
		.filter((entry) =>
			contentLocale === "en"
				? entry.id.endsWith(".en") || !translatedSlugs.has(entry.id)
				: !entry.id.endsWith(".en"),
		)
		.map((entry) => ({
			...entry,
			data: { ...entry.data },
			slug:
				contentLocale === "en" && entry.id.endsWith(".en")
					? entry.id.slice(0, -3)
					: entry.id,
		}))
		.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
}
