// Public snapshot produced by sync-contribution-activity.mjs (open records only).
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
