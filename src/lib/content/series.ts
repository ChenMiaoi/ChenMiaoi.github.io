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
	const root = ancestors[0] ?? tree.nodes.get(slug);
	if (!root) throw new Error(`Unknown series: ${slug}`);
	return root;
}

export function createSeriesTree(
	map: Map<string, SeriesInfo>,
	meta: Map<string, { parent?: string; order?: number }>,
): SeriesTree {
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
			const parent = nodes.get(cur.parent);
			if (!parent) throw new Error(`Unknown parent: ${cur.parent}`);
			cur = parent;
		}
	}
	return tree;
}
