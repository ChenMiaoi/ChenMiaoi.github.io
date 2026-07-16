import { getCollection } from "astro:content";
import { getPostUrlBySlug, getTagUrl, url } from "@utils/url-utils";

export type GraphNode = {
	id: string;
	label: string;
	type: "post" | "tag" | "series";
	url: string;
};
export type GraphLink = { source: string; target: string };
export type GraphData = { nodes: GraphNode[]; links: GraphLink[] };

// Build the knowledge graph from content collections.
// Nodes: posts, tags, series. Links: post->tag, post->series, post->post
// (the latter from in-content markdown links using the dated permalink form).
export async function buildGraphData(): Promise<GraphData> {
	const posts = await getCollection("posts", ({ data }) =>
		import.meta.env.PROD ? data.draft !== true : true,
	);
	const seriesEntries = await getCollection("series");
	const seriesTitle = new Map(
		seriesEntries.map((entry) => [entry.slug, entry.data.title]),
	);

	const nodes: GraphNode[] = [];
	const links: GraphLink[] = [];
	const linkKeys = new Set<string>();
	const seenTags = new Set<string>();
	const seenSeries = new Set<string>();
	const slugSet = new Set(posts.map((p) => p.slug));

	const addLink = (source: string, target: string) => {
		const key = `${source}->${target}`;
		if (linkKeys.has(key)) return;
		linkKeys.add(key);
		links.push({ source, target });
	};

	for (const post of posts) {
		const id = `post:${post.slug}`;
		nodes.push({
			id,
			label: post.data.title,
			type: "post",
			url: getPostUrlBySlug(post.slug, post.data.published),
		});

		for (const tag of post.data.tags) {
			if (!seenTags.has(tag)) {
				seenTags.add(tag);
				nodes.push({
					id: `tag:${tag}`,
					label: `#${tag}`,
					type: "tag",
					url: getTagUrl(tag),
				});
			}
			addLink(id, `tag:${tag}`);
		}

		if (post.data.series) {
			const s = post.data.series;
			if (!seenSeries.has(s)) {
				seenSeries.add(s);
				nodes.push({
					id: `series:${s}`,
					label: `📚 ${seriesTitle.get(s) ?? s}`,
					type: "series",
					url: url(`/series/${s}/`),
				});
			}
			addLink(id, `series:${s}`);
		}

		// cross-links between posts, e.g. [text](/2024/05/15/xv6-The-boot-loader/)
		const body = post.body ?? "";
		const linkRe = /\]\((?:https?:\/\/[^)\s]*?)?\/\d{4}\/\d{2}\/\d{2}\/([^)\s/]+)\/?\)/g;
		for (const match of body.matchAll(linkRe)) {
			const targetSlug = match[1];
			if (slugSet.has(targetSlug)) addLink(id, `post:${targetSlug}`);
		}
	}

	return { nodes, links };
}
