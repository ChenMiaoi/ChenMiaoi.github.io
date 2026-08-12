import Key from "../i18nKey";
import type { Translation } from "../translation";

export const ja: Translation = {
	[Key.home]: "Home",
	[Key.about]: "About",
	[Key.archive]: "Archive",
	[Key.search]: "検索",

	[Key.tags]: "タグ",
	[Key.categories]: "カテゴリ",
	[Key.recentPosts]: "最近の投稿",

	[Key.comments]: "コメント",

	[Key.series]: "シリーズ",
	[Key.graph]: "グラフ",
	[Key.contribution]: "コントリビューション",
	[Key.openSource]: "オープンソース",
	[Key.contributionDescription]:
		"各記録には commit、日付、メインラインのタイトル、メーリングリスト URL を表示します。記録を開くと、このページでパッチを確認できます。",
	[Key.openSourceProjects]: "オープンソースプロジェクト",
	[Key.contributionCommit]: "Commit",
	[Key.contributionDate]: "日付",
	[Key.contributionTitle]: "メインラインタイトル",
	[Key.contributionMailingList]: "メーリングリスト URL",
	[Key.contributionMailingListLabel]: "[{label} メール]",
	[Key.contributionViewPatch]: "パッチを表示",
	[Key.contributionNoCommit]: "{project} の commit はまだ追加されていません。",
	[Key.contributionNoPatch]: "パッチ内容はまだ追加されていません。",
	[Key.contributionNoProjects]:
		"オープンソースプロジェクトはまだ追加されていません。",
	[Key.partOf]: "第{index}回（全{total}回）",
	[Key.subSeriesCount]: "子シリーズ",
	[Key.subSeriesCountPlural]: "子シリーズ",

	[Key.views]: "閲覧",
	[Key.likes]: "いいね",

	[Key.untitled]: "タイトルなし",
	[Key.uncategorized]: "カテゴリなし",
	[Key.noTags]: "タグなし",

	[Key.wordCount]: "文字",
	[Key.wordsCount]: "文字",
	[Key.minuteCount]: "分",
	[Key.minutesCount]: "分",
	[Key.postCount]: "件の投稿",
	[Key.postsCount]: "件の投稿",

	[Key.themeColor]: "テーマカラー",

	[Key.lightMode]: "ライト",
	[Key.darkMode]: "ダーク",
	[Key.systemMode]: "システム",

	[Key.more]: "もっと",

	[Key.author]: "作者",
	[Key.publishedAt]: "公開日",
	[Key.license]: "ライセンス",
};
