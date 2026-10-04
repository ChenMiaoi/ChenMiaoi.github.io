// Build-time fallback or the last complete snapshot served by the VPS.
export type ContributionActivitySnapshot = {
	account: string;
	syncedAt: string;
	items: {
		repository: string;
		number: number;
		title: string;
		url: string;
		kind: string;
		draft: boolean;
		state?: "open" | "draft" | "merged" | "closed";
		updatedAt: string;
		relations: string[];
	}[];
};

export type SourceRecord = {
	id: string;
	kind: "commit" | "pr" | "issue";
	title: string;
	date: string;
	reference: string;
	sha?: string;
	number?: number;
	url?: string;
	draft?: boolean;
	state?: "open" | "draft" | "merged" | "closed";
	relations?: string[];
	discussionUrl?: string;
	discussionLabel?: string;
};

export type ContributionFile = {
	filename: string;
	previousFilename: string | null;
	status: string;
	additions: number;
	deletions: number;
	patch: string | null;
	url: string | null;
};

export type ContributionDetail = {
	detailVersion?: number;
	fetchedAt?: string;
	headSha?: string | null;
	baseSha?: string | null;
	commitsTotal?: number;
	commitsComplete?: boolean;
	commits?: {
		sha: string;
		url: string;
		title: string;
		author: string;
		date: string;
	}[];
	url: string;
	kind: string;
	title: string;
	author: string;
	updatedAt: string;
	state: string;
	sha: string | null;
	bodyHtml: string;
	trailers: string;
	files: ContributionFile[];
	stats: { files: number; additions: number; deletions: number } | null;
	filesComplete: boolean;
	comments: {
		author: string;
		url: string;
		bodyHtml: string;
		excerpt: string;
		createdAt: string;
		updatedAt?: string;
		kind?: "comment" | "review-comment" | "review";
		bot?: boolean;
		reviewState?: string | null;
		commitSha?: string | null;
		replyToUrl?: string | null;
		path: string | null;
	}[];
	commentsTotal: number;
	references: {
		url: string;
		number: number;
		title: string;
		kind: string;
		relation: string;
	}[];
};

export type ContributionDetailsSnapshot = {
	syncedAt: string;
	records: ContributionDetail[];
};

export type ContributionFeed = ContributionDetailsSnapshot & {
	version: 1;
	activity: ContributionActivitySnapshot;
};

export function contributionStateLabel(state?: string, draft = false) {
	return (
		(
			{
				open: "进行中",
				draft: "草稿",
				merged: "已合并",
				closed: "已关闭",
			} as Record<string, string>
		)[state ?? (draft ? "draft" : "open")] ?? ""
	);
}
