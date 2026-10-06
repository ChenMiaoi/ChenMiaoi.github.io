import { DEFAULT_LOCALE, type Locale } from "../../constants/locales.ts";

export type MetadataTranslation = {
	title: string;
	description?: string;
	tags?: string[];
};

type LocalizableMetadata = MetadataTranslation & {
	translations?: Partial<Record<Locale, MetadataTranslation>>;
};

// Translate directory metadata independently of the article's original body.
export function localizeMetadata<T extends LocalizableMetadata>(
	metadata: T,
	locale: string = DEFAULT_LOCALE,
): T {
	const translation = metadata.translations?.[locale as Locale];
	return { ...metadata, ...translation };
}

// Keep searches useful after switching languages with the same query.
export function metadataSearchText(metadata: LocalizableMetadata): string {
	return [metadata, ...Object.values(metadata.translations ?? {})]
		.flatMap((entry) => [
			entry.title,
			entry.description ?? "",
			...(entry.tags ?? []),
		])
		.join(" ");
}
