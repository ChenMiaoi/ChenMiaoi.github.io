import type { ExpressiveCodeConfig, LicenseConfig, ProfileConfig } from "./types/config";

export const siteConfig = {
    title: "Miao's Blog",
    subtitle: "Let me drive your world!",
    lang: "zh_CN",
};

// Shared by Orbital and the synchronization scripts.
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
