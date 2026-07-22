import { type CollectionEntry, getCollection } from "astro:content";
import { CONTENT_LOCALE, DEFAULT_LOCALE, type Locale } from "@constants/locales";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getCategoryUrl, getPostUrlBySlug, stripEnSuffix, url } from "@utils/url-utils.ts";

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

	const sorted = (contentLocale === "en"
		? allBlogPosts.map((entry) => ({
				...entry,
				slug: stripEnSuffix(entry.slug),
			}))
		: allBlogPosts
	).sort((a, b) => {
		const timeA = new Date(a.data.published).getTime();
		const timeB = new Date(b.data.published).getTime();
		return timeB - timeA;
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
	order?: number; // seriesOrder from the post frontmatter
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

// 专栏 → 子专栏 → 孙专栏; deeper nesting fails the build.
export const SERIES_MAX_DEPTH = 3;

export type SeriesNode = SeriesInfo & {
	parent?: string;
	order?: number;
	children: SeriesNode[];
};

export type SeriesTree = {
	nodes: Map<string, SeriesNode>; // every series by slug
	roots: SeriesNode[]; // top-level series
};

// A series page presents its child-series directories as one block first,
// followed by the direct articles in publication/series order. `order` sorts
// directories among themselves; `seriesOrder` sorts articles among themselves.
export type SeriesItem =
	| { kind: "series"; node: SeriesNode }
	| { kind: "post"; post: SeriesPost };

export function seriesItems(node: SeriesNode): SeriesItem[] {
	const children = [...node.children].sort((a, b) => {
		const oa = a.order;
		const ob = b.order;
		if (oa !== undefined && ob !== undefined && oa !== ob) return oa - ob;
		if (oa !== undefined && ob === undefined) return -1;
		if (oa === undefined && ob !== undefined) return 1;
		return a.title.localeCompare(b.title);
	});
	const posts = [...node.posts].sort((a, b) => {
		const oa = a.order;
		const ob = b.order;
		if (oa !== undefined && ob !== undefined && oa !== ob) return oa - ob;
		if (oa !== undefined && ob === undefined) return -1;
		if (oa === undefined && ob !== undefined) return 1;
		return new Date(a.published).getTime() - new Date(b.published).getTime();
	});
	return [
		...children.map((node) => ({ kind: "series", node }) as const),
		...posts.map((post) => ({ kind: "post", post }) as const),
	];
}

// Every post in the subtree, in global reading order (DFS over seriesItems).
export function flattenSeriesPosts(node: SeriesNode): SeriesPost[] {
	const out: SeriesPost[] = [];
	for (const item of seriesItems(node)) {
		if (item.kind === "post") out.push(item.post);
		else out.push(...flattenSeriesPosts(item.node));
	}
	return out;
}

// Chain from the root down to (and excluding) the series itself.
export function getSeriesAncestors(
	tree: SeriesTree,
	slug: string,
): SeriesNode[] {
	const chain: SeriesNode[] = [];
	let cur = tree.nodes.get(slug);
	while (cur?.parent) {
		const parent = tree.nodes.get(cur.parent);
		if (!parent) break;
		chain.unshift(parent);
		cur = parent;
	}
	return chain;
}

export function getSeriesRoot(tree: SeriesTree, slug: string): SeriesNode {
	const ancestors = getSeriesAncestors(tree, slug);
	return ancestors[0] ?? tree.nodes.get(slug)!;
}

export async function getSeriesTree(lang?: string): Promise<SeriesTree> {
	const map = await getSeriesMap(lang);
	const seriesEntries = await getCollection("series");
	const meta = new Map(seriesEntries.map((entry) => [entry.slug, entry.data]));

	const nodes = new Map<string, SeriesNode>();
	for (const [slug, info] of map) {
		const m = meta.get(slug);
		nodes.set(slug, {
			...info,
			parent: m?.parent || undefined,
			order: m?.order,
			children: [],
		});
	}

	const tree: SeriesTree = { nodes, roots: [] };
	for (const node of nodes.values()) {
		if (!node.parent) {
			tree.roots.push(node);
			continue;
		}
		const parent = nodes.get(node.parent);
		if (!parent) {
			throw new Error(
				`Series "${node.slug}" declares unknown parent "${node.parent}".`,
			);
		}
		parent.children.push(node);
	}

	// Validate acyclicity and depth against SERIES_MAX_DEPTH.
	for (const node of nodes.values()) {
		const seen = new Set<string>([node.slug]);
		let depth = 1;
		let cur = node;
		while (cur.parent) {
			if (seen.has(cur.parent)) {
				throw new Error(
					`Series nesting cycle detected at "${cur.parent}" (from "${node.slug}").`,
				);
			}
			seen.add(cur.parent);
			depth += 1;
			if (depth > SERIES_MAX_DEPTH) {
				throw new Error(
					`Series "${node.slug}" is nested deeper than SERIES_MAX_DEPTH (${SERIES_MAX_DEPTH}).`,
				);
			}
			cur = nodes.get(cur.parent)!;
		}
	}
	return tree;
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
