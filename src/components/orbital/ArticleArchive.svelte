<script lang="ts">
import { useTranslations } from "../../features/orbital/i18n/context";
const { t, dateLocale } = useTranslations();
import { tick } from "svelte";
import TerminalIcon from "./TerminalIcon.svelte";
import InteractionGlow from "./InteractionGlow.svelte";
import { revealOnView } from "./motion";
import { topicTone } from "../../features/orbital/topic-colors";
import type { ArchivePost, ArchiveSeries } from "./types";
export let posts: ArchivePost[];
export let series: ArchiveSeries[];
export let category = "all";
export let query = "";
export let seriesFilter = "";
export let reducedMotion = true;
export let motionReady = false;
export let resetKey = 0;
export let openReader: (post: ArchivePost, heading?: string) => void;
export let resetFilters: () => void;
let descending = true;
let selectedSlug = posts[0]?.slug ?? "";
let markerTop = 26;
let connectionY = 70;
let connectionStartX = 0;
let connectionTargetY = 116;
let railHeight = 560;
let connectionTop = 56;
let connectionVisible = true;
let archiveBody: HTMLDivElement;
let archiveScroll: HTMLDivElement;
let contextPanel: HTMLDivElement;

$: filteredPosts = posts
	.filter((post) => {
		const text = `${post.searchText} ${post.seriesTitle}`.toLowerCase();
		const categoryMatch =
			category === "all" ||
			(category === "hardware"
				? /riscv|硬件/i.test(post.series + post.category)
				: post.category.toLowerCase() === category.toLowerCase());
		const seriesMatch =
			!seriesFilter ||
			series
				.find((item) => item.slug === seriesFilter)
				?.posts.includes(post.slug);
		return (
			categoryMatch && seriesMatch && text.includes(query.trim().toLowerCase())
		);
	})
	.sort((a, b) =>
		descending ? b.timestamp - a.timestamp : a.timestamp - b.timestamp,
	);
$: selectedPost =
	filteredPosts.find((post) => post.slug === selectedSlug) ?? filteredPosts[0];
$: selectedIndex = selectedPost
	? filteredPosts.findIndex((post) => post.slug === selectedPost.slug) + 1
	: 0;
$: selectedSeriesTitle = series.find(
	(item) => item.slug === seriesFilter,
)?.title;

$: if (selectedPost && archiveBody) positionContext();
$: if (filteredPosts && archiveScroll) resetArchiveScroll();
$: resetSelection(resetKey);
function resetSelection(_key: number) {
	descending = true;
	selectedSlug = posts[0]?.slug ?? "";
}
async function resetArchiveScroll() {
	await tick();
	archiveScroll?.scrollTo({ top: 0, behavior: "instant" });
	positionContext();
}

async function positionContext() {
	await tick();
	if (!archiveBody?.isConnected || !archiveScroll?.isConnected) return;
	const card = archiveBody?.querySelector<HTMLElement>(".dossier.is-selected");
	if (!card) return;
	markerTop = card.offsetTop + 28;
	const cardBounds = card.getBoundingClientRect();
	const scrollBounds = archiveScroll.getBoundingClientRect();
	connectionY = Math.max(
		8,
		Math.min(
			scrollBounds.height - 8,
			cardBounds.top + cardBounds.height / 2 - scrollBounds.top,
		),
	);
	connectionVisible =
		cardBounds.bottom > scrollBounds.top + 8 &&
		cardBounds.top < scrollBounds.bottom - 8;
	connectionTop = archiveScroll.offsetTop;
	railHeight = archiveScroll.clientHeight;
	if (contextPanel?.isConnected) {
		const panelBounds = contextPanel.getBoundingClientRect();
		connectionTargetY = panelBounds.top + 116 - scrollBounds.top;
		const gap = panelBounds.left - scrollBounds.right;
		connectionStartX =
			gap > 0 ? ((cardBounds.right - scrollBounds.right) * 70) / gap : 0;
	}
}

function observeRail(node: HTMLDivElement) {
	const observer = new ResizeObserver(positionContext);
	observer.observe(node);
	return { destroy: () => observer.disconnect() };
}

async function browseDocument(direction: number) {
	const next = filteredPosts[selectedIndex - 1 + direction];
	if (!next) return;
	selectedSlug = next.slug;
	await tick();
	const card = archiveBody.querySelector<HTMLElement>(".dossier.is-selected");
	if (!card) return;
	const bounds = card.getBoundingClientRect();
	const viewport = archiveScroll.getBoundingClientRect();
	const offset =
		bounds.top < viewport.top + 8
			? bounds.top - viewport.top - 8
			: bounds.bottom > viewport.bottom - 12
				? bounds.bottom - viewport.bottom + 12
				: 0;
	if (offset)
		archiveScroll.scrollBy({
			top: offset,
			behavior: reducedMotion ? "instant" : "smooth",
		});
}

async function moveSelection(event: KeyboardEvent, index: number) {
	const positions: Record<string, number> = {
		ArrowDown: Math.min(index + 1, filteredPosts.length - 1),
		ArrowUp: Math.max(index - 1, 0),
		Home: 0,
		End: filteredPosts.length - 1,
	};
	const next = positions[event.key];
	if (next === undefined || !filteredPosts[next]) return;
	event.preventDefault();
	selectedSlug = filteredPosts[next].slug;
	await tick();
	archiveBody
		.querySelectorAll<HTMLButtonElement>(".dossier-preview")
		[next]?.focus();
}

function readArticle(event: MouseEvent, post: ArchivePost) {
	if (
		event.button !== 0 ||
		event.ctrlKey ||
		event.metaKey ||
		event.shiftKey ||
		event.altKey
	)
		return;
	event.preventDefault();
	openReader(post);
}
</script>
<svelte:window onscroll={positionContext} />
        {#if seriesFilter || query}
          <div class="filter-summary"><span>{seriesFilter ? selectedSeriesTitle : t("搜索「{v0}」", { v0: query })} <small>{t("{v0} 篇文章", { v0: filteredPosts.length })}</small></span><button onclick={resetFilters}>{t("清除筛选")} <TerminalIcon name="close" size={14}/></button></div>
        {/if}
        <div class="archive-grid" data-topic={selectedPost ? topicTone(selectedPost.series, selectedPost.category) : 'neutral'}>
          <section class="archive-list" aria-label={t("文章档案")}>
            <div class="archive-toolbar console-register"><span>{t("文章索引")}<small aria-live="polite" aria-atomic="true">{#key filteredPosts.length}<span class="result-count">{String(filteredPosts.length).padStart(2, "0")}</span>{/key}</small></span><button onclick={() => { descending = !descending; selectedSlug = ''; }} aria-label={descending ? t("按时间从旧到新排序") : t("按时间从新到旧排序")}>{descending ? t("最新优先") : t("最早优先")}<span class:reversed={!descending}><TerminalIcon name="sort" size={16}/></span></button></div>
            <div class="archive-scroll" bind:this={archiveScroll} use:observeRail onscroll={positionContext} tabindex="0" role="region" aria-label={t("滚动浏览文章档案")}>
            <div class="archive-rail" bind:this={archiveBody} use:observeRail use:revealOnView={{key: `${category}|${seriesFilter}|${descending}|${query}`, enabled: motionReady && !reducedMotion, selector: '.dossier-content', wait: query ? 140 : 0}}>
              {#if selectedPost}<span class="rail-focus" style={`transform:translateY(${markerTop}px)`} aria-hidden="true"></span>{/if}
              {#each filteredPosts as post, index (post.slug)}
                <div class="dossier" class:is-selected={selectedPost?.slug === post.slug}>
                  <span class="rail-node" aria-hidden="true"></span>
                  <div class="dossier-hit console-row" data-topic={topicTone(post.series, post.category)} class:console-selected={selectedPost?.slug === post.slug} data-feedback>
                    <InteractionGlow/>
                    <span class="console-lock" aria-hidden="true"></span>
                    <span class="dossier-lock" aria-hidden="true"></span>
                    <span class="dossier-index" aria-hidden="true">{String(filteredPosts.indexOf(post) + 1).padStart(2, "0")}</span>
                    <span class="dossier-meta"><time class="dossier-date" datetime={post.date.replaceAll(".", "-")}>{post.date}</time><span class:dossier-category={selectedPost?.slug !== post.slug} data-topic={selectedPost?.slug === post.slug ? undefined : topicTone('', post.category)}>{selectedPost?.slug === post.slug ? t("正在预览") : post.category === 'linux' ? 'LINUX' : t("硬件")}</span></span>
                    <span class="dossier-content"><a class="dossier-title" href={post.url} onclick={(event) => readArticle(event, post)}><strong>{post.title}</strong></a><span class="dossier-description">{post.description}</span></span>
                    <span class="dossier-series" data-topic={topicTone(post.series, post.category)}>{post.seriesTitle}</span>
                    {#if selectedPost?.slug === post.slug}<p class="dossier-mobile-preview">{post.excerpt}</p>{/if}
                    <div class="dossier-actions">
                      <button class="dossier-preview" aria-label={t("预览：{v0}", { v0: post.title })} aria-pressed={selectedPost?.slug === post.slug} onclick={() => { selectedSlug = post.slug; }} onkeydown={(event) => moveSelection(event,index)}>{t("预览文章")}<TerminalIcon name="arrow" size={16}/></button>
                      <a class="dossier-read" href={post.url} onclick={(event) => readArticle(event, post)} aria-label={t("阅读：{v0}", { v0: post.title })}>{t("进入阅读")}<TerminalIcon name="external" size={16}/></a>
                    </div>
                  </div>
                </div>
              {/each}
              {#if filteredPosts.length === 0}
                <div class="archive-empty"><TerminalIcon name="search" size={30}/><h2>{t("没有找到相关档案")}</h2><p>{t("试试其他关键词，或返回全部文章。")}</p><button class="signal-button" onclick={resetFilters}>{t("清除筛选")}</button></div>
              {/if}
              {#if filteredPosts.length > 0}
                <div class="archive-end"><span></span>{t("共 {v0} 篇文章", { v0: filteredPosts.length })}<span></span></div>
              {/if}
            </div>
            </div>
            {#if selectedPost && connectionVisible}<svg class="archive-connection" viewBox={`0 0 70 ${railHeight}`} preserveAspectRatio="none" style={`height:${railHeight}px;top:${connectionTop}px`} aria-hidden="true"><path d={`M${connectionStartX} ${connectionY}H12L53 ${connectionTargetY}H70`} />{#key selectedPost.slug}<path class="archive-arrival" pathLength="1" d={`M${connectionStartX} ${connectionY}H12L53 ${connectionTargetY}H70`}/>{/key}<circle cx="68" cy={connectionTargetY} r="3"/></svg>{/if}
          </section>

          <aside class="context-column" aria-label={t("当前文章预览")}>
            {#if selectedPost}
              <div class="context-panel console-panel" data-feedback bind:this={contextPanel}>
                <InteractionGlow/>
                <div class="context-label"><span><i></i>{t("当前档案")}</span><small>{t("文档 /")} {String(selectedIndex).padStart(2, '0')}</small></div>
                {#key selectedPost.slug}
                  <div class="context-content" class:context-receiving={motionReady && !reducedMotion}>
                    <span class="context-reception" aria-hidden="true"></span>
                    <p class="context-eyebrow" data-topic={topicTone(selectedPost.series, selectedPost.category)}>{selectedPost.seriesTitle}</p>
                    <h2>{selectedPost.title}</h2>
                    <p class="context-meta">{selectedPost.date}<span>/</span>{selectedPost.tags.slice(0,2).join(' · ')}</p>
                    <p class="context-excerpt">{selectedPost.excerpt}</p>
                    {#if selectedPost.contentLang !== dateLocale}<p class="context-language-note">{t("正文为中文原文。")}</p>{/if}
                    <div class="context-chapters"><h3>{selectedPost.headings.length ? t("从这里开始") : t("文章主题")}</h3>
                      {#if selectedPost.headings.length}
                        {#each selectedPost.headings.filter((heading) => heading.depth <= 2).slice(0, 2) as heading}
                          <button lang={selectedPost.contentLang} onclick={() => openReader(selectedPost, heading.slug)}>{heading.text}<TerminalIcon name="arrow" size={16}/></button>
                        {/each}
                      {:else}<p>{selectedPost.tags.join(" / ") || selectedPost.seriesTitle}</p>{/if}
                    </div>
                    <button class="signal-button read-action" data-feedback onclick={() => openReader(selectedPost)}><InteractionGlow/><span>{t("进入阅读")}<small>{t("阅读文档")}</small></span><TerminalIcon name="external" size={22}/></button>
                  </div>
                {/key}
              </div>
              <div class="document-jog" aria-label={t("档案切换")}><button aria-label={t("上一篇档案")} disabled={selectedIndex <= 1} onclick={() => browseDocument(-1)}><TerminalIcon name="back" size={18}/></button><span>{String(selectedIndex).padStart(2,'0')}<i>/</i>{String(filteredPosts.length).padStart(2,'0')}</span><button aria-label={t("下一篇档案")} disabled={selectedIndex >= filteredPosts.length} onclick={() => browseDocument(1)}><TerminalIcon name="arrow" size={18}/></button></div>
            {/if}
          </aside>
        </div>
