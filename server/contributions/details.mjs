import { readPullRequestStatus } from './pull-request-status.mjs';
import { referenceCandidates } from './references.mjs';
export const detailVersion = 3;
// Shared by local snapshot refresh and the VPS service.
export function createDetailReader(api, repositories) {
const allowed = new Set(repositories);
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
	const candidates = referenceCandidates(body, repository, repositories);
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
	for (const candidate of candidates.slice(0, 12)) {
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

async function fetchDetails(descriptor, existingRecord) {
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
	const record = existingRecord ?? await api(
		`${base}/${kind === "pr" ? "pulls" : "issues"}/${descriptor.number}`,
	);
	const [filePages, commentPages, reviewCommentPages, timelinePages, reviewPages, commitPages] =
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
			kind === "pr" ? api(`${base}/pulls/${descriptor.number}/reviews?per_page=100`, true) : [],
			kind === "pr" ? api(`${base}/pulls/${descriptor.number}/commits?per_page=100`, true) : [],
		]);
	const files = filePages.flat().map(fileRecord);
	const discussion = [
		...commentPages.flat().map((comment) => ({ ...comment, kind: 'comment' })),
		...reviewCommentPages.flat().map((comment) => ({ ...comment, kind: 'review-comment' })),
		...reviewPages.flat().filter((review) => review.state !== 'PENDING' && review.submitted_at &&
			(review.body?.trim() || ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)))
			.map((review) => ({ ...review, kind: 'review', created_at: review.submitted_at })),
	].filter((comment) => comment.body?.trim() || comment.kind === 'review')
		.sort((a, b) => b.created_at.localeCompare(a.created_at));
	const comments = discussion.map((comment) => ({
		author: comment.user?.login ?? 'ghost',
		url: comment.html_url,
		body: comment.body ?? '',
		createdAt: comment.created_at,
		updatedAt: comment.updated_at ?? comment.created_at,
		kind: comment.kind,
		bot: comment.user?.type === 'Bot' || /(?:\[bot\]$|^rustbot$)/i.test(comment.user?.login ?? ''),
		reviewState: comment.kind === 'review' ? comment.state : null,
		commitSha: comment.original_commit_id ?? comment.commit_id ?? null,
		replyToUrl: comment.in_reply_to_id ? `${url}#discussion_r${comment.in_reply_to_id}` : null,
		path: comment.path ?? null,
	}));
	const commits = commitPages.flat().map((commit) => ({
		sha: commit.sha, url: commit.html_url, title: commit.commit.message.split('\n')[0],
		author: commit.author?.login ?? commit.commit.author?.name ?? 'ghost',
		date: commit.commit.committer.date,
	}));
	if (kind === 'pr') {
		const latest = await api(`${base}/pulls/${descriptor.number}`);
		if (latest.head.sha !== record.head.sha || latest.base.sha !== record.base.sha || latest.updated_at !== record.updated_at ||
			latest.merged_at !== record.merged_at || latest.merge_commit_sha !== record.merge_commit_sha)
			throw new Error(`PR #${descriptor.number} changed during synchronization; previous snapshot retained`);
	}
	return {
		pullRequest: kind === "pr" ? await readPullRequestStatus(api, repository, descriptor.number, record, reviewPages.flat()) : undefined,
		detailVersion,
		fetchedAt: new Date().toISOString(),
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
		headSha: record.head?.sha ?? null,
		baseSha: record.base?.sha ?? null,
		mergeCommitSha: kind === 'pr' && record.merged_at ? record.merge_commit_sha ?? null : null,
		mergedAt: kind === 'pr' ? record.merged_at ?? null : null,
		commits,
		commitsTotal: kind === 'pr' ? record.commits : 0,
		commitsComplete: kind !== 'pr' || (commits.length === record.commits && commits.at(-1)?.sha === record.head.sha),
		comments,
		commentsTotal: comments.length,
		references: await relatedRecords(
			record.body ?? "",
			repository,
			timelinePages.flat(),
			url,
		),
		sha: null,
	};
}

return fetchDetails;
}
