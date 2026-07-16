// Locale trees: zh_CN is the default and lives at the root (no prefix).
// zh_TW and ja reuse the Chinese content; only en has its own translated
// content (posts/*.en.md).
export type Locale = "zh_CN" | "en" | "zh_TW" | "ja";

export const LOCALES: Locale[] = ["zh_CN", "en", "zh_TW", "ja"];

export const DEFAULT_LOCALE: Locale = "zh_CN";

export const LOCALE_PREFIX: Record<Locale, string> = {
	zh_CN: "",
	en: "/en",
	zh_TW: "/zh_TW",
	ja: "/ja",
};

// Which content variant each locale tree renders.
export const CONTENT_LOCALE: Record<Locale, "zh" | "en"> = {
	zh_CN: "zh",
	zh_TW: "zh",
	ja: "zh",
	en: "en",
};

// Native display names, used by the language switcher (never translated).
export const LOCALE_NAMES: Record<Locale, string> = {
	zh_CN: "简体中文",
	en: "English",
	zh_TW: "繁體中文",
	ja: "日本語",
};

// Value for the <html lang> attribute / hreflang tags.
export function htmlLang(locale: string): string {
	const map: Record<string, string> = {
		zh_CN: "zh-CN",
		zh_TW: "zh-TW",
		en: "en",
		ja: "ja",
	};
	return map[locale] ?? "en";
}

// Split a pathname into its locale tree and the path inside that tree.
// Paths without a locale prefix belong to the default (root) tree.
export function stripLocalePrefix(pathname: string): {
	locale: Locale;
	path: string;
} {
	for (const locale of LOCALES) {
		const prefix = LOCALE_PREFIX[locale];
		if (prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`))) {
			return { locale, path: pathname.slice(prefix.length) || "/" };
		}
	}
	return { locale: DEFAULT_LOCALE, path: pathname };
}
