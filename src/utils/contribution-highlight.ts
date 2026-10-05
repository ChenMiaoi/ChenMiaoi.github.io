import asm from "@shikijs/langs/asm";
import c from "@shikijs/langs/c";
import cmake from "@shikijs/langs/cmake";
import cpp from "@shikijs/langs/cpp";
import diff from "@shikijs/langs/diff";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import llvm from "@shikijs/langs/llvm";
import makefile from "@shikijs/langs/makefile";
import python from "@shikijs/langs/python";
import rust from "@shikijs/langs/rust";
import shell from "@shikijs/langs/shellscript";
import typescript from "@shikijs/langs/typescript";
import verilog from "@shikijs/langs/verilog";
import yaml from "@shikijs/langs/yaml";
import { escapeHtml } from "markdown-it/lib/common/utils.mjs";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

const theme = {
	name: "orbital-code",
	type: "dark" as const,
	colors: { "editor.background": "#0a151a", "editor.foreground": "#ccdad1" },
	tokenColors: [
		{ scope: ["comment"], settings: { foreground: "#8fa69c" } },
		{ scope: ["keyword", "storage"], settings: { foreground: "#dfada1" } },
		{
			scope: ["string", "markup.inserted"],
			settings: { foreground: "#b8d39a" },
		},
		{
			scope: ["constant", "support.constant"],
			settings: { foreground: "#dcc48d" },
		},
		{
			scope: ["entity.name.function", "support.function"],
			settings: { foreground: "#9fcbd0" },
		},
		{
			scope: ["entity.name.type", "support.type"],
			settings: { foreground: "#c5c3e0" },
		},
		{ scope: ["markup.deleted"], settings: { foreground: "#e2aaa0" } },
	],
};

// Initialized once on the server; no highlighter or grammar is sent to the browser.
const highlighter = createHighlighterCoreSync({
	themes: [theme],
	langs: [
		c,
		cpp,
		rust,
		shell,
		python,
		javascript,
		typescript,
		json,
		yaml,
		diff,
		asm,
		llvm,
		cmake,
		makefile,
		verilog,
	],
	engine: createJavaScriptRegexEngine(),
});
const aliases: Record<string, string> = {
	cc: "cpp",
	"c++": "cpp",
	cxx: "cpp",
	h: "c",
	hpp: "cpp",
	rs: "rust",
	sh: "shellscript",
	bash: "shellscript",
	shell: "shellscript",
	zsh: "shellscript",
	py: "python",
	js: "javascript",
	ts: "typescript",
	yml: "yaml",
	patch: "diff",
	assembly: "asm",
	"llvm-ir": "llvm",
	make: "makefile",
};
const languages = new Set(highlighter.getLoadedLanguages());

export function highlightContributionCode(code: string, info: string) {
	const requested = info.trim().split(/\s+/)[0].toLowerCase();
	const language = aliases[requested] ?? requested;
	// Unlabelled, unknown and very large blocks remain lossless plain text.
	if (!languages.has(language) || code.length > 50_000) return "";
	try {
		const lines = highlighter.codeToTokensBase(code, {
			lang: language,
			theme: theme.name,
		});
		const content = lines
			.map((line) =>
				line
					.map(
						(token) =>
							`<span style="color:${token.color}">${escapeHtml(token.content)}</span>`,
					)
					.join(""),
			)
			.join("\n");
		return `<pre class="contribution-code" data-language="${escapeHtml(requested)}"><code>${content}</code></pre>`;
	} catch {
		return "";
	}
}
