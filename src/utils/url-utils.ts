import {
	DEFAULT_LOCALE,
	LOCALE_PREFIX,
	type Locale,
} from "../constants/locales";
import { postPath } from "../lib/content/paths";

export function url(path: string, lang?: string) {
	const prefix = LOCALE_PREFIX[(lang as Locale) || DEFAULT_LOCALE] ?? "";
	return ["", import.meta.env.BASE_URL, prefix, path]
		.join("/")
		.replace(/\/+/g, "/");
}

export function getPostUrlBySlug(
	slug: string,
	published: Date,
	lang?: string,
): string {
	return url(postPath(slug, published), lang);
}
