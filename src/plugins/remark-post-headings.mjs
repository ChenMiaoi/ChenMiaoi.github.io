import { visit } from "unist-util-visit";

// The page template owns h1. Normalize post sections before sectionize and
// Astro's heading extraction, preserving heading text and existing anchors.
export function remarkPostHeadings() {
	return (tree, file) => {
		const path = String(file.path ?? "").replaceAll("\\", "/");
		if (!/(?:^|\/)src\/content\/posts\//.test(path)) return;

		let minDepth = 6;
		visit(tree, "heading", (node) => {
			minDepth = Math.min(minDepth, node.depth);
		});
		const offset = 2 - minDepth;
		visit(tree, "heading", (node) => {
			node.depth = Math.min(6, node.depth + offset);
		});
	};
}
