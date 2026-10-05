import { getContext, setContext } from "svelte";
import type { Locale } from "../../../constants/locales";
import { createTranslations } from "./index";

const translationContext = Symbol("orbital-translations");
type Translations = ReturnType<typeof createTranslations>;

export function provideTranslations(locale: Locale) {
	const translations = createTranslations(locale);
	setContext(translationContext, translations);
	return translations;
}

export function useTranslations() {
	return getContext<Translations>(translationContext);
}
