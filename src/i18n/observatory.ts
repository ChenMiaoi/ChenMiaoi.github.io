import type { Locale } from "@constants/locales";

const copy = {
	zh_CN: {
		intro: "在系统深处，探索未知。",
		description:
			"关于操作系统、内核与底层工程的思考与实践。记录每一次深入，也连接每一个新的可能。",
		explore: "开始探索",
		map: "知识星图",
		latest: "最新记录",
		all: "全部文章",
		articles: "篇文章",
		collections: "个专栏",
		paths: "探索路径",
		pathsDescription: "沿着一条线索，走得更深。",
		read: "阅读记录",
		skip: "跳至内容",
		empty: "暂时没有可显示的文章。",
		chinese: "浏览中文文章",
	},
	en: {
		intro: "Exploring systems, from the inside out.",
		description:
			"Notes on operating systems, kernels, and low-level engineering. A personal record of going deeper and connecting ideas.",
		explore: "Explore the archive",
		map: "Knowledge map",
		latest: "Latest notes",
		all: "All articles",
		articles: "articles",
		collections: "collections",
		paths: "Lines of inquiry",
		pathsDescription: "Follow an idea. Go a little deeper.",
		read: "Read the note",
		skip: "Skip to content",
		empty: "No articles to show here yet.",
		chinese: "Explore the Chinese articles",
	},
	zh_TW: {
		intro: "在系統深處，探索未知。",
		description:
			"關於作業系統、核心與底層工程的思考與實踐。記錄每一次深入，也連接每一個新的可能。",
		explore: "開始探索",
		map: "知識星圖",
		latest: "最新記錄",
		all: "全部文章",
		articles: "篇文章",
		collections: "個專欄",
		paths: "探索路徑",
		pathsDescription: "沿著一條線索，走得更深。",
		read: "閱讀記錄",
		skip: "跳至內容",
		empty: "暫時沒有可顯示的文章。",
		chinese: "瀏覽中文文章",
	},
	ja: {
		intro: "システムの奥深く、未知を探る。",
		description:
			"OS、カーネル、低レイヤーのエンジニアリングについて。深く掘り下げ、アイデアをつなぐ個人の記録。",
		explore: "記録を探索",
		map: "知識マップ",
		latest: "最新の記録",
		all: "すべての記事",
		articles: "記事",
		collections: "シリーズ",
		paths: "探究の道筋",
		pathsDescription: "ひとつのアイデアを、さらに深く。",
		read: "記事を読む",
		skip: "本文へ移動",
		empty: "表示できる記事はまだありません。",
		chinese: "中国語の記事を読む",
	},
} satisfies Record<Locale, Record<string, string>>;

export function observatoryCopy(lang = "zh_CN") {
	return copy[lang as Locale] ?? copy.en;
}
