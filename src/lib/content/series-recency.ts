type SeriesDirectory = {
	slug: string;
	order?: number;
	posts: readonly string[];
};

type DatedPost = {
	slug: string;
	timestamp: number;
	updatedTimestamp?: number;
};

export function sortSeriesByRecency<T extends SeriesDirectory>(
	series: readonly T[],
	posts: readonly DatedPost[],
): T[] {
	const dates = new Map(
		posts.map((post) => [
			post.slug,
			Math.max(post.timestamp, post.updatedTimestamp ?? post.timestamp),
		]),
	);
	return series
		.map((item) => ({
			item,
			latest: item.posts.reduce(
				(latest, slug) =>
					Math.max(latest, dates.get(slug) ?? Number.NEGATIVE_INFINITY),
				Number.NEGATIVE_INFINITY,
			),
		}))
		.sort(
			(a, b) =>
				b.latest - a.latest ||
				(a.item.order ?? Number.POSITIVE_INFINITY) -
					(b.item.order ?? Number.POSITIVE_INFINITY) ||
				a.item.slug.localeCompare(b.item.slug),
		)
		.map(({ item }) => item);
}
