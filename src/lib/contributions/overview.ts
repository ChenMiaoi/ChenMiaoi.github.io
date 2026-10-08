import type { ContributionProject } from "../../types/config";
import {
	compareContributionRecords,
	projectRecords,
	sortContributionProjects,
} from "./projects.ts";
import type {
	ContributionActivitySnapshot,
	ContributionDetailsSnapshot,
} from "./types";

export type ContributionKindFilter = "all" | "pr" | "issue" | "commit";
export type ContributionQueue = "active" | "archive";

export function contributionQueue<
	T extends { kind: Exclude<ContributionKindFilter, "all">; state: string },
>(
	records: T[],
	queue: ContributionQueue,
	kind: ContributionKindFilter = "all",
) {
	const selectedKind = queue === "active" && kind === "commit" ? "all" : kind;
	const queued = records.filter((record) =>
		queue === "active"
			? record.state === "open" || record.state === "draft"
			: ["merged", "closed", "commit"].includes(record.state),
	);
	const counts = {
		all: queued.length,
		pr: queued.filter((record) => record.kind === "pr").length,
		issue: queued.filter((record) => record.kind === "issue").length,
		commit: queued.filter((record) => record.kind === "commit").length,
	};
	const selected = queued.filter(
		(record) => selectedKind === "all" || record.kind === selectedKind,
	);
	return {
		kind: selectedKind,
		counts,
		states: {
			mergedPRs: selected.filter(
				(record) => record.kind === "pr" && record.state === "merged",
			).length,
			closedPRs: selected.filter(
				(record) => record.kind === "pr" && record.state === "closed",
			).length,
			closedIssues: selected.filter(
				(record) => record.kind === "issue" && record.state === "closed",
			).length,
			commits: selected.filter((record) => record.kind === "commit").length,
		},
		records: selected,
	};
}

export function contributionOverview(
	projects: ContributionProject[],
	activity: ContributionActivitySnapshot,
	details: ContributionDetailsSnapshot,
) {
	const byUrl = new Map(details.records.map((record) => [record.url, record]));
	const orderedProjects = sortContributionProjects(projects, activity, details);
	const sectors = orderedProjects.map((project) => {
		const unique = new Map(
			projectRecords(project, activity, details).map((record) => [
				record.url ?? record.id,
				record,
			]),
		);
		const records = [...unique.values()].map((record) => ({
			...record,
			state:
				record.kind === "commit"
					? "commit"
					: (byUrl.get(record.url ?? "")?.state ??
						record.state ??
						(record.draft ? "draft" : "unknown")),
			projectId: project.id,
			projectName: project.name,
		}));
		const issues = records.filter((record) => record.kind === "issue");
		const prs = records.filter((record) => record.kind === "pr");
		return {
			project,
			records,
			issues: issues.length,
			prs: prs.length,
			closedIssues: issues.filter((record) => record.state === "closed").length,
			mergedPRs: prs.filter((record) => record.state === "merged").length,
			closedPRs: prs.filter((record) => record.state === "closed").length,
			commits: records.filter((record) => record.kind === "commit").length,
			active: records.filter(
				(record) => record.state === "open" || record.state === "draft",
			).length,
			unknown: records.filter((record) => record.state === "unknown").length,
		};
	});
	return {
		sectors,
		records: sectors
			.flatMap((sector) => sector.records)
			.sort(compareContributionRecords),
	};
}
