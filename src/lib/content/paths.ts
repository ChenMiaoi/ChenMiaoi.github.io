// UTC preserves date-only frontmatter across build-machine time zones.
export function postPath(slug: string, published: Date): string {
	const date = new Date(published);
	if (Number.isNaN(date.getTime())) throw new Error(`Invalid date for ${slug}`);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `/${date.getUTCFullYear()}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${slug}/`;
}
