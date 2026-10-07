<script lang="ts">
  import { useTranslations } from "../../features/orbital/i18n/context";
  const { t } = useTranslations();
  import { tick } from "svelte";
  import { fly } from "svelte/transition";
  import TerminalIcon from "./TerminalIcon.svelte";
  import InteractionGlow from "./InteractionGlow.svelte";
  import { revealSequence, revealOnView } from "./motion";
  import { sortSeriesByRecency } from "../../lib/content/series-recency";
  import { topicTone } from "../../features/orbital/topic-colors";
  import type { ArchivePost, ArchiveSeries } from "./types";

  export let posts: ArchivePost[];
  export let series: ArchiveSeries[];
  export let reducedMotion = false;
  export let onRead: (post: ArchivePost) => void;
  export let onBrowse: (slug: string) => void;

  let selection = "";
  let locatedSeries = "";
  let showEmpty = false;
  let chapterPane: HTMLDivElement;
  let seriesRail: HTMLDivElement;

  async function revealSeries(_slug: string) {
    await tick();
    const active = seriesRail?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!active) return;
    const viewport = seriesRail.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    const behavior = reducedMotion ? "instant" : "smooth";
    if (seriesRail.scrollWidth > seriesRail.clientWidth) {
      if (item.left < viewport.left || item.right > viewport.right) seriesRail.scrollTo({ left: seriesRail.scrollLeft + item.left - viewport.left, behavior });
    } else if (item.top < viewport.top || item.bottom > viewport.bottom) {
      seriesRail.scrollTo({ top: seriesRail.scrollTop + (item.top < viewport.top ? item.top - viewport.top : item.bottom - viewport.bottom), behavior });
    }
  }

  function jumpToSeries(slug: string) {
    const group = groups.find((item) => item.series.slug === slug) ?? groups.find((item) => item.series.parent === slug);
    const target = group && chapterPane?.querySelector<HTMLElement>(`[data-series="${CSS.escape(group.series.slug)}"]`);
    if (!target) return;
    locatedSeries = group.series.slug;
    if (chapterPane.scrollHeight > chapterPane.clientHeight) {
      chapterPane.scrollTo({ top: target.offsetTop - 16, behavior: reducedMotion ? "instant" : "smooth" });
    } else {
      target.scrollIntoView({ block: "start", behavior: reducedMotion ? "instant" : "smooth" });
    }
    target.querySelector<HTMLButtonElement>(".path-reading-list button")?.focus({ preventScroll: true });
  }

  const comparePosts = (a: ArchivePost, b: ArchivePost) =>
    (a.seriesOrder ?? Number.POSITIVE_INFINITY) - (b.seriesOrder ?? Number.POSITIVE_INFINITY) || a.timestamp - b.timestamp || a.slug.localeCompare(b.slug);
  const shortTitle = (title: string) => title.split(/[：:]/)[0];
  const subtitle = (title: string) => /[：:]/.test(title) ? title.slice(title.search(/[：:]/) + 1).trim() : "";

  type ReadingGroup = { series: ArchiveSeries; depth: number; posts: ArchivePost[] };
  function readingGroups(node: ArchiveSeries, directory: ArchiveSeries[], articles: ArchivePost[], depth = 0): ReadingGroup[] {
    const children = directory.filter((item) => item.parent === node.slug);
    const groups = children.flatMap((child) => readingGroups(child, directory, articles, depth + 1));
    const directPosts = articles.filter((post) => post.series === node.slug).sort(comparePosts);
    if (directPosts.length || !children.length) groups.push({ series: node, depth, posts: directPosts });
    return groups;
  }

  $: orderedSeries = sortSeriesByRecency(series, posts);
  $: roots = orderedSeries.filter((item) => !item.parent && (showEmpty || item.posts.length));
  $: current = roots.find((item) => item.slug === selection) ?? roots[0];
  $: currentIndex = current ? roots.indexOf(current) + 1 : 0;
  $: if (current) resetLocator(current.slug);
  function resetLocator(_slug: string) { locatedSeries = ""; }
  $: children = current ? orderedSeries.filter((item) => item.parent === current.slug) : [];
  $: groups = current ? readingGroups(current, orderedSeries, posts) : [];
  $: firstPost = current ? posts.filter((post) => post.series === current.slug).sort(comparePosts)[0] ?? groups.flatMap((group) => group.posts)[0] : undefined;
  $: documentCount = new Set(roots.flatMap((root) => root.posts)).size;
  $: if (current && seriesRail) revealSeries(current.slug);
</script>

<svelte:window onresize={() => { if (current) revealSeries(current.slug); }}/>

<section class="path-explorer" aria-label={t("系列探索")}>
  <div class="path-layout">
    <aside class="path-directory" aria-label={t("选择系列")}>
      <div class="path-toolbar">
        <span><i aria-hidden="true"></i>{t("系列目录")}</span>
        <button class:enabled={showEmpty} aria-label={t("显示未收录系列")} title={t("显示未收录系列")} aria-pressed={showEmpty} onclick={() => { showEmpty = !showEmpty; }}><span class="path-toggle" aria-hidden="true"></span>{t("未收录")}</button>
      </div>
      <div class="path-options" bind:this={seriesRail} use:revealSequence={{key: String(showEmpty), enabled: !reducedMotion, selector: '.path-name'}}>
        {#each roots as collection, index (collection.slug)}
          <button class="path-option" data-topic={topicTone(collection.slug)} data-feedback class:active={current?.slug === collection.slug} aria-pressed={current?.slug === collection.slug} aria-label={t("查看系列：{v0}", { v0: collection.title })} onclick={() => { selection = collection.slug; }}>
            <InteractionGlow/><span class="path-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <span class="path-name"><strong>{shortTitle(collection.title)}</strong><small>{collection.posts.length ? t("{v0} 篇文章", { v0: collection.posts.length }) : t("尚未收录")}</small></span>
            <TerminalIcon name="arrow" size={15}/>
          </button>
        {/each}
      </div>
      <div class="path-directory-foot"><span>{t("{v0} 篇笔记", { v0: documentCount })}</span><i aria-hidden="true"></i><span>{t("{v0} 条路径", { v0: roots.length })}</span></div>
    </aside>

    {#if current}
      <section class="path-manifest" aria-labelledby="path-title">
        {#key current.slug}
          <div class="path-manifest-content" in:fly={{ x: reducedMotion ? 0 : 10, duration: reducedMotion ? 0 : 280 }} use:revealSequence={{key: current.slug, enabled: !reducedMotion, selector: '.path-hero-line, #path-title, .path-subtitle, .path-description', wait: 70}}>
            <header class="path-hero" data-topic={topicTone(current.slug)}>
              <div class="path-hero-line"><span>{t("系列 /")} {String(currentIndex).padStart(2, "0")}</span><span>{t("{v0} 份文档", { v0: current.posts.length })}</span></div>
              <span class="path-watermark" aria-hidden="true">{String(currentIndex).padStart(2, "0")}</span>
              <h2 id="path-title">{shortTitle(current.title)}</h2>
              {#if subtitle(current.title)}<p class="path-subtitle">{subtitle(current.title)}</p>{/if}
              <div class="path-summary-row">
                <p class="path-description">{current.description}</p>
                {#if firstPost}<div class="path-hero-actions"><button class="path-start" data-feedback onclick={() => onRead(firstPost)}><InteractionGlow/>{t("开始阅读")}<TerminalIcon name="external" size={18}/></button></div>{/if}
              </div>
            </header>

            {#if children.length}
              <nav class="path-branch-shortcuts" aria-label={t("跳转到子系列")}>
                {#each children as child, index}
                  <button data-topic={topicTone(child.slug)} onclick={() => jumpToSeries(child.slug)}><span class="path-shortcut-node" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span>{shortTitle(child.title)}<small>{t("{v0} 篇文章", { v0: child.posts.length })}</small></span></button>
                {/each}
              </nav>
            {/if}

            <div class="path-outline">
              <div class="path-outline-heading"><h3>{t("阅读目录")}</h3><span>{t("阅读目录")}</span></div>
              <div class="path-chapters" bind:this={chapterPane} use:revealOnView={{key: current.slug, enabled: !reducedMotion, selector: '.path-reading-list button > span:nth-of-type(2)', wait: 180}} tabindex="0" role="region" aria-label={t("{v0}的阅读目录", { v0: shortTitle(current.title) })}>
                {#each groups as group, groupIndex (group.series.slug)}
                  <section class="path-branch" data-topic={topicTone(group.series.slug)} data-series={group.series.slug} class:located={locatedSeries === group.series.slug} class:root-branch={group.depth === 0} style={`--branch-delay:${Math.min(groupIndex, 5) * 100}ms`}>
                    <header class="path-branch-heading">
                      <span class="path-branch-node" aria-hidden="true">{String(groupIndex + 1).padStart(2, "0")}</span>
                      <div><span>{group.depth ? t("子系列") : children.length ? t("本系列文章") : t("文章")}</span><h4>{group.depth ? group.series.title : t("系列正文")}</h4></div>
                      <button onclick={() => onBrowse(group.series.slug)} aria-label={t("在档案中查看：{v0}", { v0: group.series.title })} title={t("在档案中查看")}><span>{t("{v0} 篇文章", { v0: group.posts.length })}</span><TerminalIcon name="external" size={15}/></button>
                    </header>
                    {#if group.posts.length}
                      <ol class="path-reading-list">
                        {#each group.posts as post, index (post.slug)}
                          <li><button onclick={() => onRead(post)} aria-label={t("阅读：{v0}", { v0: post.title })}><span class="path-article-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span>{post.title}</span><TerminalIcon name="arrow" size={15}/></button></li>
                        {/each}
                      </ol>
                    {:else}<p class="path-empty">{t("这个系列还没有收录文章。")}</p>{/if}
                  </section>
                {/each}
                <div class="path-list-end"><span></span>{t("目录到底了")}<span></span></div>
              </div>
            </div>
          </div>
        {/key}
      </section>
    {:else}<p class="path-empty">{t("尚未收录系列。")}</p>{/if}
  </div>
</section>
