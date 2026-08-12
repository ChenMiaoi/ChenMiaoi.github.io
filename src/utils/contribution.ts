import type { ContributionItem, ContributionProject } from "../types/config";

const patchCache = new Map<string, Promise<string | undefined>>();

function getPatchUrl(project: ContributionProject, item: ContributionItem) {
	if (!project.repository) return undefined;

	return `${project.repository.replace(/\/$/, "")}/commit/${item.sha}.patch`;
}

function extractDiff(patch: string) {
	const diffStart = patch.indexOf("diff --git ");
	if (diffStart < 0) return undefined;

	return patch.slice(diffStart).trim();
}

async function fetchPatch(
	project: ContributionProject,
	item: ContributionItem,
) {
	const url = getPatchUrl(project, item);
	if (!url) return undefined;

	const cached = patchCache.get(url);
	if (cached) return cached;

	const request = fetch(url, {
		headers: {
			Accept: "text/plain",
			"User-Agent": "ChenMiaoi.github.io contribution preview",
		},
	})
		.then(async (response) => {
			if (!response.ok) return undefined;

			const patch = await response.text();
			return extractDiff(patch.replace(/\r\n/g, "\n"));
		})
		.catch(() => undefined);

	patchCache.set(url, request);
	return request;
}

export async function resolveContributionProjects(
	projects: ContributionProject[],
) {
	return Promise.all(
		projects.map(async (project) => ({
			...project,
			items: await Promise.all(
				project.items.map(async (item) => ({
					...item,
					patch: item.patch ?? (await fetchPatch(project, item)),
				})),
			),
		})),
	);
}
