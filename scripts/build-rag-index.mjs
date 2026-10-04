import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const input = new URL("../dist/content-index.json", import.meta.url);
const output = fileURLToPath(new URL("../rag/index.json", import.meta.url));
const { documents } = JSON.parse(await readFile(input, "utf8"));

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
const records = documents.flatMap(({ id, title, url, body }) =>
  chunks(body).map((content, index) => ({ id: id + '#' + (index + 1), title, url, content }))
);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), records }, null, 2));
console.log('RAG index: ' + records.length + ' chunks from ' + documents.length + ' posts');
