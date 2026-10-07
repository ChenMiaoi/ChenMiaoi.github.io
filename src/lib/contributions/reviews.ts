import type { ContributionDetail } from "./types";

type Review = {
	id: number;
	state: string;
	submitted_at?: string | null;
	user?: { login?: string } | null;
};

// Comments and unsubmitted drafts do not revoke an existing review decision.
// A dismissed decision does, and each reviewer contributes at most one vote.
export function summarizeReviews(reviews: Review[]) {
	const latest = new Map<string, { author: string; state: string }>();
	for (const review of [...reviews].sort(
		(a, b) =>
			(Date.parse(a.submitted_at ?? "") || 0) -
				(Date.parse(b.submitted_at ?? "") || 0) || a.id - b.id,
	)) {
		const author = review.user?.login;
		if (!author || !review.submitted_at || review.state === "PENDING") continue;
		const key = author.toLowerCase();
		if (review.state === "COMMENTED" && latest.has(key)) continue;
		latest.set(key, { author, state: review.state });
	}
	const authors = (state: string) =>
		[...latest.values()]
			.filter((review) => review.state === state)
			.map((review) => review.author)
			.sort((a, b) => a.localeCompare(b));
	return {
		approved: authors("APPROVED"),
		changesRequested: authors("CHANGES_REQUESTED"),
		commented: authors("COMMENTED"),
	};
}
export function resolveReviewSummary(
	detail?: Pick<
		ContributionDetail,
		"pullRequest" | "detailVersion" | "comments"
	>,
) {
	if (detail?.pullRequest?.reviewSummary)
		return detail.pullRequest.reviewSummary;
	// Version 3 retained all submitted approval, change-request and dismissal records.
	// Older/incomplete feeds cannot safely imply that no reviewer has approved a PR.
	if (!detail || (detail.detailVersion ?? 0) < 3) return undefined;
	return summarizeReviews(
		detail.comments
			.filter((comment) => comment.kind === "review")
			.map((comment) => ({
				id: Number(/#pullrequestreview-(\d+)$/.exec(comment.url)?.[1] ?? 0),
				state: comment.reviewState ?? "COMMENTED",
				submitted_at: comment.createdAt,
				user: { login: comment.author },
			})),
	);
}
