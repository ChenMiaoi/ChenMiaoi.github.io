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

export function contributionOverview(
	projects: ContributionProject[],
	activity: ContributionActivitySnapshot,
	details: ContributionDetailsSnapshot,
) {
	const byUrl = new Map(details.records.map((record) => [record.url, record]));
	const orderedProjects = sortContributionProjects(projects, activity);
	const sectors = orderedProjects.map((project) => {
		const unique = new Map(
			projectRecords(project, activity).map((record) => [
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
