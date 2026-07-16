import { type CollectionEntry, getCollection } from "astro:content";
import { CONTENT_LOCALE, DEFAULT_LOCALE, type Locale } from "@constants/locales";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getCategoryUrl, stripEnSuffix } from "@utils/url-utils.ts";

// Which content variant ("zh" from *.md, "en" from *.en.md) a locale tree shows.
function contentLocaleOf(lang?: string): "zh" | "en" {
	return CONTENT_LOCALE[(lang as Locale) || DEFAULT_LOCALE] ?? "zh";
}

// Retrieve posts of one locale tree and sort them by publication date.
// English variants (slugs ending in ".en") are normalized back to the base
// slug so both languages share the same dated permalink shape.
export async function getRawSortedPosts(lang?: string) {
	const contentLocale = contentLocaleOf(lang);
	const allBlogPosts = await getCollection("posts", ({ data, slug }) => {
		const isEn = slug.endsWith(".en");
		if (contentLocale === "en" ? !isEn : isEn) return false;
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const sorted = (
		contentLocale === "en"
			? allBlogPosts.map((entry) => ({
					...entry,
					slug: stripEnSuffix(entry.slug),
				}))
			: allBlogPosts
	).sort((a, b) => {
		const dateA = new Date(a.data.published);
		const dateB = new Date(b.data.published);
		return dateA > dateB ? -1 : 1;
	});
	return sorted;
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
export async function getSortedPostsList(lang?: string): Promise<PostForList[]> {
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
export async function getSeriesMap(lang?: string): Promise<Map<string, SeriesInfo>> {
	const allBlogPosts = await getRawSortedPosts(lang);
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
