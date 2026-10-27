import type { ContributionDetail, ContributionDetailsSnapshot } from "./types";

type SummaryRecord = Pick<
	ContributionDetail,
	| "url"
	| "kind"
	| "title"
	| "author"
	| "updatedAt"
	| "state"
	| "sha"
	| "mergeCommitSha"
	| "mergedAt"
	| "commentsTotal"
	| "references"
>;

// Seed counts and record ordering without embedding descriptions, patches or discussions.
export function contributionSummary(snapshot: {
	syncedAt: string;
	records: readonly SummaryRecord[];
}): ContributionDetailsSnapshot {
	return {
		syncedAt: snapshot.syncedAt,
		records: snapshot.records.map(
			({
				url,
				kind,
				title,
				author,
				updatedAt,
				state,
				sha,
				mergeCommitSha,
				mergedAt,
				commentsTotal,
				references,
			}) => ({
				url,
				kind,
				title,
				author,
				updatedAt,
				state,
				sha,
				mergeCommitSha,
				mergedAt,
				commentsTotal,
				references,
				bodyHtml: "",
				trailers: "",
				files: [],
				filesComplete: false,
				stats: null,
				comments: [],
			}),
		),
	};
}
