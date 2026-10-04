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

return fetchDetails;
}
