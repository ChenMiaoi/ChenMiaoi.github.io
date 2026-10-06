import {
	htmlLang,
	LOCALE_PREFIX,
	stripLocalePrefix,
	type Locale,
} from "../../../constants/locales.ts";
import { messages } from "./messages.ts";

export type Message = keyof typeof messages;
export type Translator = (
	message: Message,
	values?: Record<string, string | number>,
) => string;

export function createTranslations(locale: Locale) {
	const index = { en: 0, zh_TW: 1, ja: 2 } as const;
	const singularMessages: Partial<Record<Message, string>> = {
		"{v0} 篇文章": "{v0} article",
		"共 {v0} 篇文章": "{v0} article in total",
		"{v0} 篇笔记": "{v0} note",
		"{v0} 条路径": "{v0} path",
		"{v0} 个系列节点": "{v0} series node",
		"{v0} 个项目": "{v0} PROJECT",
		"{v0} 条记录": "{v0} RECORD",
		"{v0} 份文档": "{v0} DOCUMENT",
		"{v0} 条 · 最新在前": "{v0} comment · newest first",
	};
	const t: Translator = (message, values = {}) => {
		const singular =
			locale === "en" && Number(values.v0) === 1
				? singularMessages[message]
				: undefined;
		const text =
			singular ??
			(locale === "zh_CN" ? message : messages[message][index[locale]]);
		return text.replace(/\{(\w+)\}/g, (placeholder, key) =>
			String(values[key] ?? placeholder),
		);
	};
	return { locale, dateLocale: htmlLang(locale), t };
}

// Keep the complete public location, including search filters and reader headings.
export function languageUrl(location: string, locale: Locale, heading?: string) {
	const url = new URL(location, "https://orbital.local");
	if (heading !== undefined) url.hash = heading;
	const { path } = stripLocalePrefix(url.pathname);
	return `${LOCALE_PREFIX[locale]}${path}${url.search}${url.hash}`;
}
