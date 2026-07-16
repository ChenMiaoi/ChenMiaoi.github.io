import { type CollectionEntry, getCollection } from "astro:content";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getCategoryUrl } from "@utils/url-utils.ts";

// // Retrieve posts and sort them by publication date
async function getRawSortedPosts() {
	const allBlogPosts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const sorted = allBlogPosts.sort((a, b) => {
		const dateA = new Date(a.data.published);
		const dateB = new Date(b.data.published);
		return dateA > dateB ? -1 : 1;
	});
	return sorted;
}

export async function getSortedPosts() {
	const sorted = await getRawSortedPosts();

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
export async function getSortedPostsList(): Promise<PostForList[]> {
	const sortedFullPosts = await getRawSortedPosts();

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

export async function getTagList(): Promise<Tag[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const countMap: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { tags: string[] } }) => {
		post.data.tags.forEach((tag: string) => {
			if (!countMap[tag]) countMap[tag] = 0;
			countMap[tag]++;
		});
	});

	// sort tags
	const keys: string[] = Object.keys(countMap).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

export type SeriesPost = {
	slug: string;
	title: string;
	published: Date;
};

export type SeriesInfo = {
	slug: string;
	title: string;
	description: string;
	image: string;
	posts: SeriesPost[]; // in reading order
};

// Group posts by their `series` frontmatter field. Reading order defaults to
// publication-date ascending; a post's `seriesOrder` (if set) takes precedence.
export async function getSeriesMap(): Promise<Map<string, SeriesInfo>> {
	const allBlogPosts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});
	const seriesEntries = await getCollection("series");
	const meta = new Map(seriesEntries.map((entry) => [entry.slug, entry.data]));

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
		});
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

export async function getCategoryList(): Promise<Category[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});
	const count: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { category: string | null } }) => {
		if (!post.data.category) {
			const ucKey = i18n(I18nKey.uncategorized);
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
			url: getCategoryUrl(c),
		});
	}
	return ret;
}
