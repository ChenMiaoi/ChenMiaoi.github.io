import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import subsetFont from "subset-font";
import matter from "gray-matter";
import { transform } from "esbuild";
import { buildReaderFragments } from "./reader-fragments.mjs";

// Astro moves server modules into its prerender directory; use the project cwd.
const root = resolve();
const cache = join(root, ".astro", "interface-fonts");
const require = createRequire(import.meta.url);
const packages = ["noto-sans-sc", "noto-serif-sc"];
const styleGroups = {
	base: ["tokens", "base", "shell"],
	articles: ["articles"],
	series: ["series"],
	graph: ["map"],
	code: ["source", "contribution-control", "contribution-reader"],
	about: ["profile"],
	reading: ["reader"],
	shared: [
		"icons",
		"motion",
		"welcome",
		"i18n",
		"theme",
		"header",
		"contribution-status",
		"contribution-motion",
		"interaction-motion",
		"topic-colors",
		"mission-console",
		"console-surfaces",
		"navigation-console",
	],
};

async function files(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	return (
		await Promise.all(
			entries.map((entry) => {
				const path = join(directory, entry.name);
				return entry.isDirectory() ? files(path) : [path];
			}),
		)
	).flat();
}

// Include interface messages, profile text and every article/series preview.
// Full article bodies use the original fonts in a separate reading stylesheet.
export async function interfaceCharacters() {
	const sourceFiles = (await files(join(root, "src"))).filter((file) =>
		/\.(svelte|ts|md)$/.test(file),
	);
	const text = await Promise.all(
		sourceFiles.map(async (file) => {
			const source = await readFile(file, "utf8");
			if (!file.endsWith(".md")) return source;
			const { data, content } = matter(source);
			const introduction =
				content
					.split(/\r?\n\s*\r?\n/)
					.find(
						(part) => part.trim() && !/^(#|```|:::|!\[|<|\|)/.test(part.trim()),
					) ?? "";
			return `${JSON.stringify(data)} ${introduction} ${content.match(/^#{1,6}\s+.*$/gm)?.join(" ") ?? ""}`;
		}),
	);
	return [...new Set(text.join(""))]
		.sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))
		.join("");
}

export function charactersInRange(text, range) {
	const intervals = range.split(",").map((part) => {
		const [start, end = start] = part.trim().replace(/^U\+/i, "").split("-");
		return [Number.parseInt(start, 16), Number.parseInt(end, 16)];
	});
	return [...text]
		.filter((character) => {
			const point = character.codePointAt(0) ?? 0;
			return intervals.some(([start, end]) => point >= start && point <= end);
		})
		.join("");
}

export function interfaceFontUrls() {
	const { hash } = JSON.parse(
		readFileSync(join(cache, "manifest.json"), "utf8"),
	);
	return {
		interface: `/_fonts/${hash}/interface.css`,
		reader: `/_fonts/${hash}/reader.css`,
		styles: Object.fromEntries(
			Object.keys(styleGroups).map((name) => [
				name,
				`/_fonts/${hash}/${name}.css`,
			]),
		),
	};
}

async function generate() {
	const characters = await interfaceCharacters();
	const sources = await Promise.all(
		packages.map(async (name) => {
			const path = require.resolve(`@fontsource-variable/${name}/index.css`);
			return {
				name,
				directory: dirname(path),
				css: await readFile(path, "utf8"),
				version: await readFile(join(dirname(path), "package.json"), "utf8"),
			};
		}),
	);
	const styles = {};
	for (const [group, names] of Object.entries(styleGroups)) {
		styles[group] = (
			await Promise.all(
				names.map((name) =>
					readFile(join(root, "src/styles/orbital", `${name}.css`), "utf8"),
				),
			)
		).join("\n");
	}
	const generator = await readFile(
		join(root, "scripts/interface-fonts.mjs"),
		"utf8",
	);
	const hash = createHash("sha256")
		.update(await readFile(join(root, "pnpm-lock.yaml")))
		.update(
			`${generator}|${characters}|${sources.map((source) => source.css + source.version).join("|")}|${JSON.stringify(styles)}`,
		)
		.digest("hex")
		.slice(0, 16);
	const directory = join(cache, hash);
	const base = `/_fonts/${hash}`;
	await mkdir(directory, { recursive: true });
	try {
		await readFile(join(directory, "complete.json"));
	} catch {
		const interfaceFaces = [];
		const readerFaces = [];
		for (const source of sources) {
			await cp(
				join(source.directory, "LICENSE"),
				join(directory, `${source.name}-LICENSE.txt`),
			);
			for (const face of source.css.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
				const body = face[1];
				const fontFile = /url\(\.\/files\/([^)]*)\)/.exec(body)?.[1];
				const range = /unicode-range:\s*([^;]+);/.exec(body)?.[1];
				if (!fontFile || !range)
					throw new Error(`Invalid font source: ${source.name}`);
				const font = await readFile(join(source.directory, "files", fontFile));
				await writeFile(join(directory, fontFile), font);
				readerFaces.push(
					`@font-face{${body.replace(`./files/${fontFile}`, `${base}/${fontFile}`)}}`,
				);
				const text = charactersInRange(characters, range);
				if (!text) continue;
				const subset = await subsetFont(font, text, { targetFormat: "woff2" });
				const filename = `ui-${fontFile}`;
				await writeFile(join(directory, filename), subset);
				const exactRange = [...text]
					.map((character) => `U+${character.codePointAt(0)?.toString(16)}`)
					.join(",");
				interfaceFaces.push(
					`@font-face{${body
						.replace(/font-family: '([^']+)'/, "font-family: 'Orbital $1'")
						.replace(`./files/${fontFile}`, `${base}/${filename}`)
						.replace(range, exactRange)}}`,
				);
			}
		}
		await writeFile(
			join(directory, "interface.css"),
			interfaceFaces.join("\n"),
		);
		await writeFile(
			join(directory, "reader.css"),
			`${readerFaces.join("\n")}\n.orbital-site[data-article-fonts]{--sans:"Noto Sans SC Variable","Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;--display:"Source Serif 4 Variable","Noto Serif SC Variable",Georgia,"Songti SC",SimSun,serif;--mono:"JetBrains Mono Variable","Noto Sans SC Variable",monospace}\n.reader-body,.article-document{--sans:"Orbital Noto Sans SC Variable","Noto Sans SC Variable","Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;--display:"Source Serif 4 Variable","Orbital Noto Serif SC Variable","Noto Serif SC Variable",Georgia,"Songti SC",SimSun,serif;--mono:"JetBrains Mono Variable","Orbital Noto Sans SC Variable","Noto Sans SC Variable",monospace}`,
		);
		for (const [group, css] of Object.entries(styles)) {
			const minified = await transform(css, {
				loader: "css",
				minify: true,
				target: "es2022",
			});
			await writeFile(join(directory, `${group}.css`), minified.code);
		}
		const katexDirectory = dirname(require.resolve("katex/dist/katex.min.css"));
		const katexCss = (
			await readFile(join(katexDirectory, "katex.min.css"), "utf8")
		).replaceAll("url(fonts/", `url(${base}/katex-fonts/`);
		await cp(join(katexDirectory, "fonts"), join(directory, "katex-fonts"), {
			recursive: true,
		});
		await writeFile(
			join(directory, "reading.css"),
			(await readFile(join(directory, "reading.css"), "utf8")) + katexCss,
		);
		await writeFile(
			join(directory, "complete.json"),
			JSON.stringify({
				characters: characters.length,
				faces: interfaceFaces.length,
			}),
		);
		console.log(
			`Interface fonts: ${characters.length} characters, ${interfaceFaces.length} small subsets`,
		);
	}
	await writeFile(join(cache, "manifest.json"), JSON.stringify({ hash }));
	return { directory, hash };
}

export default function interfaceFonts() {
	let assets;
	return {
		name: "orbital-interface-fonts",
		hooks: {
			"astro:config:setup": async ({ updateConfig }) => {
				assets = await generate();
				updateConfig({
					vite: {
						plugins: [
							{
								name: "orbital-interface-fonts-dev",
								configureServer(server) {
									server.middlewares.use(async (request, response, next) => {
										if (!request.url?.startsWith(`/_fonts/${assets.hash}/`))
											return next();
										const filename = request.url
											.split("?")[0]
											.slice(`/_fonts/${assets.hash}/`.length);
										if (!/^(?:katex-fonts\/)?[\w.-]+$/.test(filename))
											return next();
										try {
											const bytes = await readFile(
												join(assets.directory, filename),
											);
											response.setHeader(
												"Content-Type",
												filename.endsWith(".css") ? "text/css" : "font/woff2",
											);
											response.end(bytes);
										} catch {
											next();
										}
									});
								},
							},
						],
					},
				});
			},
			"astro:build:done": async ({ dir }) => {
				await cp(assets.directory, new URL(`_fonts/${assets.hash}/`, dir), {
					recursive: true,
				});
				await buildReaderFragments(dir);
			},
		},
	};
}
