import I18nKey from "./i18n/i18nKey";
import type {
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
		hue: 125, // Observatory accent: chartreuse.
		fixed: true, // Keep the visual identity consistent across the site.
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
	stats: {
		enable: true, // Article views and existing reaction counts
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

// Shared with both page shells and the synchronization scripts.
export { contributionConfig } from "./lib/contributions/config";

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
