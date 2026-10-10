// Token-authenticated searches must separate issues and pull requests.
export function activitySearches(repository: string, account: string) {
	return (["author", "assignee", "commenter", "reviewer"] as const).flatMap(
		(relation) =>
			(relation === "reviewer" ? ["pr"] : ["issue", "pr"]).map((kind) => ({
				relation,
				query: `repo:${repository} is:open is:${kind} ${relation === "reviewer" ? "reviewed-by" : relation}:${account}`,
			})),
	);
}
