import Key from "../i18nKey";
import type { Translation } from "../translation";

export const zh_CN: Translation = {
	[Key.home]: "主页",
	[Key.about]: "关于",
	[Key.archive]: "归档",
	[Key.search]: "搜索",

	[Key.tags]: "标签",
	[Key.categories]: "分类",
	[Key.recentPosts]: "最新文章",

	[Key.comments]: "评论",

	[Key.series]: "专栏",
	[Key.graph]: "图谱",
	[Key.contribution]: "贡献",
	[Key.openSource]: "开源",
	[Key.contributionDescription]:
		"每条记录展示 commit、时间、主线标题和 mailing list URL。点击记录后，可以在页面内查看对应的 patch。",
	[Key.openSourceProjects]: "开源项目",
	[Key.contributionCommit]: "Commit",
	[Key.contributionDate]: "时间",
	[Key.contributionTitle]: "主线标题",
	[Key.contributionMailingList]: "Mailing list URL",
	[Key.contributionMailingListLabel]: "[{label} 邮件]",
	[Key.contributionViewPatch]: "查看 patch",
	[Key.contributionNoCommit]: "还没有添加 {project} commit。",
	[Key.contributionNoPatch]: "还没有添加 patch 内容。",
	[Key.contributionNoProjects]: "还没有添加开源项目。",
	[Key.partOf]: "第 {index} 篇（共 {total} 篇）",
	[Key.subSeriesCount]: "子专栏",
	[Key.subSeriesCountPlural]: "子专栏",

	[Key.views]: "阅读",
	[Key.likes]: "点赞",

	[Key.untitled]: "无标题",
	[Key.uncategorized]: "未分类",
	[Key.noTags]: "无标签",

	[Key.wordCount]: "字",
	[Key.wordsCount]: "字",
	[Key.minuteCount]: "分钟",
	[Key.minutesCount]: "分钟",
	[Key.postCount]: "篇文章",
	[Key.postsCount]: "篇文章",

	[Key.themeColor]: "主题色",

	[Key.lightMode]: "亮色",
	[Key.darkMode]: "暗色",
	[Key.systemMode]: "跟随系统",

	[Key.more]: "更多",

	[Key.author]: "作者",
	[Key.publishedAt]: "发布于",
	[Key.license]: "许可协议",
};
