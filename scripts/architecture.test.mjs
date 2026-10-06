import assert from "node:assert/strict";
import test from "node:test";
import { postPath } from "../src/lib/content/paths.ts";
import { selectPosts } from "../src/lib/content/posts.ts";
import { createSeriesTree, flattenSeriesPosts } from "../src/lib/content/series.ts";
import { sortSeriesByRecency } from "../src/lib/content/series-recency.ts";
import { createResourceCache } from "../src/lib/content/client-cache.ts";
import { contributionConfig, contributionSyncConfig } from "../src/lib/contributions/config.ts";
import { contributionActivity, contributionDetails } from "../src/lib/contributions/snapshots.ts";
import { detailsSchema } from "../src/lib/contributions/schema.ts";
import { resolveContributionProjects, projectRecords, sortContributionProjects } from "../src/lib/contributions/projects.ts";
import { isWelcomeLocation, resolveOrbitalLocation, sectionPaths, welcomePath } from "../src/lib/content/navigation.ts";
import { createDeferredNavigation, WELCOME_RETURN_DURATION } from "../src/lib/content/navigation-transition.ts";
import { createTranslations, languageUrl } from "../src/features/orbital/i18n/index.ts";
import { messages } from "../src/features/orbital/i18n/messages.ts";
import { contributionUrl, resolveContributionSelection } from "../src/lib/contributions/navigation.ts";
import { contributionOverview } from "../src/lib/contributions/overview.ts";

test("mission statistics deduplicate records and distinguish unknown, closed and merged outcomes", () => {
    const projects = [{ id:'one',name:'One',repository:'https://github.com/example/one',items:[{sha:'abc1234',title:'Commit',date:'2026-10-01'}] },{id:'two',name:'Two',repository:'https://github.com/example/two',items:[]}];
    const item = (number,kind,state,repository='example/one') => ({number,kind,state,repository,url:`https://github.com/${repository}/${kind === 'pr' ? 'pull' : 'issues'}/${number}`,title:'Work',updatedAt:'2026-10-06T00:00:00Z',draft:false,relations:['commenter']});
    const merged = item(3,'pr','merged');
    const activity = {account:'me',syncedAt:'2026-10-06T00:00:00Z',items:[item(1,'issue','open'),item(2,'issue',undefined),merged,merged,item(4,'pr','closed'),item(5,'pr','draft'),item(6,'issue','open','example/two')]};
    const original = structuredClone(activity);
    const overview = contributionOverview(projects,activity,{records:[{url:activity.items[0].url,state:'closed'}]});
    assert.deepEqual(overview.sectors.map(({issues,prs,closedIssues,mergedPRs,closedPRs,commits,active,unknown}) => ({issues,prs,closedIssues,mergedPRs,closedPRs,commits,active,unknown})),[
        {issues:2,prs:3,closedIssues:1,mergedPRs:1,closedPRs:1,commits:1,active:1,unknown:1},
        {issues:1,prs:0,closedIssues:0,mergedPRs:0,closedPRs:0,commits:0,active:1,unknown:0},
    ]);
    assert.equal(overview.records.length,7);
    assert.equal(overview.records.find(record => record.number === 2).state,'unknown');
    assert.deepEqual(activity,original);
});

test("contribution links round-trip project, record and filter across every locale", () => {
    assert.equal(contributionUrl(''),'/contribution/');
    assert.equal(contributionUrl('', '', 'all', '/en'),'/en/contribution/');
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
test("series discovery follows recent articles and descendant updates instead of volume or manual order", () => {
    const timestamp = (date) => Date.parse(date);
    const posts = [
        ...['old-one', 'old-two', 'old-three'].map(slug => ({ slug, timestamp: timestamp('2026-01-01') })),
        { slug: 'new', timestamp: timestamp('2026-09-20') },
        { slug: 'descendant', timestamp: timestamp('2026-07-01'), updatedTimestamp: timestamp('2026-10-01') },
    ];
    const directory = [
        { slug: 'popular', order: 1, posts: ['old-one', 'old-two', 'old-three'] },
        { slug: 'recent', order: 2, posts: ['new'] },
        { slug: 'parent', order: 3, posts: ['descendant'] },
        { slug: 'child', parent: 'parent', order: 4, posts: ['descendant'] },
        { slug: 'empty', order: 0, posts: [] },
    ];
    const original = structuredClone({ directory, posts });
    const ordered = sortSeriesByRecency(directory, posts);
    assert.deepEqual(ordered.filter(item => !item.parent).map(item => item.slug), ['parent', 'recent', 'popular', 'empty']);
    assert.deepEqual({ directory, posts }, original);
});
test("series date ties stay stable and published notes precede empty paths even before the Unix epoch", () => {
    const posts = [{ slug: 'early', timestamp: Date.parse('1960-01-01'), updatedTimestamp: Date.parse('1959-01-01') }];
    const directory = [
        { slug: 'empty', order: 0, posts: [] },
        { slug: 'b', posts: ['early'] },
        { slug: 'a', posts: ['early'] },
        { slug: 'ordered', order: 1, posts: ['early'] },
    ];
    assert.deepEqual(sortSeriesByRecency(directory, posts).map(item => item.slug), ['ordered', 'a', 'b', 'empty']);
});
test("contribution records compare actual instants across date-only commits and timezone offsets", () => {
    const project = { id: 'one', name: 'One', repository: 'https://github.com/example/one', items: [{ sha: 'abc1234', title: 'Commit', date: '2026-10-06' }] };
    const item = (number, updatedAt) => ({ number, updatedAt, repository: 'example/one', kind: 'issue', title: 'Work', url: `https://github.com/example/one/issues/${number}`, draft: false, state: 'open', relations: [] });
    const snapshot = { items: [item(1, '2026-10-06T03:00:00Z'), item(2, '2026-10-05T23:30:00-05:00')] };
    assert.deepEqual(projectRecords(project, snapshot).map(record => record.id), ['issue:2', 'issue:1', 'commit:abc1234']);
});
test("contribution project cards and archive tabs follow the latest record and react to new activity", () => {
    const project = (id, date) => ({ id, name: id, repository: `https://github.com/example/${id}`, items: date ? [{ sha: 'abc1234', title: 'Commit', date }] : [] });
    const projects = [project('old', '2026-01-01'), project('utc'), project('offset'), project('empty')];
    const item = (repository, updatedAt, number = 1) => ({ repository, updatedAt, number, kind: 'pr', title: 'Work', url: `https://github.com/${repository}/pull/${number}`, draft: false, state: 'open', relations: [] });
    const activity = { items: [item('example/utc', '2026-10-06T03:00:00Z'), item('example/offset', '2026-10-05T23:30:00-05:00')] };
    const original = structuredClone({ projects, activity });
    const expected = ['offset', 'utc', 'old', 'empty'];
    assert.deepEqual(sortContributionProjects(projects, activity).map(project => project.id), expected);
    const overview = contributionOverview(projects, activity, { records: [] });
    assert.deepEqual(overview.sectors.map(sector => sector.project.id), expected);
    assert.deepEqual(overview.records.map(record => record.projectId), ['offset', 'utc', 'old']);
    assert.deepEqual({ projects, activity }, original);
    const refreshed = { items: [...activity.items, item('example/old', '2026-10-07T00:00:00Z')] };
    assert.deepEqual(sortContributionProjects(projects, refreshed).map(project => project.id), ['old', 'offset', 'utc', 'empty']);
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

test("hello-world welcome routes preserve locale, deep links and search behavior", () => {
    assert.equal(welcomePath, "/hello-world/");
    for (const prefix of ["", "/en", "/ja", "/zh_TW"]) {
        const entrance = prefix + welcomePath;
        assert.equal(isWelcomeLocation(entrance, "", prefix), true);
        assert.equal(isWelcomeLocation(entrance.slice(0, -1), "", prefix), true);
        assert.equal(isWelcomeLocation(entrance, "?utm_source=link", prefix), true);
        assert.equal(isWelcomeLocation(`${prefix}/`, "", prefix), false);
        for (const search of ["?q=linux", "?tag=Rust", "?category=hardware", "?q="]) {
            assert.equal(isWelcomeLocation(entrance, search, prefix), false);
        }
        for (const path of ["/articles/", "/contribution/", "/series/", "/graph/", "/about/", "/2026/09/20/memory/", "/hello-world-again/"]) {
            assert.equal(isWelcomeLocation(prefix + path, "", prefix), false);
        }
        assert.equal(languageUrl(`${entrance}?utm_source=link#intro`, "en"), "/en/hello-world/?utm_source=link#intro");
        assert.equal(languageUrl(entrance, "zh_CN"), welcomePath);
    }
    assert.equal(isWelcomeLocation("/en", "", "/en"), false);
    assert.equal(isWelcomeLocation("/enough/", "", "/en"), false);
});

function navigationClock() {
    const jobs = [];
    const cancelled = [];
    const clock = {
        schedule(callback, duration) { const job = { callback, duration }; jobs.push(job); return job; },
        cancel(job) { cancelled.push(job); },
    };
    return { clock, jobs, cancelled };
}

test("animated navigation waits for departure and ignores repeated activation", () => {
    const { clock, jobs } = navigationClock();
    let visits = 0;
    const transition = createDeferredNavigation(() => visits++, WELCOME_RETURN_DURATION, clock);
    assert.equal(transition.start(), true);
    assert.equal(transition.start(), false);
    assert.equal(visits, 0);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].duration, WELCOME_RETURN_DURATION);
    jobs[0].callback();
    jobs[0].callback();
    assert.equal(visits, 1);
});

test("reduced motion skips or finishes a departure without duplicate navigation", () => {
    const { clock, jobs, cancelled } = navigationClock();
    let visits = 0;
    const transition = createDeferredNavigation(() => visits++, WELCOME_RETURN_DURATION, clock);
    transition.start(true);
    assert.equal(visits, 1);
    assert.equal(jobs.length, 0);
    transition.start();
    assert.equal(transition.finish(), true);
    assert.deepEqual(cancelled, [jobs[0]]);
    assert.equal(transition.finish(), false);
    jobs[0].callback();
    assert.equal(visits, 2);
});

test("back navigation and unmount cancel stale departures without overriding later navigation", () => {
    const { clock, jobs, cancelled } = navigationClock();
    let visits = 0;
    const transition = createDeferredNavigation(() => visits++, WELCOME_RETURN_DURATION, clock);
    transition.start();
    transition.cancel();
    transition.start();
    jobs[0].callback();
    assert.equal(visits, 0);
    jobs[1].callback();
    assert.equal(visits, 1);
    transition.start();
    transition.cancel();
    jobs[2].callback();
    assert.equal(visits, 1);
    assert.deepEqual(cancelled, [jobs[0], jobs[2]]);
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
