import type { ProfileConfig } from "../../types/config";

export function profileExperiences(
	entries: ProfileConfig["affiliations"] = [],
) {
	const all = [...entries].sort(
		(a, b) => Number(!b.end) - Number(!a.end) || b.start.localeCompare(a.start),
	);
	return { all, visible: all.slice(0, 2), hasMore: all.length > 2 };
}
