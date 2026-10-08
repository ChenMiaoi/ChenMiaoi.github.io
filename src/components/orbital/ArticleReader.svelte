<script lang="ts">
import { useTranslations } from "../../features/orbital/i18n/context";
const { t, dateLocale } = useTranslations();
import { tick, onDestroy } from "svelte";
import TerminalIcon from "./TerminalIcon.svelte";
import { revealOnView, readingBeacon } from "./motion";
import LanguageSwitcher from "./LanguageSwitcher.svelte";
import type { ArchivePost } from "./types";
import { loadArticle, loadStylesheet } from "../../lib/content/article-loader";
export let reducedMotion = false;
export let readerOpen = false;
export let onClosed: () => void = () => {};
export let stylesheet: string | undefined = undefined;
let notifyOnClose = true;
let dialog: HTMLDialogElement;
let readerScroll: HTMLDivElement;
let readerPost: ArchivePost | null = null;
let readerHtml = "";
let readingProgress = 0;
let activeHeading = "";
let mobileContents: HTMLDetailsElement;
$: readerHeadings =
	readerPost?.headings.filter((heading) => heading.depth <= 3) ?? [];
$: firstHeadingDepth = Math.min(
	...readerHeadings.map((heading) => heading.depth),
	3,
);
let readerExit: Animation | null = null;
let headingAcquisition: Animation | null = null;
let cancelHeadingArrival: (() => void) | undefined;
function clearHeadingFeedback() {
	cancelHeadingArrival?.();
	cancelHeadingArrival = undefined;
	headingAcquisition?.cancel();
	headingAcquisition = null;
}
let copyStatus = "";
const copyFeedback = new Map<
	HTMLButtonElement,
	{ timer: ReturnType<typeof setTimeout>; animation?: Animation }
>();
function clearCopyFeedback() {
	for (const [button, feedback] of copyFeedback) {
		clearTimeout(feedback.timer);
		feedback.animation?.cancel();
		delete button.dataset.copied;
		button.setAttribute("aria-label", t("复制代码"));
		button.title = t("复制代码");
	}
	copyFeedback.clear();
	copyStatus = "";
}
$: if (reducedMotion)
	for (const feedback of copyFeedback.values()) feedback.animation?.cancel();
$: if (reducedMotion) clearHeadingFeedback();
$: if (reducedMotion && readerExit) {
	readerExit.cancel();
	readerExit = null;
	dialog?.close();
}
let loading = false;
let failed = false;
let requestId = 0;
let requestedHeading: string | undefined;

export async function open(post: ArchivePost, heading?: string) {
	notifyOnClose = true;
	clearCopyFeedback();
	clearHeadingFeedback();
	const currentRequest = ++requestId;
	requestedHeading = heading;
	readerExit?.cancel();
	readerExit = null;
	readerPost = post;
	readerHtml = "";
	readingProgress = 0;
	activeHeading = "";
	failed = false;
	loading = true;
	if (stylesheet) {
		try {
			await loadStylesheet(new URL(stylesheet, location.origin).href);
		} catch {
			if (currentRequest === requestId) location.assign(post.url);
			return;
		}
	}
	await tick();
	if (currentRequest !== requestId) return;
	if (!dialog.open) {
		dialog.showModal();
		readerScroll.focus({ preventScroll: true });
	}
	readerOpen = true;
	document.body.classList.add("reader-open");
	readerScroll.scrollTop = 0;
	try {
		const html = await loadArticle(post.contentUrl);
		if (currentRequest !== requestId) return;
		readerHtml = html;
		loading = false;
		await tick();
		readerScroll
			.querySelectorAll<HTMLButtonElement>(".copy-btn")
			.forEach((button) => {
				button.setAttribute("aria-label", t("复制代码"));
				button.title = t("复制代码");
			});
		if (heading) jumpToHeading(heading);
		updateProgress();
	} catch {
		if (currentRequest === requestId) {
			failed = true;
			loading = false;
		}
	}
}

export function close(notify = true) {
	closeReader(notify);
}
function closeReader(notify = true) {
	notifyOnClose = notify;
	if (!dialog.open || readerExit) return;
	clearHeadingFeedback();
	if (reducedMotion) {
		dialog.close();
		return;
	}
	const animation = dialog.animate(
		[
			{ opacity: 1, transform: "translateY(0) scale(1)" },
			{ opacity: 0, transform: "translateY(16px) scale(.985)" },
		],
		{ duration: 180, easing: "ease-in", fill: "forwards" },
	);
	readerExit = animation;
	animation.finished
		.then(() => {
			if (readerExit !== animation) return;
			readerExit = null;
			animation.cancel();
			dialog.close();
		})
		.catch(() => {});
}
function readerClosed() {
	clearCopyFeedback();
	clearHeadingFeedback();
	requestId++;
	readerExit?.cancel();
	readerExit = null;
	readerOpen = false;
	// Cached source text can be reused, but a closed dialog need not retain
	// thousands of highlighted-code nodes or article images in the live DOM.
	readerHtml = "";
	readerPost = null;
	document.body.classList.remove("reader-open");
	if (notifyOnClose) onClosed();
}

function jumpToHeading(slug: string) {
	if (mobileContents) mobileContents.open = false;
	const heading = readerScroll?.querySelector(`[id="${CSS.escape(slug)}"]`);
	clearHeadingFeedback();
	if (!heading) return;
	heading.scrollIntoView({
		behavior: reducedMotion ? "instant" : "smooth",
		block: "start",
	});
	if (reducedMotion) return;
	const targetHeading = heading;
	// Wait for the actual scroll to settle, including targets near the document end.
	let frame = 0;
	const started = performance.now();
	let previousTop = readerScroll.scrollTop;
	let lastMovement = started;
	const cancel = () => {
		cancelAnimationFrame(frame);
		readerScroll.removeEventListener("wheel", cancel);
		readerScroll.removeEventListener("touchstart", cancel);
		readerScroll.removeEventListener("keydown", cancel);
	};
	cancelHeadingArrival = cancel;
	readerScroll.addEventListener("wheel", cancel, { passive: true });
	readerScroll.addEventListener("touchstart", cancel, { passive: true });
	readerScroll.addEventListener("keydown", cancel);
	function locate(now: number) {
		const scrollTop = readerScroll.scrollTop;
		if (Math.abs(scrollTop - previousTop) > 0.5) lastMovement = now;
		previousTop = scrollTop;
		if (now - lastMovement < 100 && now - started < 1800) {
			frame = requestAnimationFrame(locate);
			return;
		}
		cancel();
		cancelHeadingArrival = undefined;
		const bounds = targetHeading.getBoundingClientRect();
		const viewport = readerScroll.getBoundingClientRect();
		if (
			!dialog.open ||
			reducedMotion ||
			bounds.bottom <= viewport.top ||
			bounds.top >= viewport.bottom
		)
			return;
		headingAcquisition = targetHeading.animate(
			[
				{ backgroundColor: "#f0e43324", boxShadow: "inset 3px 0 #f0e433" },
				{
					backgroundColor: "transparent",
					boxShadow: "inset 3px 0 transparent",
				},
			],
			{ duration: 1100, easing: "ease-out" },
		);
	}
	frame = requestAnimationFrame(locate);
}

function jumpToStart() {
	clearHeadingFeedback();
	if (mobileContents) mobileContents.open = false;
	readerScroll.scrollTo({
		top: 0,
		behavior: reducedMotion ? "instant" : "smooth",
	});
}

function updateProgress() {
	if (!readerScroll || !readerOpen) return;
	const range = readerScroll.scrollHeight - readerScroll.clientHeight;
	readingProgress =
		range > 0 ? Math.min(100, (readerScroll.scrollTop / range) * 100) : 100;
	const top = readerScroll.getBoundingClientRect().top;
	let current = "";
	for (const heading of readerHeadings) {
		const element = readerScroll.querySelector(
			`[id="${CSS.escape(heading.slug)}"]`,
		);
		if (element && element.getBoundingClientRect().top <= top + 100)
			current = heading.slug;
	}
	// Short final sections cannot reach the top of the scroll viewport.
	if (range > 0 && range - readerScroll.scrollTop <= 2)
		current = readerHeadings.at(-1)?.slug ?? "";
	activeHeading = current;
}

async function readerAction(event: MouseEvent) {
	if (!(event.target instanceof Element) || !dialog?.open) return;
	const copyButton = event.target.closest<HTMLButtonElement>(
		".reading-dialog .copy-btn",
	);
	if (copyButton) {
		const code = [
			...(copyButton.closest("pre")?.querySelectorAll(".ec-line .code") ?? []),
		]
			.map((line) => line.textContent)
			.join("\n");
		const copyRequest = requestId;
		try {
			await navigator.clipboard.writeText(code);
			if (copyRequest !== requestId || !dialog.open || !copyButton.isConnected)
				return;
			const previous = copyFeedback.get(copyButton);
			clearTimeout(previous?.timer);
			previous?.animation?.cancel();
			copyButton.dataset.copied = "true";
			copyButton.setAttribute("aria-label", t("已复制代码"));
			copyButton.title = t("已复制代码");
			copyStatus = "";
			await tick();
			if (copyRequest !== requestId || !dialog.open) return;
			copyStatus = t("已复制代码");
			const animation = reducedMotion
				? undefined
				: copyButton.animate(
						[
							{ boxShadow: "0 0 0 1px #f0e433, 0 0 18px #f0e43344" },
							{ boxShadow: "0 0 0 1px transparent, 0 0 0 transparent" },
						],
						{ duration: 520, easing: "ease-out" },
					);
			const timer = setTimeout(() => {
				delete copyButton.dataset.copied;
				copyButton.setAttribute("aria-label", t("复制代码"));
				copyButton.title = t("复制代码");
				copyFeedback.delete(copyButton);
			}, 1800);
			copyFeedback.set(copyButton, { timer, animation });
		} catch {
			if (copyRequest !== requestId || !dialog.open) return;
			copyStatus = t("复制失败，请选择代码复制");
			copyButton.setAttribute("aria-label", copyStatus);
			copyButton.title = copyStatus;
		}
	}
	const anchor = event.target.closest<HTMLAnchorElement>(
		'.reader-body a[href^="#"]',
	);
	if (anchor) {
		event.preventDefault();
		jumpToHeading(decodeURIComponent(anchor.hash.slice(1)));
	}
}

onDestroy(() => {
	clearCopyFeedback();
	requestId++;
	readerExit?.cancel();
	clearHeadingFeedback();
	if (typeof document !== "undefined")
		document.body.classList.remove("reader-open");
});
</script>
<svelte:document onclick={readerAction} />
<dialog bind:this={dialog} class="reading-dialog" class:motion-paused={reducedMotion} onclose={readerClosed} oncancel={(event) => { event.preventDefault(); closeReader(); }} aria-labelledby="reader-title">
  <span class="reader-copy-status" role="status" aria-live="polite" aria-atomic="true">{copyStatus}</span>
  {#if readerPost}
    <header class="reader-header"><button onclick={() => closeReader()}><TerminalIcon name="back" size={19}/><span>{t("返回档案")}</span></button><span class="reader-status"><i aria-hidden="true"></i> {t("档案 / 阅读")}</span><span class="reader-header-progress" aria-label={t("阅读进度")}>{Math.round(readingProgress)}%<small>/ 100</small></span><LanguageSwitcher {reducedMotion} heading={loading ? undefined : activeHeading}/><button class="reader-close" onclick={() => closeReader()} aria-label={t("关闭阅读面板")}><TerminalIcon name="close" size={21}/></button></header>
    <div class="reading-meter" aria-hidden="true"><span style={`width:${readingProgress}%`}></span></div>
    <div class="reader-layout">
      <aside class="reader-toc">
        <div class="reader-toc-heading"><p class="terminal-kicker">{t("本页目录")}</p><h2>{t("文内导航")}</h2></div>
        <nav aria-label={t("文内导航")} use:readingBeacon={{key: activeHeading, open: readerOpen}}>
          <span class="toc-tracer" aria-hidden="true"></span>
          <button class:active={!activeHeading} aria-current={!activeHeading ? 'location' : undefined} onclick={jumpToStart}><span class="toc-number">00</span><span>{t("文章开头")}</span></button>
          {#each readerHeadings as heading, index}
            <button class:active={activeHeading === heading.slug} class:subheading={heading.depth > firstHeadingDepth} aria-current={activeHeading === heading.slug ? 'location' : undefined} onclick={() => jumpToHeading(heading.slug)}><span class="toc-number">{String(index + 1).padStart(2, '0')}</span><span>{heading.text}</span></button>
          {/each}
        </nav>
        <div class="reader-progress-card"><span>{t("阅读进度")}</span><strong>{Math.round(readingProgress)}<small>%</small></strong><div aria-hidden="true"><span style={`width:${readingProgress}%`}></span></div></div>
      </aside>
      <div class="reader-scroll" bind:this={readerScroll} onscroll={updateProgress} tabindex="0" role="region" aria-label={t("文章")}>
        <article class="reader-article" lang={dateLocale}>
          <header class="reader-title-block">
            <p class="reader-eyebrow"><span aria-hidden="true"></span> {t("技术档案")} <span class="reader-document-number">{t("文档 /")} {new Date(readerPost.timestamp).toISOString().slice(0, 10).replaceAll("-", ".")}</span></p>
            <h1 id="reader-title">{readerPost.title}</h1>
            <div class="reader-article-meta"><time datetime={new Date(readerPost.timestamp).toISOString().slice(0, 10)}>{readerPost.date}</time><span aria-hidden="true">/</span><span class="reader-series-name">{readerPost.seriesTitle}</span></div>
          </header>
          {#if readerPost.contentLang !== dateLocale}<p class="reader-language-note" lang={dateLocale}>{t("这篇文章暂无当前语言译文，以下为中文原文。")}</p>{/if}
          <details class="reader-mobile-contents" bind:this={mobileContents}><summary>{t("文内导航")}<TerminalIcon name="arrow" size={15}/></summary><nav aria-label={t("文内导航")}><button onclick={jumpToStart}>{t("文章开头")}</button>{#each readerHeadings as heading}<button class:active={activeHeading === heading.slug} onclick={() => jumpToHeading(heading.slug)}>{heading.text}</button>{/each}</nav></details>
          <div class="reader-body" lang={readerPost.contentLang} aria-busy={loading} use:revealOnView={{key: `${readerPost.slug}|${loading}`, enabled: readerOpen && !loading && !reducedMotion, selector: "img, svg[role='img'], .mermaid"}}>
            {#if loading}<p role="status">{t("正在载入文章…")}</p>{:else if failed}<div role="alert"><p>{t("文章暂时无法载入。")}</p><button class="signal-button" onclick={() => readerPost && open(readerPost, requestedHeading)}>{t("重新加载")}</button><p><a href={readerPost.url}>{t("打开文章页面 ↗")}</a></p></div>{:else}{@html readerHtml}{/if}
          </div>
          <div class="reader-end"><span>{t("文档结束")}</span><button onclick={() => closeReader()}>{t("返回文章档案")} <TerminalIcon name="back" size={17}/></button></div>
        </article>
      </div>
    </div>
  {/if}
</dialog>
