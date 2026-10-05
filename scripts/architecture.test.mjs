import assert from "node:assert/strict";
import test from "node:test";
import { postPath } from "../src/lib/content/paths.ts";
import { selectPosts } from "../src/lib/content/posts.ts";
import { createSeriesTree, flattenSeriesPosts } from "../src/lib/content/series.ts";
import { createResourceCache } from "../src/lib/content/client-cache.ts";
import { contributionConfig, contributionSyncConfig } from "../src/lib/contributions/config.ts";
import { contributionActivity, contributionDetails } from "../src/lib/contributions/snapshots.ts";
import { detailsSchema } from "../src/lib/contributions/schema.ts";
import { resolveContributionProjects, projectRecords } from "../src/lib/contributions/projects.ts";
import { isWelcomeLocation, resolveOrbitalLocation, sectionPaths } from "../src/lib/content/navigation.ts";
import { createTranslations, languageUrl } from "../src/features/orbital/i18n/index.ts";
import { messages } from "../src/features/orbital/i18n/messages.ts";
import { contributionUrl, resolveContributionSelection } from "../src/lib/contributions/navigation.ts";

test("contribution links round-trip project, record and filter across every locale", () => {
    for (const prefix of ["", "/en", "/ja", "/zh_TW"]) {
        for (const record of ["pr:228734", "issue:202079", "commit:a44bfed9df8"]) {
            const location = new URL(contributionUrl("llvm-project", record, record.split(":")[0], prefix), "https://example.com");
            const route = resolveOrbitalLocation(location.pathname, [], prefix);
            assert.equal(route.section, "code");
            assert.equal(route.contributionProject, "llvm-project");
            assert.deepEqual(resolveContributionSelection(location.search), { record, kind: record.split(":")[0] });
            const japanese = languageUrl(location.pathname + location.search, "ja");
            assert.ok(japanese.startsWith("/ja/contribution/llvm-project/"));
            assert.equal(new URL(japanese, "https://example.com").search, location.search);
        }
    }
    assert.equal(contributionUrl("cargo", "", "pr"), "/contribution/cargo/?kind=pr");
    assert.deepEqual(resolveContributionSelection("?pr=1&kind=issue"), { record: "pr:1", kind: "all" });
});

test("invalid or ambiguous contribution selections cannot silently select a different record", () => {
    for (const search of ["?pr=0", "?pr=oops", "?commit=../evil", "?issue=1&pr=2", "?pr=1&pr=2", "?pr="]) {
        assert.equal(resolveContributionSelection(search).record, "invalid");
    }
    assert.deepEqual(resolveContributionSelection(""), { record: "", kind: "all" });
});

test("permalinks preserve UTC dates, leap days and nested slugs", () => {
	assert.equal(postPath("kernel/memory", new Date("2024-02-29")), "/2024/02/29/kernel/memory/");
	assert.equal(postPath("test", new Date("2026-07-22T00:10:00+08:00")), "/2026/07/21/test/");
	assert.throws(() => postPath("broken", new Date("invalid")), /Invalid date/);
});

const series = (slugs) => new Map(slugs.map((slug) => [slug, { slug, title: slug, description: "", image: "", posts: [] }]));
test("locale selection excludes drafts and normalizes English without mutating collection entries", () => {
	const entries = ["memory", "memory.en", "draft"].map((id) => ({ id, data: { published: new Date("2026-01-01"), draft: id === "draft", prevSlug: "" } }));
	for (const locale of ["zh_CN", "zh_TW", "ja"]) assert.deepEqual(selectPosts(entries, locale).map((p) => p.id), ["memory"]);
	assert.equal(selectPosts(entries, "en")[0].slug, "memory");
	assert.equal(selectPosts(entries, "zh_CN", true).length, 2);
	selectPosts(entries)[0].data.prevSlug = "changed";
	assert.equal(entries[0].data.prevSlug, "");
});
test("series validation rejects missing parents, cycles and excessive depth", () => {
	assert.throws(() => createSeriesTree(series(["a"]), new Map([["a", { parent: "missing" }]])), /unknown parent/);
	assert.throws(() => createSeriesTree(series(["a", "b"]), new Map([["a", { parent: "b" }], ["b", { parent: "a" }]])), /cycle/);
	assert.throws(() => createSeriesTree(series(["a", "b", "c", "d"]), new Map([["b", { parent: "a" }], ["c", { parent: "b" }], ["d", { parent: "c" }]])), /deeper/);
});
test("series reading order visits child directories before direct posts", () => {
	const entries = series(["root", "child"]);
	const post = (slug, order) => ({ slug, title: slug, order, published: new Date("2026-01-01") });
	entries.get("root").posts = [post("root-post", 0)];
	entries.get("child").posts = [post("second", 2), post("first", 1)];
	const tree = createSeriesTree(entries, new Map([["child", { parent: "root" }]]));
	assert.deepEqual(flattenSeriesPosts(tree.roots[0]).map((p) => p.slug), ["first", "second", "root-post"]);
});
test("content cache shares in-flight reads and allows retry after failure", async () => {
	let calls = 0;
	const load = createResourceCache(async (url) => { calls++; if (calls === 1) throw new Error("offline"); return url; });
	const first = load("article");
	assert.equal(load("article"), first);
	await assert.rejects(first, /offline/);
	assert.equal(await load("article"), "article");
	assert.equal(await load("article"), "article");
	assert.equal(calls, 2);
});
test("Orbital restores public sections, series and dated articles from the URL", () => {
    const posts = [{ slug: "memory", url: "/2026/09/20/memory/" }];
    assert.equal(resolveOrbitalLocation("/contribution/", posts).section, "code");
    assert.equal(resolveOrbitalLocation("/series/linux-memory/", posts).series, "linux-memory");
    assert.equal(resolveOrbitalLocation("/series/", posts).section, "series");
    assert.equal(resolveOrbitalLocation(posts[0].url, posts).post, posts[0]);
    assert.equal(resolveOrbitalLocation("/en/about/", [], "/en").section, "about");
    assert.equal(resolveOrbitalLocation("/articles/", []).section, "articles");
    assert.equal(resolveOrbitalLocation("/en/series/test/", [], "/en").series, "test");
    assert.equal(sectionPaths.articles, "/articles/");
});

test("welcome entrances preserve deep links and legacy search URLs", () => {
    for (const prefix of ["", "/en", "/ja", "/zh_TW"]) {
        assert.equal(isWelcomeLocation(`${prefix}/`, "", prefix), true);
        assert.equal(isWelcomeLocation(`${prefix}/`, "?utm_source=link", prefix), true);
        for (const search of ["?q=linux", "?tag=Rust", "?category=hardware", "?q="]) {
            assert.equal(isWelcomeLocation(`${prefix}/`, search, prefix), false);
        }
        for (const path of ["/articles/", "/contribution/", "/series/", "/graph/", "/about/", "/2026/09/20/memory/"]) {
            assert.equal(isWelcomeLocation(prefix + path, "", prefix), false);
        }
    }
    assert.equal(isWelcomeLocation("/en", "", "/en"), true);
    assert.equal(isWelcomeLocation("/enough/", "", "/en"), false);
});

test("both contribution views resolve every configured record from validated snapshots", () => {
	const projects = resolveContributionProjects(contributionConfig.projects, contributionDetails);
	for (const project of projects) {
		for (const record of projectRecords(project, contributionActivity)) {
			assert.ok(contributionDetails.records.some((detail) => detail.url === record.url), record.url);
		}
		for (const commit of project.items) assert.ok(commit.patch?.includes("@@"), commit.sha);
	}
	assert.deepEqual(contributionActivity.repositories, contributionSyncConfig.repositories);
	assert.throws(() => detailsSchema.parse({ ...contributionDetails, records: [{ ...contributionDetails.records[0], stats: { files: -1, additions: 0, deletions: 0 } }] }));
});

test("language switching preserves deep links, filters and headings without duplicating locale prefixes", () => {
	assert.equal(
		languageUrl("/en/articles/?q=Linux&category=hardware", "ja"),
		"/ja/articles/?q=Linux&category=hardware",
	);
	assert.equal(
		languageUrl("/ja/series/linux-memory/", "zh_CN"),
		"/series/linux-memory/",
	);
	assert.equal(
		languageUrl("/2026/09/20/memory/#page-table", "en"),
		"/en/2026/09/20/memory/#page-table",
	);
	assert.equal(languageUrl("/zh_TW/", "en"), "/en/");
	assert.equal(languageUrl("/en", "zh_CN"), "/");
});

test("all interface translations preserve interpolation parameters and substitute values literally", () => {
	const parameters = (text) =>
		[...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
	for (const [source, translations] of Object.entries(messages)) {
		assert.equal(translations.length, 3);
		for (const text of translations) {
			assert.ok(text.trim(), source);
			assert.deepEqual(parameters(text), parameters(source), source);
		}
	}
	assert.equal(
		createTranslations("en").t("搜索「{v0}」", { v0: "$& <Linux>" }),
		"Search: “$& <Linux>”",
	);
	assert.equal(
		createTranslations("ja").t("{v0} 篇文章", { v0: 0 }),
		"0 件の記事",
	);
	assert.equal(createTranslations("zh_CN").t("欢迎登站"), "欢迎登站");
	assert.equal(createTranslations("zh_TW").t("文章档案"), "文章檔案");
	assert.equal(createTranslations("en").t("{v0} 篇文章", { v0: 1 }), "1 article");
	assert.equal(createTranslations("en").t("{v0} 篇文章", { v0: 2 }), "2 articles");
});

test("English prefers published translations and falls back per article without dropping untranslated posts", () => {
	const post = (id, draft = false) => ({
		id,
		data: { published: new Date("2026-01-01"), draft },
	});
	const entries = [
		post("translated"),
		post("translated.en"),
		post("original"),
		post("original.en", true),
		post("draft", true),
	];
	assert.deepEqual(
		selectPosts(entries, "en").map((entry) => entry.id),
		["translated.en", "original"],
	);
	assert.deepEqual(
		selectPosts(entries, "en").map((entry) => entry.slug),
		["translated", "original"],
	);
	assert.deepEqual(
		selectPosts(entries, "zh_CN").map((entry) => entry.id),
		["translated", "original"],
	);
});
