import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "node:fs/promises";

const root = fileURLToPath(new URL("..", import.meta.url));
const postsDir = join(root, "src", "content", "posts");
const output = join(root, "rag", "index.json");
const files = [];
for await (const file of glob("*.md", { cwd: postsDir })) files.push(file);

function frontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
  return { meta, body: match[2] };
}
function clean(text) {
  return text.replace(/```[\s\S]*?```/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[#>*`_~-]/g, " ").replace(/\s+/g, " ").trim();
}
function chunks(body, size = 1400, overlap = 180) {
  const text = clean(body);
  const result = [];
  for (let start = 0; start < text.length; start += size - overlap) {
    const content = text.slice(start, start + size).trim();
    if (content.length >= 80) result.push(content);
    if (start + size >= text.length) break;
  }
  return result;
}
const records = [];
for (const file of files.sort()) {
  const parsed = frontmatter(await readFile(join(postsDir, file), "utf8"));
  if (parsed.meta.draft === "true") continue;
  const slug = file.replace(/\.md$/, "");
  const title = parsed.meta.title || slug;
  const url = `/posts/${slug}/`;
  for (const content of chunks(parsed.body)) records.push({ id: `${slug}#${records.length + 1}`, title, url, content });
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), records }, null, 2));
console.log(`RAG index: ${records.length} chunks from ${files.length} posts`);
