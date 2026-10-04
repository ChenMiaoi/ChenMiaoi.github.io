import { z } from "astro/zod";
import data from "../../data/contribution-projects.json" with { type: "json" };
import type { ContributionConfig } from "../../types/config";

const discussion = z.union([
	z.object({ mailingListLabel: z.string(), mailingListUrl: z.url() }),
	z.object({
		pullRequest: z.object({
			number: z.number().int().positive(),
			url: z.url(),
		}),
	}),
]);
const schema = z.object({
	account: z.string().min(1),
	projects: z.array(
		z.object({
			id: z.string().min(1),
			name: z.string().min(1),
			icon: z.string().min(1),
			repository: z.string().regex(/^https:\/\/github\.com\/[^/]+\/[^/]+$/),
			reviewType: z.enum(["mailing-list", "pull-request"]).optional(),
			items: z.array(
				z
					.object({
						sha: z.string().regex(/^[0-9a-f]{7,40}$/),
						date: z.string(),
						title: z.string(),
						patch: z.string().optional(),
					})
					.and(discussion),
			),
		}),
	),
});
const parsed = schema.parse(data);
export const contributionConfig: ContributionConfig = {
	projects: parsed.projects,
};
export const contributionSyncConfig = {
	account: parsed.account,
	repositories: parsed.projects.map((project) =>
		project.repository.slice("https://github.com/".length),
	),
};
