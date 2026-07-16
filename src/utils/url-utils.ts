import { DEFAULT_LOCALE, LOCALE_PREFIX, type Locale } from "@constants/locales";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { stripLocalePrefix } from "@constants/locales";

export function pathsEqual(path1: string, path2: string) {
	const normalizedPath1 = path1.replace(/^\/|\/$/g, "").toLowerCase();
	const normalizedPath2 = path2.replace(/^\/|\/$/g, "").toLowerCase();
	return normalizedPath1 === normalizedPath2;
}

// True for any locale tree's home page (/, /en/, /zh_TW/, /ja/).
export function isHomePath(pathname: string): boolean {
	return stripLocalePrefix(pathname).path === "/";
}

function joinUrl(...parts: string[]): string {
	const joined = parts.join("/");
	return joined.replace(/\/+/g, "/");
}

const pad = (n: number) => String(n).padStart(2, "0");

// Permalink: /:year/:month/:day/:slug/ — kept identical to the old Hexo URLs.
// `published` is a date-only value parsed as UTC midnight, so UTC getters
// return the intended calendar date regardless of build-machine timezone.
export function getPostUrlBySlug(
	slug: string,
	published: Date,
	lang?: string,
): string {
	const d = new Date(published);
	const y = d.getUTCFullYear();
	const m = pad(d.getUTCMonth() + 1);
	const day = pad(d.getUTCDate());
	return url(`/${y}/${m}/${day}/${slug}/`, lang);
}

export function getTagUrl(tag: string, lang?: string): string {
	if (!tag) return url("/archive/", lang);
	return url(`/archive/?tag=${encodeURIComponent(tag.trim())}`, lang);
}

export function getCategoryUrl(category: string | null, lang?: string): string {
	if (
		!category ||
		category.trim() === "" ||
		category.trim().toLowerCase() ===
			i18n(I18nKey.uncategorized, lang).toLowerCase()
	)
		return url("/archive/?uncategorized=true", lang);
	return url(`/archive/?category=${encodeURIComponent(category.trim())}`, lang);
}

export function getDir(path: string): string {
	const lastSlashIndex = path.lastIndexOf("/");
	if (lastSlashIndex < 0) {
		return "/";
	}
	return path.substring(0, lastSlashIndex + 1);
}

// Apply the locale tree prefix (zh_CN has none) on top of BASE_URL.
export function url(path: string, lang?: string) {
	const prefix = LOCALE_PREFIX[(lang as Locale) || DEFAULT_LOCALE] ?? "";
	return joinUrl("", import.meta.env.BASE_URL, prefix, path);
}

// "foo.en" (English variant entry) -> "foo"
export function stripEnSuffix(slug: string): string {
	return slug.endsWith(".en") ? slug.slice(0, -3) : slug;
}

// The same path as it appears in another locale tree (pure path transform).
export function switchLocalePath(pathname: string, targetLocale: string): string {
	const { path } = stripLocalePrefix(pathname);
	const prefix = LOCALE_PREFIX[targetLocale as Locale] ?? "";
	return joinUrl("", prefix, path) || "/";
}
