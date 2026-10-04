import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const production = resolve("dist");
const preview = resolve(".astro/orbital-build");
const { documents } = JSON.parse(await readFile(resolve(production, "content-index.json"), "utf8"));
assert.ok(documents.length > 0, "Public content index must not be empty");
assert.equal(new Set(documents.map((p) => p.id)).size, documents.length, "Duplicate content IDs");
for (const document of documents) {
	assert.match(document.url, /^\/(?:en\/)?\d{4}\/\d{2}\/\d{2}\/.+\/$/);
	const path = resolve(production, `.${document.url}`, "index.html");
	assert.ok(path.startsWith(production));
	await access(path);
	if (document.locale === "en") assert.ok(document.url.startsWith("/en/"));
	else await access(resolve(preview, "design-preview/articles", document.id, "index.html"));
}
await assert.rejects(access(resolve(production, "design-preview/index.html")), "Production must exclude preview routes");
const entry = await readFile(resolve(preview, "design-preview/index.html"), "utf8");
assert.doesNotMatch(entry, /<template id="article-|bodyHtml/);
const { records } = JSON.parse(await readFile("rag/index.json", "utf8"));
const urls = new Set(documents.map((p) => p.url));
assert.ok(records.length > 0);
for (const record of records) assert.ok(urls.has(record.url), `Invalid RAG citation: ${record.url}`);
console.log(`Verified ${documents.length} article routes, ${records.length} RAG citations, and isolated preview payloads.`);
