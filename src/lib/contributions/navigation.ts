const kinds = ["pr", "issue", "commit"] as const;

export function contributionUrl(
	project: string,
	record = "",
	kind = "all",
	prefix = "",
) {
	const params = new URLSearchParams();
	if (record) {
		const [type, value] = record.split(":");
		if (kinds.includes(type as (typeof kinds)[number]) && value)
			params.set(type, value);
	}
	if (kind !== "all" && kinds.includes(kind as (typeof kinds)[number]))
		params.set("kind", kind);
	return `${prefix}/contribution/${encodeURIComponent(project)}/${params.size ? `?${params}` : ""}`;
}

export function resolveContributionSelection(search: string) {
	const params = new URLSearchParams(search);
	const requested = kinds.filter((kind) => params.has(kind));
	let record = "";
	if (requested.length) {
		const type = requested[0];
		const value = params.get(type) ?? "";
		const valid =
			type === "commit"
				? /^[a-f0-9]{7,40}$/.test(value)
				: /^[1-9]\d*$/.test(value);
		record =
			requested.length === 1 && params.getAll(type).length === 1 && valid
				? `${type}:${value}`
				: "invalid";
	}
	const filter = params.get("kind") ?? "all";
	const kind =
		kinds.includes(filter as (typeof kinds)[number]) &&
		(!record || record.startsWith(`${filter}:`))
			? filter
			: "all";
	return { record, kind };
}
