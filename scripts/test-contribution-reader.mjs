import assert from "node:assert/strict";
import {
	renderContributionMarkdown,
	prepareContributionDetails,
} from "../src/utils/contribution-reader.ts";
import { contributionDiffLines } from "../src/utils/contribution-diff.ts";

const source = "https://github.com/example/project/issues/12";
const html = renderContributionMarkdown(
	'## Reproduction\n\n```c\n<script>alert(1)</script>\n```\n\n<script>window.stolen = true</script><a href="javascript:alert(1)" onclick="bad()">bad</a><img src="javascript:bad()" onerror="bad()">\n\n[original](https://github.com/example/project/pull/13)',
	source,
);
assert.match(html, /<h2>Reproduction<\/h2>/);
assert.match(html.replace(/<\/?span\b[^>]*>/g, ""), /&lt;script&gt;/);
assert.doesNotMatch(
	html,
	/<script|<img|onclick|onerror|javascript:|window\.stolen/,
);
assert.match(html, /rel="noopener noreferrer"/);
assert.match(
	renderContributionMarkdown(
		"![Diagram](https://example.org/image.png)",
		source,
	),
	/查看图片：Diagram/,
);
assert.doesNotMatch(
	renderContributionMarkdown(
		"![Diagram](https://example.org/image.png)",
		source,
	),
	/<img/,
);
assert.match(
	renderContributionMarkdown("[anchor](#context)", source),
	/https:\/\/github.com\/example\/project\/issues\/12#context/,
);

// Highlighting must retain indentation, escaped characters and every newline.
for (const language of ["c", "c++", "cc", "rust", "bash", "python", "asm", "llvm", "diff"]) {
	const code = '\tconst char *s = "<&>";\n\n  return 42;\n';
	const highlighted = renderContributionMarkdown(`\`\`\`${language}\n${code}\`\`\``, source);
	assert.match(highlighted, /class="contribution-code"/);
	assert.match(highlighted, /<span style="color:#[A-F0-9]{6}">/);
	const content = highlighted.match(/<code>([\s\S]*?)<\/code>/)[1].replace(/<\/?span\b[^>]*>/g, "");
	assert.equal(content, code.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
}
for (const language of ["", "unknown-language", 'unknown"onclick="bad()']) {
	const fallback = renderContributionMarkdown(`\`\`\`${language}\n<&>\n\`\`\``, source);
	assert.doesNotMatch(fallback, /contribution-code|style=|onclick/);
	assert.match(fallback, /&lt;&amp;&gt;/);
}
assert.doesNotMatch(renderContributionMarkdown('```c\n' + 'x'.repeat(50_001) + '\n```', source), /contribution-code/);
assert.doesNotMatch(renderContributionMarkdown('<span style="color:red;position:fixed;background:url(javascript:bad())" onclick="bad()">safe</span>', source), /style=|onclick|javascript:/);

const raw = {
	syncedAt: "2026-10-04T00:00:00Z",
	records: [
		{
			kind: "commit",
			url: source,
			body: "Fix the cleanup.\n\nSigned-off-by: Example <example@example.org>",
			comments: [],
		},
	],
};
const prepared = prepareContributionDetails(raw);
assert.match(prepared.records[0].bodyHtml, /Fix the cleanup/);
assert.doesNotMatch(prepared.records[0].bodyHtml, /Signed-off/);
assert.match(prepared.records[0].trailers, /^Signed-off/);
assert.match(raw.records[0].body, /Signed-off/);

const discussion = prepareContributionDetails({ ...raw, records: [{ ...raw.records[0], kind: 'issue',
	body: '```cpp\nint main() { return 0; }\n```',
	comments: [{ url: source + '#comment', body: '```rust\nfn main() {}\n```' }] }] });
assert.match(discussion.records[0].bodyHtml, /contribution-code/);
assert.match(discussion.records[0].comments[0].bodyHtml, /contribution-code/);
assert.equal(discussion.records[0].comments[0].excerpt, 'fn main() {}');

const patch =
	"@@ -8,2 +8,3 @@\n \tunchanged\n-\tremoved\n+\tadded\n+\tadded again\n\\ No newline at end of file\n@@ -20 +21 @@\n-before\n+after";
const diff = contributionDiffLines(patch);
assert.deepEqual(
	diff.map(({ kind }) => kind),
	["hunk", "context", "remove", "add", "add", "meta", "hunk", "remove", "add"],
);
assert.equal(diff.map(({ text }) => text).join("\n"), patch);
console.log("Contribution reader safety and lossless patch checks passed.");
