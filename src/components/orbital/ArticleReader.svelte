<script lang="ts">
  import { tick, onDestroy } from "svelte";
  import TerminalIcon from "./TerminalIcon.svelte";
  import type { ArchivePost } from "./types";
  import { loadArticle } from "../../lib/content/article-loader";
  export let reducedMotion = false;
  export let readerOpen = false;
  let dialog: HTMLDialogElement;
  let readerScroll: HTMLDivElement;
  let readerPost: ArchivePost | null = null;
  let readerHtml = "";
  let readingProgress = 0;
  let readerExit: Animation | null = null;
  let loading = false;
  let failed = false;
  let requestId = 0;
  let requestedHeading: string | undefined;

  export async function open(post: ArchivePost, heading?: string) {
    const currentRequest = ++requestId;
    requestedHeading = heading;
    readerExit?.cancel();
    readerExit = null;
    readerPost = post;
    readerHtml = "";
    readingProgress = 0;
    failed = false;
    loading = true;
    await tick();
    if (currentRequest !== requestId) return;
    if (!dialog.open) dialog.showModal();
    readerOpen = true;
    document.body.classList.add("reader-open");
    readerScroll.scrollTop = 0;
    try {
      const html = await loadArticle(post.contentUrl);
      if (currentRequest !== requestId) return;
      readerHtml = html;
      loading = false;
      await tick();
      if (heading) jumpToHeading(heading);
      updateProgress();
    } catch {
      if (currentRequest === requestId) { failed = true; loading = false; }
    }
  }

  export function close() { closeReader(); }
  function closeReader() {
    if (!dialog.open || readerExit) return;
    if (reducedMotion) { dialog.close(); return; }
    const animation = dialog.animate([{ opacity: 1, transform: "translateY(0) scale(1)" }, { opacity: 0, transform: "translateY(16px) scale(.985)" }], { duration: 180, easing: "ease-in", fill: "forwards" });
    readerExit = animation;
    animation.finished.then(() => {
      if (readerExit !== animation) return;
      readerExit = null;
      animation.cancel();
      dialog.close();
    }).catch(() => {});
  }
  function readerClosed() { requestId++; readerExit?.cancel(); readerExit = null; readerOpen = false; document.body.classList.remove("reader-open"); }

  function jumpToHeading(slug: string) {
    const heading = readerScroll?.querySelector(`[id="${CSS.escape(slug)}"]`);
    heading?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
  }

  function updateProgress() {
    const range = readerScroll.scrollHeight - readerScroll.clientHeight;
    readingProgress = range > 0 ? Math.min(100, readerScroll.scrollTop / range * 100) : 100;
  }

  async function readerAction(event: MouseEvent) {
    if (!(event.target instanceof Element) || !dialog?.open) return;
    const copyButton = event.target.closest<HTMLButtonElement>(".reading-dialog .copy-btn");
    if (copyButton) {
      const code = [...(copyButton.closest("pre")?.querySelectorAll(".ec-line .code") ?? [])]
        .map((line) => line.textContent).join("\n");
      try {
        await navigator.clipboard.writeText(code);
        copyButton.dataset.copied = "true";
        copyButton.setAttribute("aria-label", "已复制代码");
      } catch {
        copyButton.setAttribute("aria-label", "复制失败，请选择代码复制");
      }
    }
    const anchor = event.target.closest<HTMLAnchorElement>('.reader-body a[href^="#"]');
    if (anchor) {
      event.preventDefault();
      jumpToHeading(decodeURIComponent(anchor.hash.slice(1)));
    }
  }


  onDestroy(() => {
    requestId++;
    readerExit?.cancel();
    if (typeof document !== "undefined") document.body.classList.remove("reader-open");
  });
</script>
<svelte:document onclick={readerAction} />
<dialog bind:this={dialog} class="reading-dialog" class:motion-paused={reducedMotion} onclose={readerClosed} oncancel={(event) => { event.preventDefault(); closeReader(); }} aria-labelledby="reader-title">
  {#if readerPost}
    <header class="reader-header"><button onclick={closeReader}><TerminalIcon name="back" size={19}/><span>返回档案</span></button><span class="reader-status">READING / {readerPost.seriesTitle}</span><button class="reader-close" onclick={closeReader} aria-label="关闭阅读面板"><TerminalIcon name="close" size={21}/></button></header>
    <div class="reading-meter" aria-hidden="true"><span style={`width:${readingProgress}%`}></span></div>
    <div class="reader-layout"><aside class="reader-toc"><p class="terminal-kicker">CONTENTS</p><h2>文内导航</h2>{#each readerPost.headings.filter((heading) => heading.depth <= 3) as heading}<button class:subheading={heading.depth > 1} onclick={() => jumpToHeading(heading.slug)}>{heading.text}</button>{/each}</aside>
      <div class="reader-scroll" bind:this={readerScroll} onscroll={updateProgress}>
        <article class="reader-article"><div class="reader-article-meta">{readerPost.date} <span>/</span> {readerPost.seriesTitle}</div><h1 id="reader-title">{readerPost.title}</h1><div class="reader-body" aria-busy={loading}>{#if loading}<p role="status">正在载入文章…</p>{:else if failed}<div role="alert"><p>文章暂时无法载入。</p><button class="signal-button" onclick={() => readerPost && open(readerPost, requestedHeading)}>重新加载</button><p><a href={readerPost.url}>打开文章页面 ↗</a></p></div>{:else}{@html readerHtml}{/if}</div><div class="reader-end"><span>END OF DOCUMENT</span><button onclick={closeReader}>返回文章档案 <TerminalIcon name="back" size={17}/></button></div></article>
      </div>
    </div>
  {/if}
</dialog>
