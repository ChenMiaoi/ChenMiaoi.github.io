import assert from "node:assert/strict";
import { readFile, access, readdir } from "node:fs/promises";
import { resolve } from "node:path";

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
	assert.match(html, /class="orbital-site"/, `Non-Orbital page: ${file}`);
	assert.doesNotMatch(html, /ObservatoryHero|observatory\.css|orbital-preview|design-preview|设计预览/, file);
}
for (const path of ["", "en/", "ja/", "zh_TW/", "archive/", "series/", "graph/", "contribution/", "about/"]) {
	await access(resolve(production, path, "index.html"));
}
await access(resolve(production, "pagefind/pagefind.js"));
const details = JSON.parse(await readFile(resolve(production, "contributions.json"), "utf8"));
assert.ok(details.records.length > 0, "Contribution details must be available in production");
const { records } = JSON.parse(await readFile("rag/index.json", "utf8"));
const urls = new Set(documents.map((p) => p.url));
assert.ok(records.length > 0);
for (const record of records) assert.ok(urls.has(record.url), `Invalid RAG citation: ${record.url}`);
console.log(`Verified ${htmlFiles.length} Orbital pages, ${documents.length} canonical articles, contribution details and ${records.length} RAG citations.`);
