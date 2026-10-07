import assert from "node:assert/strict";
import test from "node:test";
import { createDetailReader } from "./details.mjs";
import { syncContributions } from "./sync.mjs";
import { detailsSchema } from "../../src/lib/contributions/schema.ts";
import { prepareContributionDetails } from "../../src/utils/contribution-reader.ts";

const repository = "example/public";
const url = `https://github.com/${repository}/pull/1`;
const head = "a".repeat(40);
const base = "b".repeat(40);
const previousHead = "c".repeat(40);
const date = "2026-10-05T00:00:00Z";
const descriptor = { repository, url, number: 1, kind: "pr" };
const record = {
	html_url: url,
	title: "Change",
	updated_at: date,
	state: "open",
	draft: false,
	body: "Description",
	user: { login: "writer" },
	head: { sha: head },
	base: { sha: base },
	changed_files: 1,
	additions: 11,
	deletions: 0,
	comments: 7,
	review_comments: 2,
	commits: 2,
};
const comment = (id, extra = {}) => ({
	id,
	user: { login: `person-${id}`, type: "User" },
	body: `Comment ${id}`,
	html_url: `${url}#issuecomment-${id}`,
	created_at: date,
	updated_at: date,
	...extra,
});
function fixtureApi({ racing = false } = {}) {
	const calls = [];
	const api = async (path) => {
		if (path.includes("/check-runs?"))
			return [{ total_count: 0, check_runs: [] }];
		if (/\/commits\/[^/]+\/status\?/.test(path))
			return [
				{
					total_count: 0,
					sha: path.split("/commits/")[1].split("/")[0],
					statuses: [],
				},
			];
		calls.push(path);
		if (path === `repos/${repository}`) return { private: false };
		if (path.startsWith("search/"))
			return {
				total_count: 1,
				incomplete_results: false,
				items: [
					{
						number: 1,
						title: "Change",
						html_url: url,
						updated_at: date,
						pull_request: {},
					},
				],
			};
		if (path.endsWith("/pulls/1"))
			return racing ? { ...record, head: { sha: previousHead } } : record;
		if (path.includes("/issues/1/comments"))
			return [
				[comment(1), comment(2), comment(3)],
				[
					comment(4),
					comment(5),
					comment(6),
					comment(7, { user: { login: "helper[bot]", type: "Bot" } }),
				],
			];
		if (path.includes("/pulls/1/comments"))
			return [
				[comment(8, { path: "file.c", original_commit_id: previousHead })],
				[
					comment(9, {
						path: "file.c",
						in_reply_to_id: 8,
						original_commit_id: previousHead,
					}),
				],
			];
		if (path.includes("/reviews?"))
			return [
				[
					comment(10, {
						body: "",
						state: "APPROVED",
						submitted_at: date,
						commit_id: head,
					}),
					comment(11, { body: "", state: "COMMENTED", submitted_at: date }),
					comment(12, {
						body: "Unsubmitted private draft",
						state: "PENDING",
						submitted_at: null,
					}),
				],
			];
		if (path.includes("/commits?"))
			return [previousHead, head].map((sha, i) => [
				{
					sha,
					html_url: `https://github.com/${repository}/commit/${sha}`,
					author: { login: "writer" },
					commit: {
						message: i ? "Trim redundant tests" : "Initial change",
						committer: { date },
					},
				},
			]);
		if (path.includes("/files?"))
			return [
				[
					{
						filename: "file.c",
						status: "modified",
						additions: 11,
						deletions: 0,
						patch: "@@ -1 +1 @@\n+current head",
						blob_url: `https://github.com/${repository}/blob/${head}/file.c`,
					},
				],
			];
		throw new Error(`Unexpected endpoint ${path}`);
	};
	return { api, calls };
}

test("complete paginated discussion includes approvals, bot records, replies and two commits", async () => {
	const { api } = fixtureApi();
	const detail = await createDetailReader(api, [repository])(
		descriptor,
		record,
	);
	assert.equal(detail.comments.length, 10); // seven comments, two replies, one approval
	assert.equal(detail.commentsTotal, 10);
	assert.ok(
		detail.comments.some(
			(item) => item.reviewState === "APPROVED" && item.body === "",
		),
	);
	assert.ok(detail.comments.some((item) => item.bot));
	assert.ok(
		detail.comments.some((item) => item.replyToUrl === `${url}#discussion_r8`),
	);
	assert.ok(
		!detail.comments.some((item) => item.body.includes("private draft")),
	);
	assert.equal(detail.commits.length, 2);
	assert.equal(detail.commits.at(-1).sha, head);
	assert.equal(detail.commitsComplete, true);
	assert.equal(detail.headSha, head);
	assert.equal(detail.stats.additions, 11);
	const parsed = detailsSchema.parse({
		syncedAt: date,
		activitySyncedAt: date,
		records: [detail],
	});
	const prepared = prepareContributionDetails(parsed).records[0];
	assert.equal(prepared.comments.length, 10);
	assert.equal(prepared.commits.at(-1).title, "Trim redundant tests");
});

test("a push during detail collection cannot publish mixed commit and file versions", async () => {
	const { api } = fixtureApi({ racing: true });
	await assert.rejects(
		createDetailReader(api, [repository])(descriptor, record),
		/changed during synchronization/,
	);
});

test("same search timestamp never hides a new head and older detail formats are upgraded", async () => {
	for (const old of [
		{ detailVersion: 2, headSha: previousHead, baseSha: base },
		{ detailVersion: 2, headSha: head, baseSha: base },
		{ headSha: head, baseSha: base },
	]) {
		const { api, calls } = fixtureApi();
		const previous = {
			activity: {
				account: "writer",
				repositories: [repository],
				syncedAt: date,
				items: [],
			},
			details: {
				records: [
					{
						url,
						kind: "pr",
						title: "Change",
						updatedAt: date,
						fetchedAt: new Date().toISOString(),
						state: "open",
						...old,
					},
				],
			},
		};
		const cache = new Map();
		const result = await syncContributions({
			config: { account: "writer", repositories: [repository] },
			projects: [],
			previous,
			api,
			detailCache: cache,
		});
		assert.equal(result.details.records[0].headSha, head);
		assert.equal(result.details.records[0].commits.length, 2);
		assert.ok(calls.some((path) => path.includes("/files?")));
		assert.equal(cache.get(url).comments.length, 10);
	}
});
