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
	return entries
		.filter(
			(entry) =>
				(contentLocale === "en"
					? entry.id.endsWith(".en")
					: !entry.id.endsWith(".en")) &&
				(includeDrafts || !entry.data.draft),
		)
		.map((entry) => ({
			...entry,
			data: { ...entry.data },
			slug: contentLocale === "en" ? entry.id.slice(0, -3) : entry.id,
		}))
		.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
}
