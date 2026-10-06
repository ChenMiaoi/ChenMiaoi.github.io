import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import matter from "gray-matter";
import { parse } from "svelte/compiler";
import { localizeMetadata, metadataSearchText } from "../src/lib/content/localization.ts";
import { languageUrl } from "../src/features/orbital/i18n/index.ts";

test("reader language links retain the active heading and can return to the introduction", () => {
	assert.equal(languageUrl("/ja/2026/09/20/memory/?q=Linux#old", "en", "struct-page"), "/en/2026/09/20/memory/?q=Linux#struct-page");
	assert.equal(languageUrl("/ja/2026/09/20/memory/#old", "en", ""), "/en/2026/09/20/memory/");
	assert.equal(languageUrl("/ja/2026/09/20/memory/#old", "en"), "/en/2026/09/20/memory/#old");
});

test("directory translations preserve originals and search terms across language switches", () => {
	const metadata = {
		title: "内存管理", description: "中文摘要", tags: ["内存"],
		translations: { en: { title: "Memory management", description: "English summary", tags: ["Memory"] }, ja: { title: "メモリ管理" } },
	};
	const original = structuredClone(metadata);
	assert.equal(localizeMetadata(metadata, "en").title, "Memory management");
	assert.equal(localizeMetadata(metadata, "ja").description, "中文摘要");
	assert.equal(localizeMetadata(metadata, "zh_CN").title, "内存管理");
	assert.equal(localizeMetadata(metadata, "zh_TW").title, "内存管理");
	assert.equal(localizeMetadata({ title: "Source" }, "en").title, "Source");
	for (const query of ["内存", "Memory", "メモリ"]) assert.ok(metadataSearchText(metadata).includes(query));
	assert.deepEqual(metadata, original);
});

test("every published directory entry has English, Traditional Chinese and Japanese metadata", () => {
	for (const kind of ["posts", "series"]) {
		const directory = new URL(`../src/content/${kind}/`, import.meta.url);
		for (const file of readdirSync(directory).filter((name) => name.endsWith(".md") && !name.endsWith(".en.md"))) {
			const { data } = matter(readFileSync(new URL(file, directory), "utf8"));
			if (data.draft) continue;
			for (const locale of ["en", "zh_TW", "ja"]) {
				const translated = data.translations?.[locale];
				assert.ok(translated?.title?.trim(), `${file}: ${locale} title missing`);
				assert.ok(translated?.description?.trim(), `${file}: ${locale} description missing`);
				if (locale === "en") assert.doesNotMatch(translated.title + translated.description, /[\u3400-\u9fff]/, file);
			}
		}
	}
});

test("interface text and accessible labels use translations except names and technical notation", () => {
	const directory = new URL("../src/components/orbital/", import.meta.url);
	const names = new Set(["Miao's Blog", "Chen Miao", "GitHub", "RSS", "Ctrl K", "RISC-V · Verilog / Chisel / BSV", "Linux · LLVM · Cargo", "Issue", "PR", "CI ·", "ORBITAL"]);
	for (const file of readdirSync(directory).filter((name) => name.endsWith(".svelte"))) {
		const source = readFileSync(new URL(file, directory), "utf8");
		function visit(node) {
			if (!node || typeof node !== "object") return;
			if (node.type === "Attribute") {
				if (["title", "aria-label", "alt", "placeholder"].includes(node.name)) {
					for (const value of node.value ?? []) if (value.type === "Text" && /[A-Za-z\u3400-\u9fff]/.test(value.data)) assert.ok(names.has(value.data.trim()), `${file}: untranslated ${node.name}`);
				}
				return;
			}
			if (node.type === "Text" && /[A-Za-z\u3400-\u9fff]/.test(node.data)) assert.ok(names.has(node.data.trim()), `${file}: untranslated text ${node.data.trim()}`);
			for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === "object") visit(value);
		}
		visit(parse(source).html);
	}
});
