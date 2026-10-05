// Token-authenticated searches must separate issues and pull requests.
export function activitySearches(repository: string, account: string) {
	return (["author", "assignee", "commenter"] as const).flatMap((relation) =>
		(relation === "commenter" ? ["issue"] : ["issue", "pr"]).map((kind) => ({
			relation,
			query: `repo:${repository} is:open is:${kind} ${relation}:${account}`,
		})),
	);
}
