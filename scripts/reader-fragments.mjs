import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "parse5";

function walk(node, visit) {
	visit(node);
	for (const child of node.childNodes ?? []) walk(child, visit);
}
const attribute = (node, name) =>
	node.attrs?.find((item) => item.name === name)?.value;

export function extractReaderFragment(source) {
	const document = parse(source, { sourceCodeLocationInfo: true });
	let article;
	let head;
	walk(document, (node) => {
		if (node.tagName === "head") head = node;
		if (node.attrs?.some((item) => item.name === "data-reader-content"))
			article = node;
	});
	const location = article?.sourceCodeLocation;
	if (!location?.startTag || !location.endTag) return null;
	const start = location.startTag.endOffset;
	let html = source.slice(start, location.endTag.startOffset);
	const scripts = [];
	walk(article, (node) => {
		if (node.tagName === "script" && node.sourceCodeLocation)
			scripts.push(node.sourceCodeLocation);
	});
	for (const script of scripts.sort((a, b) => b.startOffset - a.startOffset)) {
		html =
			html.slice(0, script.startOffset - start) +
			html.slice(script.endOffset - start);
	}
	const styles = [];
	if (head)
		walk(head, (node) => {
			if (node.tagName === "link" && attribute(node, "rel") === "stylesheet") {
				const href = attribute(node, "href");
				if (href) styles.push(href);
			}
		});
	return { html, styles: [...new Set(styles)] };
}

export async function buildReaderFragments(outputUrl) {
	const output = fileURLToPath(outputUrl);
	const pages = (await readdir(output, { recursive: true })).filter((file) =>
		file.endsWith(".html"),
	);
	let count = 0;
	for (const page of pages) {
		const fragment = extractReaderFragment(
			await readFile(join(output, page), "utf8"),
		);
		if (!fragment) continue;
		const filename = join(output, page.replace(/index\.html$/, "content.json"));
		await writeFile(filename, JSON.stringify(fragment));
		count++;
	}
	console.log(`Reader fragments: ${count} article payloads`);
}
