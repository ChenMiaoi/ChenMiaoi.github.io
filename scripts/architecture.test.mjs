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
import { resolveOrbitalLocation, sectionPaths } from "../src/lib/content/navigation.ts";

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
    assert.equal(resolveOrbitalLocation("/archive/", []).section, "articles");
    assert.equal(resolveOrbitalLocation("/en/series/test/", [], "/en").series, "test");
    assert.equal(sectionPaths.articles, "/");
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
