import assert from "node:assert/strict";
import { readFile, access, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const production = resolve("dist");
const { documents } = JSON.parse(await readFile(resolve(production, "content-index.json"), "utf8"));
assert.ok(documents.length > 0, "Public content index must not be empty");
assert.equal(new Set(documents.map((p) => p.id)).size, documents.length, "Duplicate content IDs");
for (const document of documents) {
	assert.match(document.url, /^\/(?:en\/)?\d{4}\/\d{2}\/\d{2}\/.+\/$/);
	const path = resolve(production, `.${document.url}`, "index.html");
	assert.ok(path.startsWith(production));
	await access(path);
	const html = await readFile(path, "utf8");
	assert.match(html, /data-reader-content/, `Article body missing: ${document.url}`);
	assert.match(html, /data-pagefind-body/, `Searchable body missing: ${document.url}`);
	assert.ok(html.includes(document.title));
	assert.doesNotMatch(html, /name="robots" content="noindex/);
	if (document.locale === "en") assert.ok(document.url.startsWith("/en/"));
}
await assert.rejects(access(resolve(production, "design-preview/index.html")), "Retired preview routes must not exist");
const htmlFiles = (await readdir(production, { recursive: true })).filter((file) => file.endsWith(".html"));
for (const file of htmlFiles) {
	const html = await readFile(resolve(production, file), "utf8");
	if (html.includes("data-archive-redirect")) continue;
	assert.match(html, /class="orbital-site"/, `Non-Orbital page: ${file}`);
	assert.doesNotMatch(html, /ObservatoryHero|observatory\.css|orbital-preview|design-preview|设计预览/, file);
}
for (const path of ["", "en/", "ja/", "zh_TW/", "articles/", "series/", "graph/", "contribution/", "about/"]) {
	await access(resolve(production, path, "index.html"));
}
for (const prefix of ["", "en/", "ja/", "zh_TW/"]) {
    const seriesPage = await readFile(resolve(production, prefix, "series", "index.html"), "utf8");
    const seriesOptions = [...seriesPage.matchAll(/<button class="([^"]*)"[^>]*aria-pressed="(true|false)"[^>]*>/g)]
        .filter(option => option[1].split(/\s+/).includes("path-option"));
    assert.ok(seriesOptions.length > 0, `Series directory missing: ${prefix}`);
    assert.equal(seriesOptions[0][2], "true", `Latest series is not selected by default: ${prefix}`);
    assert.equal(seriesOptions.filter(option => option[2] === "true").length, 1, `Ambiguous default series: ${prefix}`);
    const controlPage = await readFile(resolve(production, prefix, "contribution", "index.html"), "utf8");
    assert.match(controlPage, /class="mission-control"/);
    assert.doesNotMatch(controlPage, /data-archive-redirect/);
    for (const project of ["linux", "llvm-project", "cargo"]) {
        const projectPage = await readFile(resolve(production, prefix, "contribution", project, "index.html"), "utf8");
        assert.match(projectPage, /class="source-dock"/);
        assert.ok(projectPage.includes(`href="https://nyachen.cn/${prefix}contribution/${project}/"`));
    }
	const [lang, entrance, heading, switchLabel] = {
		"": ["zh-CN", "欢迎登站", "文章档案", "选择语言"],
		"en/": ["en", "Welcome aboard", "Article archive", "Choose language"],
		"ja/": ["ja", "ようこそ", "記事アーカイブ", "言語を選択"],
		"zh_TW/": ["zh-TW", "歡迎登站", "文章檔案", "選擇語言"],
	}[prefix];
	const home = await readFile(resolve(production, prefix, "index.html"), "utf8");
	const entrancePath = `/${prefix}hello-world/`;
	assert.ok(home.includes(`data-archive-redirect="${entrancePath}"`), `Home redirect missing: ${prefix}`);
	assert.ok(home.includes(`content="0;url=${entrancePath}"`), `No-script home redirect missing: ${prefix}`);
	assert.ok(home.includes(`href="https://nyachen.cn${entrancePath}"`), `Home canonical missing: ${prefix}`);
	const redirectScript = /<script\b[^>]*>([\s\S]*?)<\/script>/.exec(home)?.[1];
	assert.ok(redirectScript, `Home redirect script missing: ${prefix}`);
	for (const search of ["", "?utm_source=link", "?q=Linux&category=hardware", "?q=", "?tag=Rust", "?category=kernel"]) {
		let destination;
		const hash = "#intro";
		runInNewContext(redirectScript, { URLSearchParams, window: { location: { search, hash, replace: (url) => { destination = url; } } } }, { timeout: 1000 });
		const target = ["", "?utm_source=link"].includes(search) ? entrancePath : `/${prefix}articles/`;
		assert.equal(destination, target + search + hash, `Home redirect loses location: ${prefix}${search}`);
	}
	const welcome = await readFile(resolve(production, prefix, "hello-world/index.html"), "utf8");
	assert.match(welcome, /class="welcome-portal/, `Welcome missing: ${prefix}`);
	assert.ok(welcome.includes(`href="https://nyachen.cn${entrancePath}"`), `Welcome canonical missing: ${prefix}`);
	assert.ok(welcome.includes(`<html lang="${lang}"`), `Wrong document language: ${prefix}`);
	assert.ok(welcome.includes(`<title>${entrance} · Miao&#39;s Blog</title>`) || welcome.includes(`<title>${entrance} · Miao's Blog</title>`), `Untranslated entrance title: ${prefix}`);
	assert.ok(welcome.includes(`aria-label="${switchLabel}"`), `Language switch missing: ${prefix}`);
	const welcomeEntry = /<a\b[^>]*class="portal-enter"[^>]*>/.exec(welcome)?.[0];
	assert.ok(welcomeEntry?.includes(`href="/${prefix}contribution/"`), `Welcome entry must open contributions: ${prefix}`);
	const archive = await readFile(resolve(production, prefix, "articles/index.html"), "utf8");
	assert.match(archive, /class="terminal-shell/);
	assert.ok(archive.includes(`<title>${heading} · Miao&#39;s Blog</title>`) || archive.includes(`<title>${heading} · Miao's Blog</title>`), `Untranslated archive title: ${prefix}`);
	const welcomeHeader = /<header class="terminal-header">[\s\S]*?<\/header>/.exec(welcome)?.[0];
	assert.ok(welcomeHeader, `Shared welcome header missing: ${prefix}`);
	const normalizeHeader = (header) => header.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ");
	for (const section of ["articles", "series", "graph", "contribution", "about"]) {
		const sectionPage = await readFile(resolve(production, prefix, section, "index.html"), "utf8");
		const sectionHeader = /<header class="terminal-header">[\s\S]*?<\/header>/.exec(sectionPage)?.[0];
		assert.ok(sectionHeader, `Section header missing: ${prefix}${section}`);
		assert.equal(normalizeHeader(sectionHeader), normalizeHeader(welcomeHeader), `Welcome header differs from ${prefix}${section}`);
	}
	const legacy = await readFile(resolve(production, prefix, "archive/index.html"), "utf8");
	assert.ok(legacy.includes(`data-archive-redirect="/${prefix}articles/"`));
	assert.ok(legacy.includes(`content="0;url=/${prefix}articles/"`));
	assert.ok(legacy.includes(`href="https://nyachen.cn/${prefix}articles/"`));
	await access(resolve(production, prefix, "2026/09/20/linux-physical-memory/index.html"));
	assert.doesNotMatch(archive, /class="welcome-portal/);
}
await access(resolve(production, "pagefind/pagefind.js"));
const details = JSON.parse(await readFile(resolve(production, "contributions.json"), "utf8"));
assert.equal(details.version, 1);
assert.ok(details.activity.items.every((item) => details.records.some((record) => record.url === item.url)), "Activity and details must form a complete snapshot");
assert.ok(details.records.length > 0, "Contribution details must be available in production");
const { records } = JSON.parse(await readFile("rag/index.json", "utf8"));
const urls = new Set(documents.map((p) => p.url));
assert.ok(records.length > 0);
for (const record of records) assert.ok(urls.has(record.url), `Invalid RAG citation: ${record.url}`);
console.log(`Verified ${htmlFiles.length} Orbital pages, ${documents.length} canonical articles, contribution details and ${records.length} RAG citations.`);
