export type ContributionItem = {
	sha: string;
	date: string;
	title: string;
	patch?: string;
} & (
	| { mailingListLabel: string; mailingListUrl: string; pullRequest?: never }
	| {
			pullRequest: { number: number; url: string };
			mailingListLabel?: never;
			mailingListUrl?: never;
	  }
);

export type ContributionProject = {
	id: string;
	name: string;
	icon: string;
	repository?: string;
	reviewType?: "mailing-list" | "pull-request";
	items: ContributionItem[];
};

export type ContributionConfig = {
	projects: ContributionProject[];
};

export type ProfileConfig = {
	avatar?: string;
	name: string;
	bio?: string;
	links: {
		name: string;
		url: string;
		icon: string;
	}[];
};

export type LicenseConfig = {
	enable: boolean;
	name: string;
	url: string;
};

export type ExpressiveCodeConfig = {
	theme: string;
};
