import type { ContributionProject } from "../../types/config";
import type { contributionDetails } from "./snapshots";
import type { ContributionActivitySnapshot, SourceRecord } from "./types";

export function projectRecords(
	item: ContributionProject,
	snapshot: ContributionActivitySnapshot,
): SourceRecord[] {
	const repository = item.repository?.replace(/\/$/, "");
	const commits: SourceRecord[] = item.items.map((commit) => ({
		id: `commit:${commit.sha}`,
		kind: "commit",
		title: commit.title,
		date: commit.date,
		reference: commit.sha,
		sha: commit.sha,
		url: repository ? `${repository}/commit/${commit.sha}` : undefined,
		discussionUrl: commit.pullRequest?.url ?? commit.mailingListUrl,
		discussionLabel: commit.pullRequest
			? `PR #${commit.pullRequest.number}`
			: commit.mailingListLabel,
	}));
	const collaboration: SourceRecord[] = snapshot.items
		.filter((entry) => `https://github.com/${entry.repository}` === repository)
		.map((entry) => ({
			id: `${entry.kind}:${entry.number}`,
			kind: entry.kind === "pr" ? "pr" : "issue",
			title: entry.title,
			date: entry.updatedAt,
			reference: `${entry.kind === "pr" ? "PR" : "Issue"} #${entry.number}`,
			number: entry.number,
			url: entry.url,
			draft: entry.draft,
			relations: entry.relations,
		}));
	return [...commits, ...collaboration].sort((a, b) =>
		b.date.localeCompare(a.date),
	);
}

export function resolveContributionProjects(
	projects: ContributionProject[],
	snapshot: typeof contributionDetails,
) {
	return projects.map((project) => ({
		...project,
		items: project.items.map((item) => {
			const record = snapshot.records.find(
				(entry) => entry.url === `${project.repository}/commit/${item.sha}`,
			);
			const patch = record?.files
				.map((file) =>
					[
						`diff --git a/${file.previousFilename ?? file.filename} b/${file.filename}`,
						`--- ${file.status === "added" ? "/dev/null" : `a/${file.previousFilename ?? file.filename}`}`,
						`+++ ${file.status === "removed" ? "/dev/null" : `b/${file.filename}`}`,
						file.patch ??
							"[Patch unavailable in snapshot; view the original record.]",
					].join("\n"),
				)
				.join("\n\n");
			return { ...item, patch: item.patch ?? patch };
		}),
	}));
}
