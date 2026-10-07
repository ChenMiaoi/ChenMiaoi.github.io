export type ContributionTone =
	| "positive"
	| "complete"
	| "attention"
	| "negative"
	| "muted"
	| "recorded";

export type ContributionSymbol =
	| "pr"
	| "pr-merged"
	| "pr-closed"
	| "pr-draft"
	| "issue"
	| "issue-closed"
	| "commit"
	| "check"
	| "cross"
	| "clock"
	| "warning"
	| "minus"
	| "discussion"
	| "info";

type Presentation = { tone: ContributionTone; icon: ContributionSymbol };

export function recordPresentation(
	kind: string,
	state?: string,
	draft = false,
): Presentation {
	if (kind === "commit") return { tone: "recorded", icon: "commit" };
	const current = state ?? (draft ? "draft" : "open");
	if (current === "merged") return { tone: "complete", icon: "pr-merged" };
	if (current === "closed") {
		return kind === "pr"
			? { tone: "negative", icon: "pr-closed" }
			: { tone: "complete", icon: "issue-closed" };
	}
	if (current === "draft") return { tone: "muted", icon: "pr-draft" };
	return {
		tone: current === "open" ? "positive" : "muted",
		icon: kind === "pr" ? "pr" : "issue",
	};
}

export function checkPresentation(state: string): Presentation {
	switch (state) {
		case "passed":
			return { tone: "positive", icon: "check" };
		case "failed":
			return { tone: "negative", icon: "cross" };
		case "pending":
			return { tone: "attention", icon: "clock" };
		case "neutral":
			return { tone: "muted", icon: "minus" };
		default:
			return { tone: "muted", icon: "info" };
	}
}

export function reviewPresentation(state?: string | null): Presentation {
	switch (state) {
		case "APPROVED":
			return { tone: "positive", icon: "check" };
		case "CHANGES_REQUESTED":
			return { tone: "negative", icon: "warning" };
		case "DISMISSED":
			return { tone: "muted", icon: "minus" };
		default:
			return { tone: "muted", icon: "discussion" };
	}
}

export function conflictPresentation(state: string): Presentation {
	switch (state) {
		case "clear":
			return { tone: "positive", icon: "check" };
		case "conflict":
			return { tone: "negative", icon: "warning" };
		case "pending":
			return { tone: "attention", icon: "clock" };
		case "not-applicable":
			return { tone: "muted", icon: "minus" };
		default:
			return { tone: "muted", icon: "info" };
	}
}
