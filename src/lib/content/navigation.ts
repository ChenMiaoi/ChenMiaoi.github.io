export type Section = "articles" | "series" | "graph" | "code" | "about";

export const sectionPaths: Record<Section, string> = {
	articles: "/articles/",
	series: "/series/",
	graph: "/graph/",
	code: "/contribution/",
	about: "/about/",
};

export function resolveOrbitalLocation(
	pathname: string,
	posts: { slug: string; url: string }[],
	prefix = "",
) {
	let path = pathname;
	try {
		path = decodeURI(pathname);
	} catch {
		/* Keep malformed paths harmless. */
	}
	const post = posts.find((item) => item.url === path);
	const localPath =
		prefix && path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : path;
	const contributionProject =
		/^\/contribution\/([^/]+)\/$/.exec(localPath)?.[1] ?? "";
	const section =
		(Object.keys(sectionPaths) as Section[]).find(
			(key) => sectionPaths[key] === localPath,
		) ?? "articles";
	const series = localPath.startsWith("/series/")
		? localPath.slice(8).replace(/\/$/, "")
		: "";
	return {
		section: contributionProject
			? ("code" as const)
			: series
				? ("articles" as const)
				: section,
		series,
		post,
		contributionProject,
	};
}

export function isWelcomeLocation(pathname: string, search = "", prefix = "") {
	const params = new URLSearchParams(search);
	return (
		(pathname === `${prefix}/` || (prefix !== "" && pathname === prefix)) &&
		!["q", "tag", "category"].some((key) => params.has(key))
	);
}
