import type { PullRequestStatus } from "./types";

export function checkState(check: PullRequestStatus["checks"][number]) {
	if (check.status !== "completed") return "pending";
	if (check.conclusion === "success") return "passed";
	if (
		[
			"failure",
			"error",
			"timed_out",
			"cancelled",
			"action_required",
			"startup_failure",
			"stale",
		].includes(check.conclusion ?? "")
	)
		return "failed";
	return "neutral";
}

export function summarizeChecks(checks: PullRequestStatus["checks"]) {
	const counts = { passed: 0, failed: 0, pending: 0, neutral: 0 };
	for (const check of checks) counts[checkState(check)]++;
	return {
		...counts,
		total: checks.length,
		state: !checks.length
			? "none"
			: counts.failed
				? "failed"
				: counts.pending
					? "pending"
					: counts.neutral
						? "neutral"
						: "passed",
	};
}
