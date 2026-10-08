import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	ProfileConfig,
} from "./types/config";

export const siteConfig = {
	title: "Miao's Blog",
	subtitle: "Let me drive your world!",
	lang: "zh_CN",
};

// Shared by Orbital and the synchronization scripts.
export { contributionConfig } from "./lib/contributions/config";

export const profileConfig: ProfileConfig = {
	avatar: "/images/orbital/author-avatar-210.webp",
	avatarSrcSet:
		"/images/orbital/author-avatar-210.webp 210w, /images/orbital/author-avatar-420.webp 420w",
	name: "Chen Miao",
	bio: "A programmer fascinated by operating systems and low-level architecture.",
	bioTranslations: {
		zh_CN: "专注于操作系统与底层架构的程序员。",
		zh_TW: "專注於作業系統與底層架構的程式設計師。",
		ja: "OS と低レベルアーキテクチャに関心を持つプログラマーです。",
	},
	affiliations: [
		{
			institution: "The Hong Kong Polytechnic University",
			institutionTranslations: {
				zh_CN: "香港理工大学",
				zh_TW: "香港理工大學",
				ja: "香港理工大学",
			},
			role: "Research Assistant",
			department: "COMP",
			start: "2026-01",
		},
	],
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
