import { z } from "astro/zod";

const count = z.number().int().nonnegative();
const url = z.url();
const date = z.iso.datetime({ offset: true });
export const activitySchema = z.object({
	account: z.string(),
	repositories: z.array(z.string()),
	syncedAt: date,
	items: z.array(
		z.object({
			repository: z.string(),
			number: count,
			title: z.string(),
			url,
			kind: z.enum(["pr", "issue"]),
			draft: z.boolean(),
			state: z.enum(["open", "draft", "merged", "closed"]).optional(),
			updatedAt: date,
			relations: z.array(z.enum(["author", "assignee"])),
		}),
	),
});
export const detailsSchema = z.object({
	syncedAt: date,
	activitySyncedAt: date,
	records: z.array(
		z.object({
			url,
			kind: z.enum(["commit", "pr", "issue"]),
			title: z.string(),
			body: z.string(),
			author: z.string(),
			updatedAt: date,
			state: z.string(),
			sha: z.string().nullable(),
			filesComplete: z.boolean(),
			commentsTotal: count,
			stats: z
				.object({ files: count, additions: count, deletions: count })
				.nullable(),
			files: z.array(
				z.object({
					filename: z.string(),
					previousFilename: z.string().nullable(),
					status: z.string(),
					additions: count,
					deletions: count,
					patch: z.string().nullable(),
					url: url.nullable(),
				}),
			),
			comments: z.array(
				z.object({
					author: z.string(),
					url,
					body: z.string(),
					createdAt: date,
					path: z.string().nullable(),
				}),
			),
			references: z.array(
				z.object({
					url,
					number: count,
					title: z.string(),
					kind: z.string(),
					relation: z.string(),
				}),
			),
		}),
	),
});
