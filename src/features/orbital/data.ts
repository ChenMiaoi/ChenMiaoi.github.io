import { render } from "astro:content";
import { getRawSortedPosts, getSeriesTree, flattenSeriesPosts } from "../../utils/content-utils";
import { getPostUrlBySlug } from "../../utils/url-utils";
import { createTranslations } from "./i18n";
import type { Locale } from "../../constants/locales";

const cache = new Map<string, ReturnType<typeof buildOrbitalData>>();
export function getOrbitalData(lang: Locale = "zh_CN") {
	if (!import.meta.env.PROD) return buildOrbitalData(lang);
	const existing = cache.get(lang);
	if (existing) return existing;
	const pending = buildOrbitalData(lang);
	cache.set(lang, pending);
	return pending;
}

async function buildOrbitalData(lang: Locale) {
	const { t } = createTranslations(lang);
	const entries = await getRawSortedPosts(lang);
	const tree = await getSeriesTree(lang);
	const plainText = (text: string) => text.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, "")
		.replace(/[`*_#]/g, "").replace(/\s+/g, " ").trim();
	const posts = await Promise.all(entries.map(async (post) => {
		const { headings } = await render(post);
		const introduction = (post.body ?? "").split(/\r?\n\s*\r?\n/)
			.find((part) => part.trim() && !/^(#|```|:::|!\[|<|\|)/.test(part.trim())) ?? "";
		const excerpt = plainText(introduction);
		const url = getPostUrlBySlug(post.slug, post.data.published, lang);
		return {
			contentLang: post.id.endsWith(".en") ? "en" as const : "zh-CN" as const,
			slug: post.slug, title: post.data.title,
			date: post.data.published.toISOString().slice(0, 10).replaceAll("-", "."),
			timestamp: post.data.published.getTime(),
			description: post.data.description || excerpt.match(/^.*?[。！？]/)?.[0] || excerpt,
			excerpt: excerpt || post.data.description,
			category: post.data.category || "", series: post.data.series || "",
			seriesTitle: tree.nodes.get(post.data.series || "")?.title || t("独立文章"),
			seriesOrder: post.data.seriesOrder, tags: post.data.tags,
			url, contentUrl: url,
			headings: headings.map((heading) => ({ ...heading, text: heading.text.replace(/#+$/, "").trim() })),
		};
	}));
	const series = [...tree.nodes.values()].map((entry) => ({
		slug: entry.slug, title: entry.title, description: entry.description,
		parent: entry.parent || "", order: entry.order,
		posts: flattenSeriesPosts(entry).map((post) => post.slug),
	}));
	return { entries, posts, series };
}
