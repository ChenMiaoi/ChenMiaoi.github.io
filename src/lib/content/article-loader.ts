import { createResourceCache } from "./client-cache";

const loadStylesheet = createResourceCache<void>(
	(href) =>
		new Promise((resolve, reject) => {
			const existing = [
				...document.head.querySelectorAll<HTMLLinkElement>(
					'link[rel="stylesheet"]',
				),
			].find((link) => link.href === href);
			if (existing?.sheet) {
				resolve();
				return;
			}
			const link = existing ?? document.createElement("link");
			const finish = (error?: Error) => {
				clearTimeout(timeout);
				link.removeEventListener("load", success);
				link.removeEventListener("error", failure);
				if (error) {
					if (!existing) link.remove();
					reject(error);
				} else resolve();
			};
			const success = () => finish();
			const failure = () =>
				finish(new Error(`Unable to load article styles: ${href}`));
			const timeout = setTimeout(failure, 15000);
			link.addEventListener("load", success, { once: true });
			link.addEventListener("error", failure, { once: true });
			if (!existing) {
				link.rel = "stylesheet";
				link.href = href;
				link.dataset.readerStyle = "";
				document.head.append(link);
			}
		}),
);

// Only the dedicated, locally rendered article route's styles are adopted.
// Scripts never execute; the reader owns copy, scrolling and navigation.
export const loadArticle = createResourceCache(async (url) => {
	const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
	if (!response.ok)
		throw new Error(`Unable to load article: ${response.status}`);
	const parsed = new DOMParser().parseFromString(
		await response.text(),
		"text/html",
	);
	const article = parsed.querySelector("[data-reader-content]");
	if (!article) throw new Error("Missing article content");
	await Promise.all(
		[
			...parsed.head.querySelectorAll<HTMLLinkElement>(
				'link[rel="stylesheet"]',
			),
		].map((link) => loadStylesheet(new URL(link.href, location.origin).href)),
	);
	article.querySelectorAll("script").forEach((script) => {
		script.remove();
	});
	return article.innerHTML;
});
