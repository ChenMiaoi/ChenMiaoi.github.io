import { getRawSortedPosts } from "../utils/content-utils";
import { getPostUrlBySlug } from "../utils/url-utils";

// Machine-readable public content uses the same validated collection, locale
// selection and permalinks as the pages. Drafts never leave this boundary.
export async function GET() {
	const documents = await Promise.all(
		(["zh_CN", "en"] as const).map(async (locale) =>
			(await getRawSortedPosts(locale))
				.filter((post) => !post.data.draft)
				.map((post) => ({
					id: post.id,
					locale,
					title: post.data.title,
					url: getPostUrlBySlug(post.slug, post.data.published, locale),
					body: post.body ?? "",
				})),
		),
	);
	return Response.json({ version: 1, documents: documents.flat() });
}
