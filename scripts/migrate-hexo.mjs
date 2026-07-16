// One-off migration: Hexo posts (.hexo-posts/) -> Fuwari content collection.
// - date -> published (date-only; Hexo dates are Asia/Shanghai wall time, which
//   js-yaml parses as UTC, so UTC getters return the original wall time)
// - update -> updated, categories[0] -> category, mathjax dropped
// - leading H1 (duplicate of rendered title) + following hr stripped
// - series slug derived from filename prefix (adjust in series config later)
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import matter from "gray-matter";

const SRC = ".hexo-posts";
const OUT = "src/content/posts";

const SERIES_RULES = [
	["xv6-", "xv6"],
	["DDCA-", "ddca"],
	["CephV10-2-1-", "cephv10-2-1"],
	["Concurrency-in-Action-", "concurrency-in-action"],
	["ArkTS-", "arkts"],
	["LevelDB-", "leveldb"],
	["rfc", "rfc"],
	["GSOC2025-", "gsoc2025"],
];

const pad = (n) => String(n).padStart(2, "0");
const toDateStr = (d) =>
	`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// Code fence languages understood by highlight.js (Hexo) but not Shiki:
const LANG_MAP = {
	cc: "cpp",
	"C++": "cpp",
	Rust: "rust",
	Makefile: "makefile",
	gn: "txt",
	ld: "txt",
};

mkdirSync(OUT, { recursive: true });

let migrated = 0;
for (const file of readdirSync(SRC)) {
	if (!file.endsWith(".md")) continue;
	const raw = readFileSync(`${SRC}/${file}`, "utf8")
		.replace(/^﻿/, "")
		.replace(/^(\r?\n)+/, "");
	const { data, content } = matter(raw);
	if (!data.title || !data.date) {
		throw new Error(`${file}: frontmatter not parsed (missing title/date)`);
	}

	const body = content
		.replace(/\r\n/g, "\n")
		.replace(/^\s*#[^\n]*\n(\s*---+\s*\n)?/, "")
		.replace(/^(\s*)```\s*([A-Za-z0-9+#._-]+)\s*$/gm, (_m, indent, lang) => `${indent}\`\`\`${LANG_MAP[lang] ?? lang}`)
		.replace(/^\n+/, "");

	const fm = {
		title: data.title,
		slug: file.replace(/\.md$/, ""), // exact-case slug: Astro lowercases generated ids, which would break the old URLs
		published: toDateStr(new Date(data.date)),
		...(data.update ? { updated: toDateStr(new Date(data.update)) } : {}),
		tags: Array.isArray(data.tags) ? data.tags : [data.tags].filter(Boolean),
		category: Array.isArray(data.categories)
			? (data.categories[0] ?? "")
			: (data.categories ?? ""),
	};
	const series = SERIES_RULES.find(([prefix]) => file.startsWith(prefix));
	if (series) fm.series = series[1];

	writeFileSync(`${OUT}/${file}`, matter.stringify(body, fm));
	migrated++;
	console.log(`${file} -> published=${fm.published} category=${fm.category}${fm.series ? ` series=${fm.series}` : ""}`);
}
console.log(`\n${migrated} posts migrated.`);
