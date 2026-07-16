/// <reference types="mdast" />
import { SKIP, visit } from "unist-util-visit";
import { siteConfig } from "../config.ts";
import { glossary } from "../data/glossary.ts";

/**
 * Automatically decorates glossary terms in post content with hover tooltips.
 *
 * Every occurrence of a term (or alias) defined in src/data/glossary.ts is
 * wrapped in `<span class="glossary-term" data-term data-definition>` and
 * styled purely with CSS (see src/styles/markdown.css). The definition
 * language is picked from the post's frontmatter `lang`, falling back to the
 * site language, then "en", then the first available translation.
 */

/* Set to true to only decorate the first occurrence of each term per post */
const FIRST_OCCURRENCE_ONLY = false;

/* Node types whose content must never be decorated */
const SKIP_TYPES = new Set([
	"code",
	"inlineCode",
	"inlineMath",
	"math",
	"link",
	"linkReference",
	"image",
	"imageReference",
	"definition",
	"heading",
	"html",
	"glossaryTerm",
]);

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* "zh_CN" -> "zh", "en-US" -> "en" */
function normalizeLang(lang) {
	if (!lang) return "";
	return String(lang).toLowerCase().replace(/_/g, "-").split("-")[0];
}

function pickDefinition(definitions, lang) {
	if (lang && definitions[lang]) return definitions[lang];
	if (definitions.en) return definitions.en;
	return Object.values(definitions)[0] || "";
}

/* Pure-ASCII forms are matched with word boundaries; anything containing
 * non-ASCII (e.g. CJK) is matched as a plain substring. */
function isAscii(value) {
	return /^[\x20-\x7E]+$/.test(value);
}

/* Build the matcher once at startup: one alternation regex, longest forms
 * first so "Log Replication" wins over "log", plus a lookup from each
 * lowercased surface form back to its glossary entry. */
const formMap = new Map();
for (const entry of glossary) {
	if (!entry.term || !entry.definitions) continue;
	for (const form of [entry.term, ...(entry.aliases || [])]) {
		const key = form.toLowerCase();
		if (!formMap.has(key)) formMap.set(key, entry);
	}
}
const latinForms = [];
const cjkForms = [];
for (const form of formMap.keys()) {
	(isAscii(form) ? latinForms : cjkForms).push(form);
}
const byLengthDesc = (a, b) => b.length - a.length;
const pattern =
	formMap.size === 0
		? null
		: new RegExp(
				[
					...latinForms
						.sort(byLengthDesc)
						.map((f) => `(?<![A-Za-z0-9_])${escapeRegExp(f)}(?![A-Za-z0-9_])`),
					...cjkForms.sort(byLengthDesc).map(escapeRegExp),
				].join("|"),
				"gi",
			);

export function remarkGlossary() {
	return (tree, { data }) => {
		if (!pattern) return;
		const lang =
			normalizeLang(data?.astro?.frontmatter?.lang) ||
			normalizeLang(siteConfig.lang);
		const seen = new Set();

		visit(tree, (node, index, parent) => {
			if (SKIP_TYPES.has(node.type)) return [SKIP];
			if (node.type !== "text") return;
			if (typeof index !== "number" || !parent) return;
			/* Keep admonition/directive titles plain */
			if (parent.data?.directiveLabel) return;

			const value = node.value;
			const children = [];
			let last = 0;
			let match;
			pattern.lastIndex = 0;

			// biome-ignore lint/suspicious/noAssignInExpressions: <regex exec loop>
			while ((match = pattern.exec(value)) !== null) {
				const entry = formMap.get(match[0].toLowerCase());
				const definition = entry ? pickDefinition(entry.definitions, lang) : "";
				if (!entry || !definition) continue;
				if (FIRST_OCCURRENCE_ONLY && seen.has(entry.term)) continue;

				if (match.index > last) {
					children.push({
						type: "text",
						value: value.slice(last, match.index),
					});
				}
				children.push({
					type: "glossaryTerm",
					data: {
						hName: "span",
						hProperties: {
							className: ["glossary-term"],
							dataTerm: entry.term,
							dataDefinition: definition,
							tabIndex: 0,
						},
					},
					children: [{ type: "text", value: match[0] }],
				});
				seen.add(entry.term);
				last = match.index + match[0].length;
			}

			if (children.length === 0) return;
			if (last < value.length) {
				children.push({ type: "text", value: value.slice(last) });
			}
			parent.children.splice(index, 1, ...children);
			return index + children.length;
		});
	};
}
