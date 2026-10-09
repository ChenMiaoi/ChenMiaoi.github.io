import type { ContributionDetail } from "./types";

type LinkRecord = Pick<
	ContributionDetail,
	"url" | "kind" | "title" | "references"
>;

// References describe mentions, not proof that a PR implements or closes an issue.
export function linkedContributions(
	record: LinkRecord | undefined,
	records: LinkRecord[],
) {
	if (!record || !["pr", "issue"].includes(record.kind)) return [];
	const kind = record.kind === "pr" ? "issue" : "pr";
	const links = new Map<
		string,
		ContributionDetail["references"][number] & { incoming: boolean }
	>();
	for (const reference of record.references) {
		if (reference.kind === kind && reference.url !== record.url)
			links.set(reference.url, { ...reference, incoming: false });
	}
	for (const candidate of records) {
		if (candidate.kind !== kind || links.has(candidate.url)) continue;
		const reference = candidate.references.find(
			(link) => link.url === record.url,
		);
		const match =
			/^https:\/\/github\.com\/[^/]+\/[^/]+\/(?:pull|issues)\/([1-9]\d*)$/.exec(
				candidate.url,
			);
		if (reference && match)
			links.set(candidate.url, {
				url: candidate.url,
				number: Number(match[1]),
				title: candidate.title,
				kind,
				relation: reference.relation,
				incoming: true,
			});
	}
	return [...links.values()];
}
