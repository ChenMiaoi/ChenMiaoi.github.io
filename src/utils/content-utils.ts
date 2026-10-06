import { type CollectionEntry, getCollection } from "astro:content";
import { selectPosts } from "../lib/content/posts";
import { localizeMetadata, metadataSearchText } from "../lib/content/localization";
import { createSeriesTree, type SeriesInfo, type SeriesTree } from "../lib/content/series";
export { flattenSeriesPosts } from "../lib/content/series";
export type PostEntry = CollectionEntry<"posts"> & { slug: string; searchText: string };

export async function getRawSortedPosts(lang?: string): Promise<PostEntry[]> {
    return selectPosts(await getCollection("posts"), lang, !import.meta.env.PROD)
        .map((post) => ({ ...post, data: localizeMetadata(post.data, lang), searchText: metadataSearchText(post.data) }));
}

export async function getSeriesMap(
	lang?: string,
): Promise<Map<string, SeriesInfo>> {
	const allBlogPosts = await getRawSortedPosts(lang);
	const seriesEntries = await getCollection("series");
	const meta = new Map(seriesEntries.map((entry) => [entry.id, {
		...localizeMetadata(entry.data, lang), searchText: metadataSearchText(entry.data),
	}]));

	const map = new Map<string, SeriesInfo>();
	for (const post of allBlogPosts) {
		const slug = post.data.series;
		if (!slug) continue;
		if (!map.has(slug)) {
			const m = meta.get(slug);
			map.set(slug, {
				slug,
				title: m?.title ?? slug,
				description: m?.description ?? "",
				searchText: m?.searchText ?? slug,
				image: m?.image ?? "",
				posts: [],
			});
		}
		map.get(slug)?.posts.push({
			slug: post.slug,
			title: post.data.title,
			published: post.data.published,
			order: post.data.seriesOrder,
		});
	}
	for (const [slug, data] of meta) {
		if (!map.has(slug)) {
			map.set(slug, {
				slug,
				title: data.title,
				description: data.description,
				searchText: data.searchText,
				image: data.image,
				posts: [],
			});
		}
	}

	const orderOf = new Map(
		allBlogPosts.map((p) => [p.slug, p.data.seriesOrder] as const),
	);
	for (const info of map.values()) {
		info.posts.sort((a, b) => {
			const oa = orderOf.get(a.slug);
			const ob = orderOf.get(b.slug);
			if (oa !== undefined && ob !== undefined && oa !== ob) return oa - ob;
			if (oa !== undefined && ob === undefined) return -1;
			if (oa === undefined && ob !== undefined) return 1;
			return new Date(a.published).getTime() - new Date(b.published).getTime();
		});
	}
	return map;
}

export async function getSeriesTree(lang?: string): Promise<SeriesTree> {
	const map = await getSeriesMap(lang);
	const seriesEntries = await getCollection("series");
	const meta = new Map(seriesEntries.map((entry) => [entry.id, entry.data]));

	return createSeriesTree(map, meta);
}
