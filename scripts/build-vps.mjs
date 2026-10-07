import { build } from "esbuild";
import { access, cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(".output/vps");
await access("dist/index.html");
// Only this fixed, ignored build directory is replaced; persisted data is never packaged.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp("dist", output, { recursive: true });
await build({
	entryPoints: ["server/contributions/main.mjs"],
	outfile: resolve(output, "runtime/server.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node22",
	banner: {
		js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
	},
});
console.log(
	"VPS artifact ready: static site and self-contained Node service (no credentials).",
);
