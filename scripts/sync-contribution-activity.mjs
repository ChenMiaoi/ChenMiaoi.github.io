import { activitySchema } from "../src/lib/contributions/schema.ts";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { contributionSyncConfig: config } = await import("../src/lib/contributions/config.ts");
const output = new URL(
	"../src/data/contribution-activity.json",
	import.meta.url,
);

function api(endpoint) {
	return JSON.parse(
		execFileSync("gh", ["api", "--hostname", "github.com", endpoint], {
			encoding: "utf8",
			maxBuffer: 16 * 1024 * 1024,
			timeout: 60_000,
		}),
	);
}

// Do not write the snapshot until every repository and page has succeeded.
const records = new Map();
for (const repository of config.repositories) {
	for (const relation of ["author", "assignee"]) {
		const query = `repo:${repository} is:open ${relation}:${config.account}`;
		for (let page = 1; ; page++) {
			const result = api(
				`search/issues?q=${encodeURIComponent(query)}&per_page=100&page=${page}`,
			);
			if (
				result.incomplete_results ||
				result.total_count > 1000 ||
				!Array.isArray(result.items)
			) {
				throw new Error(
					`Incomplete GitHub search: ${query}. Existing snapshot retained.`,
				);
			}
			for (const item of result.items) {
				const existing = records.get(item.html_url);
				const relations = [
					...new Set([...(existing?.relations ?? []), relation]),
				];
				records.set(item.html_url, {
					repository,
					number: item.number,
					title: item.title,
					url: item.html_url,
					kind: item.pull_request ? "pr" : "issue",
					draft: Boolean(item.draft),
					updatedAt: item.updated_at,
					relations,
				});
			}
			if (page * 100 >= result.total_count) break;
		}
	}
}
const snapshot = {
	account: config.account,
	repositories: config.repositories,
	syncedAt: new Date().toISOString(),
	items: [...records.values()].sort((a, b) =>
		b.updatedAt.localeCompare(a.updatedAt),
	),
};
activitySchema.parse(snapshot);
const temporary = fileURLToPath(output) + ".tmp";
try {
	await writeFile(temporary, JSON.stringify(snapshot, null, 2) + "\n");
	await rename(temporary, output);
} finally {
	await rm(temporary, { force: true });
}
console.log(
	`Synced ${snapshot.items.length} open issues/PRs for ${config.account}.`,
);
