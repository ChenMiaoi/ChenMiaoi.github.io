import { createDetailReader } from '../server/contributions/details.mjs';
import { detailsSchema } from "../src/lib/contributions/schema.ts";
import { execFile } from "node:child_process";
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
const activity = JSON.parse(
	await readFile(
		new URL("../src/data/contribution-activity.json", import.meta.url),
		"utf8",
	),
);
const { contributionConfig, contributionSyncConfig: config } = await import("../src/lib/contributions/config.ts");
const allowed = new Set(config.repositories);
const output = fileURLToPath(
	new URL("../src/data/contribution-details.json", import.meta.url),
);

const { projects } = contributionConfig;

const requests = new Map();
function api(endpoint, paginate = false) {
	const key = `${paginate}:${endpoint}`;
	if (!requests.has(key))
		requests.set(
			key,
			execute(
				"gh",
				[
					"api",
					"--hostname",
					"github.com",
					endpoint,
					...(paginate ? ["--paginate", "--slurp"] : []),
				],
				{
					encoding: "utf8",
					maxBuffer: 32 * 1024 * 1024,
					timeout: 60_000,
				},
			).then(({ stdout }) => JSON.parse(stdout)),
		);
	return requests.get(key);
}

function repositoryOf(url) {
	const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/?$/.exec(url ?? "");
	if (!match || !allowed.has(match[1]))
		throw new Error(`Repository is not allowlisted: ${url}`);
	return match[1];
}

const descriptors = projects.flatMap((project) =>
	project.items.map((item) => ({
		repository: repositoryOf(project.repository),
		kind: "commit",
		sha: item.sha,
		url: `${project.repository}/commit/${item.sha}`,
	})),
);
for (const item of activity.items) {
	if (
		!allowed.has(item.repository) ||
		!["pr", "issue"].includes(item.kind) ||
		!Number.isInteger(item.number)
	)
		throw new Error("Invalid activity snapshot; previous details retained.");
	descriptors.push({
		repository: item.repository,
		kind: item.kind,
		number: item.number,
		url: item.url,
	});
}

const fetchDetails = createDetailReader(api, config.repositories);

const records = [];
// Keep GitHub requests bounded while independent records are downloaded.
for (let index = 0; index < descriptors.length; index += 2) {
	const batch = await Promise.all(
		descriptors.slice(index, index + 2).map(fetchDetails),
	);
	records.push(...batch);
	console.log(
		`Read ${records.length}/${descriptors.length} contribution details.`,
	);
}
const snapshot = {
	syncedAt: new Date().toISOString(),
	activitySyncedAt: activity.syncedAt,
	records,
};
detailsSchema.parse(snapshot);
const temporary = `${output}.tmp`;
try {
	await writeFile(temporary, `${JSON.stringify(snapshot, null, "\t")}\n`);
	await rename(temporary, output);
} finally {
	await rm(temporary, { force: true });
}
console.log(`Saved ${records.length} public contribution details.`);
