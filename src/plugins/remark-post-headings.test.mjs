import assert from "node:assert/strict";
import test from "node:test";
import { remarkPostHeadings } from "./remark-post-headings.mjs";

const heading = (depth, text) => ({
	type: "heading",
	depth,
	children: [{ type: "text", value: text }],
});

test("reserves h1 for the article title without changing anchor text or code", () => {
	const tree = {
		type: "root",
		children: [
			heading(1, "struct page"),
			heading(2, "Reference count"),
			{ type: "code", lang: "c", value: "#define PAGE_SIZE 4096" },
		],
	};
	remarkPostHeadings()(tree, {
		path: "D:\\blog\\src\\content\\posts\\memory.md",
	});
	assert.deepEqual(tree.children, [
		heading(2, "struct page"),
		heading(3, "Reference count"),
		{ type: "code", lang: "c", value: "#define PAGE_SIZE 4096" },
	]);
});

test("preserves articles already using h2 and deeper sections", () => {
	const tree = {
		type: "root",
		children: [heading(2, "Overview"), heading(3, "Details")],
	};
	const original = structuredClone(tree);
	remarkPostHeadings()(tree, { path: "/blog/src/content/posts/overview.md" });
	assert.deepEqual(tree, original);
});

test("handles a deeper starting level and caps legacy nesting at h6", () => {
	const deep = {
		type: "root",
		children: [heading(3, "Overview"), heading(4, "Details")],
	};
	remarkPostHeadings()(deep, { path: "src/content/posts/deep.md" });
	assert.deepEqual(
		deep.children.map((node) => node.depth),
		[2, 3],
	);
	const legacy = {
		type: "root",
		children: [heading(1, "Overview"), heading(6, "Details")],
	};
	remarkPostHeadings()(legacy, { path: "src/content/posts/legacy.md" });
	assert.deepEqual(
		legacy.children.map((node) => node.depth),
		[2, 6],
	);
});

test("leaves non-post documents and posts without headings unchanged", () => {
	for (const path of [
		"/blog/src/content/spec/about.md",
		"/blog/src/content/series/linux.md",
		"",
	]) {
		const tree = { type: "root", children: [heading(1, "About")] };
		remarkPostHeadings()(tree, { path });
		assert.equal(tree.children[0].depth, 1);
	}
	const tree = {
		type: "root",
		children: [
			{ type: "paragraph", children: [{ type: "text", value: "Hello" }] },
		],
	};
	const original = structuredClone(tree);
	remarkPostHeadings()(tree, { path: "src/content/posts/short.md" });
	assert.deepEqual(tree, original);
});
