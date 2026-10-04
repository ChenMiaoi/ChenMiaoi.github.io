import { selectPosts } from "../lib/content/posts";
import {
	createSeriesTree,
	flattenSeriesPosts,
	getSeriesAncestors,
	getSeriesRoot,
	type SeriesInfo,
	type SeriesPost,
	type SeriesTree,
	seriesItems,
} from "../lib/content/series";

export {
	flattenSeriesPosts,
	getSeriesAncestors,
	getSeriesRoot,
	SERIES_MAX_DEPTH,
	type SeriesInfo,
	type SeriesItem,
	type SeriesNode,
	type SeriesPost,
	type SeriesTree,
	seriesItems,
} from "../lib/content/series";

import { type CollectionEntry, getCollection } from "astro:content";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getCategoryUrl, getPostUrlBySlug, url } from "@utils/url-utils.ts";

export type PostEntry = CollectionEntry<"posts"> & { slug: string };

// Retrieve posts of one locale tree and sort them by publication date.
// English variants (slugs ending in ".en") are normalized back to the base
// slug so both languages share the same dated permalink shape.
export async function getRawSortedPosts(lang?: string): Promise<PostEntry[]> {
	return selectPosts(await getCollection("posts"), lang, !import.meta.env.PROD);
}

export async function getSortedPosts(lang?: string) {
	const sorted = await getRawSortedPosts(lang);

	for (let i = 1; i < sorted.length; i++) {
		sorted[i].data.nextSlug = sorted[i - 1].slug;
		sorted[i].data.nextTitle = sorted[i - 1].data.title;
		sorted[i].data.nextPublished = sorted[i - 1].data.published;
	}
	for (let i = 0; i < sorted.length - 1; i++) {
		sorted[i].data.prevSlug = sorted[i + 1].slug;
		sorted[i].data.prevTitle = sorted[i + 1].data.title;
		sorted[i].data.prevPublished = sorted[i + 1].data.published;
	}

	return sorted;
}
export type PostForList = {
	slug: string;
	data: CollectionEntry<"posts">["data"];
};
export async function getSortedPostsList(
	lang?: string,
): Promise<PostForList[]> {
	const sortedFullPosts = await getRawSortedPosts(lang);

	// delete post.body
	const sortedPostsList = sortedFullPosts.map((post) => ({
		slug: post.slug,
		data: post.data,
	}));

	return sortedPostsList;
}
export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(lang?: string): Promise<Tag[]> {
	const allBlogPosts = await getRawSortedPosts(lang);

	const countMap: { [key: string]: number } = {};
	allBlogPosts.forEach((post) => {
		post.data.tags.forEach((tag: string) => {
			if (!countMap[tag]) countMap[tag] = 0;
			countMap[tag]++;
		});
	});

	// sort tags
	const keys = Object.keys(countMap).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

export async function getSeriesMap(
	lang?: string,
): Promise<Map<string, SeriesInfo>> {
	const allBlogPosts = await getRawSortedPosts(lang);
	const seriesEntries = await getCollection("series");
	const meta = new Map(seriesEntries.map((entry) => [entry.id, entry.data]));

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

/* ---------- nested series (sub-series) ---------- */

export async function getSeriesTree(lang?: string): Promise<SeriesTree> {
	const map = await getSeriesMap(lang);
	const seriesEntries = await getCollection("series");
	const meta = new Map(seriesEntries.map((entry) => [entry.id, entry.data]));

	return createSeriesTree(map, meta);
}

export type SeriesNavData = {
	// Root series: the "Part X of N" counter and prev/next span the whole tree.
	seriesSlug: string;
	seriesTitle: string;
	index: number;
	total: number;
	prev: { title: string; url: string } | null;
	next: { title: string; url: string } | null;
	// Leaf series the post directly belongs to: drives the sidebar.
	leafSlug: string;
	leafTitle: string;
	ancestors: { slug: string; title: string }[]; // root … parent
	items: (
		| { kind: "post"; title: string; url: string; current: boolean }
		| { kind: "series"; title: string; url: string; slug: string }
	)[];
};

// Build the per-post series navigation/sidebar model. Shared by every locale's
// post page so the tree logic lives in exactly one place.
export function buildSeriesNav(
	post: { slug: string; data: { series?: string } },
	tree: SeriesTree,
	lang?: string,
): SeriesNavData | null {
	const seriesSlug = post.data.series;
	const leaf = seriesSlug ? tree.nodes.get(seriesSlug) : undefined;
	if (!leaf) return null;

	const root = getSeriesRoot(tree, leaf.slug);
	const flat = flattenSeriesPosts(root);
	const index = flat.findIndex((p) => p.slug === post.slug);
	if (index < 0) return null;

	const toLink = (p: SeriesPost) => ({
		title: p.title,
		url: getPostUrlBySlug(p.slug, p.published, lang),
	});
	return {
		seriesSlug: root.slug,
		seriesTitle: root.title,
		index: index + 1,
		total: flat.length,
		prev: index > 0 ? toLink(flat[index - 1]) : null,
		next: index < flat.length - 1 ? toLink(flat[index + 1]) : null,
		leafSlug: leaf.slug,
		leafTitle: leaf.title,
		ancestors: getSeriesAncestors(tree, leaf.slug).map((n) => ({
			slug: n.slug,
			title: n.title,
		})),
		items: seriesItems(leaf).map((item) =>
			item.kind === "post"
				? {
						kind: "post" as const,
						...toLink(item.post),
						current: item.post.slug === post.slug,
					}
				: {
						kind: "series" as const,
						title: item.node.title,
						url: url(`/series/${item.node.slug}/`, lang),
						slug: item.node.slug,
					},
		),
	};
}

export async function getCategoryList(lang?: string): Promise<Category[]> {
	const allBlogPosts = await getRawSortedPosts(lang);
	const count: { [key: string]: number } = {};
	allBlogPosts.forEach((post) => {
		if (!post.data.category) {
			const ucKey = i18n(I18nKey.uncategorized, lang);
			count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1;
			return;
		}

		const categoryName =
			typeof post.data.category === "string"
				? post.data.category.trim()
				: String(post.data.category).trim();

		count[categoryName] = count[categoryName] ? count[categoryName] + 1 : 1;
	});

	const lst = Object.keys(count).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	const ret: Category[] = [];
	for (const c of lst) {
		ret.push({
			name: c,
			count: count[c],
			url: getCategoryUrl(c, lang),
		});
	}
	return ret;
}
