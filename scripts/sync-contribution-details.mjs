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

const fileRecord = (file) => ({
	filename: file.filename,
	previousFilename: file.previous_filename ?? null,
	status: file.status,
	additions: file.additions,
	deletions: file.deletions,
	patch: file.patch ?? null,
	url: file.blob_url ?? null,
});

async function relatedRecords(body, repository, timeline, ownUrl) {
	const candidates = new Map();
	for (const match of body.matchAll(
		/https:\/\/github\.com\/([^/\s]+\/[^/\s]+)\/(?:issues|pull)\/(\d+)\b/g,
	)) {
		if (allowed.has(match[1]))
			candidates.set(`${match[1]}#${match[2]}`, {
				repository: match[1],
				number: Number(match[2]),
			});
	}
	for (const match of body.matchAll(/(?<![\w/])#(\d+)\b/g))
		candidates.set(`${repository}#${match[1]}`, {
			repository,
			number: Number(match[1]),
		});
	const linked = new Map();
	for (const event of timeline) {
		const issue =
			event.event === "cross-referenced" ? event.source?.issue : undefined;
		if (!issue || issue.html_url === ownUrl || !issue.pull_request) continue;
		const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/\d+$/.exec(
			issue.html_url,
		);
		if (match && allowed.has(match[1]))
			linked.set(issue.html_url, {
				url: issue.html_url,
				number: issue.number,
				title: issue.title,
				kind: "pr",
				relation: "cross-reference",
			});
	}
	// Display source references, not inferred implementation/closure relationships.
	for (const candidate of [...candidates.values()].slice(0, 12)) {
		const issue = await api(
			`repos/${candidate.repository}/issues/${candidate.number}`,
		);
		if (issue.html_url !== ownUrl)
			linked.set(issue.html_url, {
				url: issue.html_url,
				number: issue.number,
				title: issue.title,
				kind: issue.pull_request ? "pr" : "issue",
				relation: "mentioned",
			});
	}
	return [...linked.values()];
}

async function fetchDetails(descriptor) {
	const { repository, kind, url } = descriptor;
	if (kind === "commit") {
		const pages = await api(
			`repos/${repository}/commits/${descriptor.sha}?per_page=100`,
			true,
		);
		const commit = pages[0];
		const files = pages.flatMap((page) => page.files ?? []).map(fileRecord);
		const [title, ...body] = commit.commit.message.split("\n");
		return {
			url,
			kind,
			title,
			body: body.join("\n").trim(),
			author: commit.author?.login ?? commit.commit.author.name,
			updatedAt: commit.commit.committer.date,
			state: "commit",
			files,
			stats: {
				files: files.length,
				additions: commit.stats.additions,
				deletions: commit.stats.deletions,
			},
			filesComplete: files.length < 3000,
			comments: [],
			commentsTotal: 0,
			references: [],
			sha: commit.sha,
		};
	}
	const base = `repos/${repository}`;
	const record = await api(
		`${base}/${kind === "pr" ? "pulls" : "issues"}/${descriptor.number}`,
	);
	const [filePages, commentPages, reviewPages, timelinePages] =
		await Promise.all([
			kind === "pr"
				? api(`${base}/pulls/${descriptor.number}/files?per_page=100`, true)
				: [],
			record.comments
				? api(`${base}/issues/${descriptor.number}/comments?per_page=100`, true)
				: [],
			kind === "pr" && record.review_comments
				? api(`${base}/pulls/${descriptor.number}/comments?per_page=100`, true)
				: [],
			kind === "issue"
				? api(`${base}/issues/${descriptor.number}/timeline?per_page=100`, true)
				: [],
		]);
	const files = filePages.flat().map(fileRecord);
	const humanComments = [...commentPages.flat(), ...reviewPages.flat()]
		.filter(
			(comment) =>
				comment.user?.type !== "Bot" &&
				!/(?:\[bot\]$|^rustbot$)/i.test(comment.user?.login ?? "") &&
				comment.body?.trim(),
		)
		.sort((a, b) => b.created_at.localeCompare(a.created_at));
	const comments = humanComments.slice(0, 5).map((comment) => ({
		author: comment.user.login,
		url: comment.html_url,
		body: comment.body,
		createdAt: comment.created_at,
		path: comment.path ?? null,
	}));
	return {
		url,
		kind,
		title: record.title,
		body: record.body ?? "",
		author: record.user.login,
		updatedAt: record.updated_at,
		state: record.merged_at
			? "merged"
			: record.state === "closed"
				? "closed"
				: record.draft
					? "draft"
					: "open",
		files,
		stats:
			kind === "pr"
				? {
						files: record.changed_files,
						additions: record.additions,
						deletions: record.deletions,
					}
				: null,
		filesComplete: kind !== "pr" || files.length === record.changed_files,
		comments,
		commentsTotal: humanComments.length,
		references: await relatedRecords(
			record.body ?? "",
			repository,
			timelinePages.flat(),
			url,
		),
		sha: null,
	};
}

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
