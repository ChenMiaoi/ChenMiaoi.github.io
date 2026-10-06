import type { ContributionProject } from "../../types/config";
import type { contributionDetails } from "./snapshots";
import type {
	ContributionActivitySnapshot,
	ContributionDetail,
	SourceRecord,
} from "./types";

type RecordIndex = {
	records: Pick<
		ContributionDetail,
		| "url"
		| "kind"
		| "sha"
		| "title"
		| "author"
		| "updatedAt"
		| "state"
		| "mergeCommitSha"
		| "mergedAt"
	>[];
};

function recordTimestamp(date?: string) {
	const timestamp = date ? Date.parse(date) : Number.NaN;
	return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

type DatedRecord = Pick<SourceRecord, "date" | "id" | "url">;

export function compareContributionRecords(a: DatedRecord, b: DatedRecord) {
	return (
		recordTimestamp(b.date) - recordTimestamp(a.date) ||
		(a.url ?? a.id).localeCompare(b.url ?? b.id)
	);
}

export function projectRecords(
	item: ContributionProject,
	snapshot: ContributionActivitySnapshot,
	details?: RecordIndex,
): SourceRecord[] {
	const repository = item.repository?.replace(/\/$/, "");
	const byUrl = new Map(details?.records.map((record) => [record.url, record]));
	const commits = new Map<string, SourceRecord>();
	for (const commit of item.items) {
		const url = repository ? `${repository}/commit/${commit.sha}` : undefined;
		commits.set(byUrl.get(url ?? "")?.sha ?? commit.sha, {
			id: `commit:${commit.sha}`,
			kind: "commit",
			title: commit.title,
			date: commit.date,
			reference: commit.sha,
			sha: commit.sha,
			url,
			discussionUrl: commit.pullRequest?.url ?? commit.mailingListUrl,
			discussionLabel: commit.pullRequest
				? `PR #${commit.pullRequest.number}`
				: commit.mailingListLabel,
		});
	}
	for (const entry of snapshot.items) {
		if (
			`https://github.com/${entry.repository}` !== repository ||
			entry.kind !== "pr"
		)
			continue;
		const pr = byUrl.get(entry.url);
		if (
			pr?.state !== "merged" ||
			!pr.mergedAt ||
			!pr.mergeCommitSha ||
			pr.author.toLowerCase() !== snapshot.account?.toLowerCase()
		)
			continue;
		const sha = pr.mergeCommitSha;
		const commit = details?.records.find(
			(record) =>
				record.kind === "commit" &&
				record.sha === sha &&
				record.url.startsWith(`${repository}/commit/`),
		);
		if (!commit) continue;
		const existing = commits.get(sha);
		commits.set(
			sha,
			existing ?? {
				id: `commit:${sha}`,
				kind: "commit",
				title: commit.title,
				date: commit.updatedAt,
				reference: sha,
				sha,
				url: commit.url,
				discussionUrl: entry.url,
				discussionLabel: `PR #${entry.number}`,
			},
		);
	}
	const collaboration: SourceRecord[] = snapshot.items
		.filter((entry) => `https://github.com/${entry.repository}` === repository)
		.map((entry): SourceRecord => {
			const detail = byUrl.get(entry.url);
			const state =
				detail && ["open", "draft", "merged", "closed"].includes(detail.state)
					? (detail.state as SourceRecord["state"])
					: entry.state;
			return {
				id: `${entry.kind}:${entry.number}`,
				kind: entry.kind === "pr" ? "pr" : "issue",
				title: detail?.title ?? entry.title,
				date: detail?.updatedAt ?? entry.updatedAt,
				reference: `${entry.kind === "pr" ? "PR" : "Issue"} #${entry.number}`,
				number: entry.number,
				url: entry.url,
				draft: entry.draft,
				state,
				relations: entry.relations,
			};
		});
	return [...commits.values(), ...collaboration].sort(
		compareContributionRecords,
	);
}

export function sortContributionProjects(
	projects: readonly ContributionProject[],
	snapshot: ContributionActivitySnapshot,
	details?: RecordIndex,
) {
	return projects
		.map((project) => ({
			project,
			latest: recordTimestamp(
				projectRecords(project, snapshot, details)[0]?.date,
			),
		}))
		.sort(
			(a, b) => b.latest - a.latest || a.project.id.localeCompare(b.project.id),
		)
		.map(({ project }) => project);
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
