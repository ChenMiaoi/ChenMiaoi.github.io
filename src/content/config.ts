import { defineCollection, z } from "astro:content";

const postsCollection = defineCollection({
	schema: z.object({
		title: z.string(),
		published: z.date(),
		updated: z.date().optional(),
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		category: z.string().optional().nullable().default(""),
		lang: z.string().optional().default(""),
		series: z.string().optional(),
		seriesOrder: z.number().optional(),

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		prevPublished: z.date().optional(),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
		nextPublished: z.date().optional(),
	}),
});
const specCollection = defineCollection({
	schema: z.object({}),
});
const seriesCollection = defineCollection({
	schema: z.object({
		title: z.string(),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		// Nesting: slug of the parent series. Depth is capped at
		// SERIES_MAX_DEPTH (see content-utils); violations fail the build.
		parent: z.string().optional(),
		// Position among the parent's items (sub-series and direct posts
		// share one sequence; posts use their own `seriesOrder`).
		order: z.number().optional(),
	}),
});
export const collections = {
	posts: postsCollection,
	spec: specCollection,
	series: seriesCollection,
};
