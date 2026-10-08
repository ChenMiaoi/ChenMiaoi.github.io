import assert from "node:assert/strict";
import test from "node:test";
import { extractReaderFragment } from "./reader-fragments.mjs";
import { charactersInRange } from "./interface-fonts.mjs";

test("reader payload preserves nested markup and Unicode while stripping executable scripts", () => {
	const html =
		'<html><head><link rel="stylesheet" href="/reader.css"><link rel="stylesheet" href="/reader.css"></head><body><main>Archive metadata</main><article data-reader-content><h2 id="页表">頁表</h2><article><code>&lt;/article&gt;</code></article><script>window.bad = true</script><p>日本語 🛰</p><script src="/bad.js"></script></article><footer>Archive footer</footer></body></html>';
	assert.deepEqual(extractReaderFragment(html), {
		html: '<h2 id="页表">頁表</h2><article><code>&lt;/article&gt;</code></article><p>日本語 🛰</p>',
		styles: ["/reader.css"],
	});
});

test("non-article pages do not create reader payloads and body links are not adopted", () => {
	assert.equal(extractReaderFragment("<main>Archive</main>"), null);
	assert.deepEqual(
		extractReaderFragment(
			'<article data-reader-content><link rel="stylesheet" href="/untrusted.css"><p>Text</p></article>',
		)?.styles,
		[],
	);
});

test("font subsets match explicit Unicode intervals without dropping supplementary characters", () => {
	assert.equal(charactersInRange("A字🛰B", "U+41,U+4E00-9FFF,U+1F6F0"), "A字🛰");
	assert.equal(charactersInRange("繁體かなabc", "U+3040-30FF"), "かな");
});
