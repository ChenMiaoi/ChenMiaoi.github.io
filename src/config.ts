import I18nKey from "./i18n/i18nKey";
import type {
	ContributionConfig,
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "Nay's Blog",
	subtitle: "Let me drive your world!",
	lang: "zh_CN", // Language code, e.g. 'en', 'zh_CN', 'ja', etc.
	themeColor: {
		hue: 250, // Default hue for the theme color, from 0 to 360. e.g. red: 0, teal: 200, cyan: 250, pink: 345
		fixed: false, // Hide the theme color picker for visitors
	},
	banner: {
		enable: false,
		src: "assets/images/demo-banner.png", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
		position: "center", // Equivalent to object-position, only supports 'top', 'center', 'bottom'. 'center' by default
		credit: {
			enable: false, // Display the credit text of the banner image
			text: "", // Credit text to be displayed
			url: "", // (Optional) URL link to the original artwork or artist's page
		},
	},
	toc: {
		enable: true, // Display the table of contents on the right side of the post
		depth: 2, // Maximum heading depth to show in the table, from 1 to 3
	},
	comment: {
		enable: true, // Waline comments + reactions on post pages
		serverURL: "https://api.nyachen.cn",
	},
	favicon: [
		// Leave this array empty to use the default favicon
		// {
		//   src: '/favicon/icon.png',    // Path of the favicon, relative to the /public directory
		//   theme: 'light',              // (Optional) Either 'light' or 'dark', set only if you have different favicons for light and dark mode
		//   sizes: '32x32',              // (Optional) Size of the favicon, set only if you have favicons of different sizes
		// }
	],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		{
			name: "Series",
			url: "/series/",
			i18nKey: I18nKey.series,
		},
		{
			name: "Graph",
			url: "/graph/",
			i18nKey: I18nKey.graph,
		},
		{
			name: "Contribution",
			url: "/contribution/",
			i18nKey: I18nKey.contribution,
		},
		LinkPreset.About,
		{
			name: "GitHub",
			url: "https://github.com/ChenMiaoi", // Internal links should not include the base path, as it is automatically added
			icon: "fa6-brands:github",
			external: true, // Show an external link icon and will open in a new tab
		},
	],
};

// Add projects and contribution entries here. The Contribution page only
// renders this data, so new projects do not require any page or component changes.
export const contributionConfig: ContributionConfig = {
	projects: [
		{
			id: "linux",
			name: "Linux",
			icon: "fa6-brands:linux",
			repository: "https://github.com/torvalds/linux",
			items: [
				{
					sha: "a44bfed9df8",
					date: "2026-01-23",
					title: "kbuild: rust: clean libpin_init_internal in mrproper",
					mailingListLabel: "PATCH v2",
					mailingListUrl:
						"https://lore.kernel.org/rust-for-linux/71ff222b8731e63e06059c5d8566434e508baf2b.1761876365.git.chenmiao@openatom.club/",
				},
				{
					sha: "4735037b5d9",
					date: "2025-09-11",
					title: "openrisc: Add text patching API support",
					mailingListLabel: "PATCH v5 1/4",
					mailingListUrl:
						"https://lore.kernel.org/openrisc/20250905181258.9430-2-chenmiao.ku@gmail.com/",
				},
				{
					sha: "9d0cb6d00be",
					date: "2025-09-11",
					title: "openrisc: Add R_OR1K_32_PCREL relocation type module support",
					mailingListLabel: "PATCH v5 2/4",
					mailingListUrl:
						"https://lore.kernel.org/openrisc/20250905181258.9430-3-chenmiao.ku@gmail.com/",
				},
				{
					sha: "09a27fc32e3",
					date: "2025-09-11",
					title: "openrisc: Regenerate defconfigs.",
					mailingListLabel: "PATCH v5 3/4",
					mailingListUrl:
						"https://lore.kernel.org/openrisc/20250905181258.9430-4-chenmiao.ku@gmail.com/",
				},
				{
					sha: "8c30b0018f9",
					date: "2025-09-11",
					title: "openrisc: Add jump label support",
					mailingListLabel: "PATCH v5 4/4",
					mailingListUrl:
						"https://lore.kernel.org/openrisc/20250905181258.9430-5-chenmiao.ku@gmail.com/",
				},
			],
		},
		{
			id: "llvm-project",
			name: "llvm-project",
			icon: "material-symbols:code-rounded",
			repository: "https://github.com/llvm/llvm-project",
			reviewType: "pull-request",
			items: [],
		},
		{
			id: "cargo",
			name: "Cargo",
			icon: "fa6-brands:rust",
			repository: "https://github.com/rust-lang/cargo",
			reviewType: "pull-request",
			items: [],
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "/avatar.jpg", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
	name: "Chen Miao",
	bio: "A programmer fascinated by operating systems and low-level architecture.",
	links: [
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/ChenMiaoi",
		},
		{
			name: "Zhihu",
			icon: "fa6-brands:zhihu",
			url: "https://www.zhihu.com/people/Pigeon/posts",
		},
		{
			name: "Email",
			icon: "fa6-solid:envelope",
			url: "mailto:chenmiao.ku@gmail.com",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// Note: Some styles (such as background color) are being overridden, see the astro.config.mjs file.
	// Please select a dark theme, as this blog theme currently only supports dark background color
	theme: "github-dark",
};
