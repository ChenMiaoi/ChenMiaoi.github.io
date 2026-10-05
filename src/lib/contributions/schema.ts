import { z } from "astro/zod";

const count = z.number().int().nonnegative();
const url = z.url();
const date = z.iso.datetime({ offset: true });
export const pullRequestStatusSchema = z.object({
	fetchedAt: date,
	headSha: z.string(),
	headRef: z.string(),
	baseRef: z.string(),
	mergeable: z.boolean().nullable(),
	mergeState: z.string(),
	labels: z.array(z.string()),
	requestedReviewers: z.array(z.string()),
	checks: z.array(
		z.object({
			name: z.string(),
			source: z.enum(["check", "status"]),
			ref: z.enum(["head", "merge"]),
			sha: z.string(),
			status: z.string(),
			conclusion: z.string().nullable(),
			url: url
				.refine((value) =>
					["https:", "http:"].includes(new URL(value).protocol),
				)
				.nullable(),
			description: z.string(),
		}),
	),
});

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
			detailVersion: z.number().int().optional(),
			fetchedAt: date.optional(),
			pullRequest: pullRequestStatusSchema.optional(),
			headSha: z.string().nullable().optional(),
			baseSha: z.string().nullable().optional(),
			commitsTotal: count.optional(),
			commitsComplete: z.boolean().optional(),
			commits: z
				.array(
					z.object({
						sha: z.string(),
						url,
						title: z.string(),
						author: z.string(),
						date,
					}),
				)
				.optional(),
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
					updatedAt: date.optional(),
					kind: z.enum(["comment", "review-comment", "review"]).optional(),
					bot: z.boolean().optional(),
					reviewState: z.string().nullable().optional(),
					commitSha: z.string().nullable().optional(),
					replyToUrl: url.nullable().optional(),
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
