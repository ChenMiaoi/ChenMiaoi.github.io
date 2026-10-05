<script lang="ts">
  import { provideTranslations } from "../../features/orbital/i18n/context";
  import type { Locale } from "../../constants/locales";
  import LanguageSwitcher from "./LanguageSwitcher.svelte";
  export let lang: Locale = "zh_CN";
  const { t } = provideTranslations(lang);
  import { onMount, tick } from "svelte";
  import ArticleArchive from "./ArticleArchive.svelte";
  import ArticleReader from "./ArticleReader.svelte";
  import TerminalIcon from "./TerminalIcon.svelte";
  import BrandIcon from "./BrandIcon.svelte";
  import SeriesExplorer from "./SeriesExplorer.svelte";
  import KnowledgeAtlas from "./KnowledgeAtlas.svelte";
  import SourceDock from "./SourceDock.svelte";
  import ProfileDossier from "./ProfileDossier.svelte";
  import WelcomePortal from "./WelcomePortal.svelte";
  import { navigationBeacon } from "./motion";
  import type { ArchivePost, ArchiveSeries, ContributionActivitySnapshot } from "./types";
  import type { ContributionProject, ProfileConfig } from "../../types/config";

  export let posts: ArchivePost[];
  export let series: ArchiveSeries[];
  export let projects: ContributionProject[];
  export let activity: ContributionActivitySnapshot;
  export let detailsUrl: string;
  export let profile: ProfileConfig;

  import { contributionUrl, resolveContributionSelection } from "../../lib/contributions/navigation";
  import { sectionPaths, resolveOrbitalLocation, isWelcomeLocation, type Section } from "../../lib/content/navigation";
  export let initialSection: Section = "articles";
  export let initialSeries = "";
  export let initialProject = "";
  export let localePrefix = "";
  export let notFound = false;
  export let initialWelcome = false;
  let welcome = initialWelcome;
  let mainElement: HTMLElement;
  const navigation: { id: Section; label: string; icon: string; kicker: string; title: string }[] = [
    { id: "articles", label: t("文章"), icon: "article", kicker: "WRITING / ARCHIVE", title: t("文章档案") },
    { id: "series", label: t("系列"), icon: "series", kicker: "COLLECTIONS / DIRECTORY", title: t("探索路径") },
    { id: "graph", label: t("知识地图"), icon: "graph", kicker: "KNOWLEDGE / CONNECTIONS", title: t("知识地图") },
    { id: "code", label: t("开源"), icon: "code", kicker: "SOURCE / OPEN", title: t("代码与实践") },
    { id: "about", label: t("关于"), icon: "about", kicker: "PROFILE / CHEN MIAO", title: t("关于我") },
  ];
  let section: Section = initialSection;
  let query = "";
  let category = "all";
  let seriesFilter = initialSeries;
  let returnPath = `${localePrefix}${sectionPaths.articles}`;
  let resetKey = 0;
  let reader: ArticleReader;
  let sourceProject = initialProject || projects[0]?.id;
  let sourceRecord = "";
  let sourceKind = "all";
  let searchInput: HTMLInputElement;
  let systemReducedMotion = true;
  let effectsEnabled = true;
  let motionReady = false;
  let pageVisible = true;
  let readerOpen = false;
  let finePointer = false;
  let cameraX = 0;
  let cameraY = 0;
  let cameraFrame = 0;
  $: reducedMotion = systemReducedMotion || !effectsEnabled;
  $: ambientPaused = readerOpen || !pageVisible;
  $: activeSection = navigation.find((item) => item.id === section) ?? navigation[0];
  const descriptions: Record<Section, string> = {
    articles: '',
    series: '',
    graph: '',
    code: '',
    about: t("记录系统的内部世界。"),
  };
  function setSection(next: Section, preserveQuery = false) {
    welcome = false;
    section = next;
    const path = localePrefix + sectionPaths[next];
    if (window.location.pathname !== path || (!preserveQuery && window.location.search) || window.location.hash) history.pushState(null, "", path);
    document.title = `${navigation.find((item) => item.id === next)?.title} · Miao's Blog`;
  }

  function sourceNavigate(project: string, record: string, kind: string) {
    sourceProject = project;
    sourceRecord = record;
    sourceKind = kind;
    const path = contributionUrl(project, record, kind, localePrefix);
    if (window.location.pathname + window.location.search !== path) history.pushState(null, "", path);
  }

  function navigate(next: Section) {
    if (next === "code") {
      sourceProject = projects[0]?.id;
      sourceRecord = "";
      sourceKind = "all";
    }
    setSection(next);
    if (next === "articles") resetFilters();
  }

  async function enterArchive() {
    navigate("articles");
    await tick();
    window.scrollTo({ top: 0, behavior: "instant" });
    mainElement?.focus({ preventScroll: true });
  }

  async function openAuthor() {
    navigate("about");
    await tick();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function toggleMotion() {
    effectsEnabled = !effectsEnabled;
    try { localStorage.setItem("orbital:motion", effectsEnabled ? "on" : "off"); } catch { /* Motion still works when storage is unavailable. */ }
  }

  function moveCamera(event: PointerEvent) {
    if (reducedMotion || ambientPaused || !finePointer || window.innerWidth < 1000 || event.pointerType !== "mouse") return;
    cancelAnimationFrame(cameraFrame);
    cameraFrame = requestAnimationFrame(() => {
      if (reducedMotion || ambientPaused || !finePointer) return;
      cameraX = (Math.max(0, Math.min(1, event.clientX / window.innerWidth)) - .5) * -14;
      cameraY = (Math.max(0, Math.min(1, event.clientY / window.innerHeight)) - .5) * -10;
    });
  }

  function resetCamera() {
    if (typeof window === "undefined") return;
    cancelAnimationFrame(cameraFrame);
    cameraX = 0;
    cameraY = 0;
  }

  $: if (reducedMotion || !finePointer) resetCamera();

  function resetFilters() {
    query = "";
    category = "all";
    seriesFilter = "";
    resetKey++;
  }

  function filterSeries(slug: string) {
    section = "articles";
    resetFilters();
    seriesFilter = slug;
    history.pushState(null, "", `${localePrefix}/series/${encodeURIComponent(slug)}/`);
    document.title = `${series.find((item) => item.slug === slug)?.title} · Miao's Blog`;
  }

  function search() {
    if (section !== "articles") {
      category = "all";
    }
    seriesFilter = "";
    setSection("articles", true);
    storeFilters();
  }

  function openReader(post: ArchivePost, heading?: string) {
    if (!readerOpen) returnPath = window.location.pathname + window.location.search;
    const path = post.url + (heading ? `#${encodeURIComponent(heading)}` : "");
    if (window.location.pathname + window.location.hash !== path) history.pushState(null, "", path);
    document.title = `${post.title} · Miao's Blog`;
    void reader.open(post, heading);
  }
  function readerClosed() {
    history.pushState(null, "", returnPath);
    restoreLocation();
  }

  function clearFilters() {
    resetFilters();
    setSection("articles");
  }

  function storeFilters() {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category !== "all") params.set("category", category);
    history.replaceState(null, "", `${localePrefix}${sectionPaths.articles}${params.size ? `?${params}` : ""}`);
  }

  function shortcuts(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !readerOpen && !welcome) {
      event.preventDefault();
      searchInput?.focus();
    }
  }

  function restoreLocation() {
      welcome = !notFound && isWelcomeLocation(window.location.pathname, window.location.search, localePrefix);
      if (welcome) {
        if (readerOpen) reader.close(false);
        document.title = t("欢迎登站 · Miao's Blog");
        return;
      }
      const target = resolveOrbitalLocation(window.location.pathname, posts, localePrefix);
      if (target.post) {
        document.title = `${target.post.title} · Miao's Blog`;
        let heading: string | undefined;
        try { heading = decodeURIComponent(window.location.hash.slice(1)) || undefined; } catch { /* Ignore malformed fragments. */ }
        void reader.open(target.post as ArchivePost, heading);
      } else {
        section = target.section;
        if (section === "code") {
          sourceProject = target.contributionProject || projects[0]?.id;
          const selection = resolveContributionSelection(window.location.search);
          sourceRecord = selection.record;
          sourceKind = selection.kind;
        }
        seriesFilter = target.series;
        const params = new URLSearchParams(window.location.search);
        query = params.get("q") || params.get("tag") || "";
        category = params.get("category") || "all";
        if (readerOpen) reader.close(false);
        const projectTitle = section === "code" ? projects.find((item) => item.id === sourceProject)?.name : "";
        document.title = `${projectTitle || series.find((item) => item.slug === seriesFilter)?.title || navigation.find((item) => item.id === section)?.title} · Miao's Blog`;
      }
  }

  onMount(() => {
    document.body.classList.add("orbital-ready");
    restoreLocation();
    window.addEventListener("popstate", restoreLocation);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const updatePointer = () => { finePointer = pointer.matches; };
    const updateMotion = () => { systemReducedMotion = media.matches; };
    const updateVisibility = () => { pageVisible = !document.hidden; };
    try { effectsEnabled = localStorage.getItem("orbital:motion") !== "off"; } catch { /* Use the system preference. */ }
    updateMotion();
    updatePointer();
    updateVisibility();
    motionReady = true;
    media.addEventListener("change", updateMotion);
    pointer.addEventListener("change", updatePointer);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      window.removeEventListener("popstate", restoreLocation);
      media.removeEventListener("change", updateMotion);
      pointer.removeEventListener("change", updatePointer);
      cancelAnimationFrame(cameraFrame);
      document.removeEventListener("visibilitychange", updateVisibility);
      document.body.classList.remove("reader-open");
    };
  });
</script>

<svelte:window onkeydown={shortcuts} onpointermove={moveCamera} onblur={resetCamera} onresize={resetCamera}/>

<div class="station-scene" class:welcome-scene={welcome} class:motion-running={motionReady && !reducedMotion} class:motion-idle={ambientPaused} style={`--camera-x:${cameraX}px;--camera-y:${cameraY}px`} aria-hidden="true"></div>
<div class="station-shade" class:welcome-shade={welcome} aria-hidden="true"></div>
<div class="station-atmosphere" class:motion-running={motionReady && !reducedMotion} class:motion-idle={ambientPaused} aria-hidden="true">
  {#each [0, 1, 2, 3, 4] as mote}<span style={`--mote-x:${[19,39,66,83,94][mote]}%;--mote-y:${[73,40,83,33,65][mote]}%;--mote-time:${[13,17,19,15,21][mote]}s;--mote-delay:${mote * -3}s`}></span>{/each}
</div>
{#if welcome}
  <WelcomePortal {localePrefix} {reducedMotion} {motionReady} {ambientPaused} {systemReducedMotion} {toggleMotion} onEnter={enterArchive} author={profile.name}/>
{:else}
<a class="skip-link" href="#terminal-main">{t("跳到文章")}</a>

<div class="terminal-shell" class:motion-ready={motionReady} class:motion-paused={reducedMotion} class:ambient-paused={ambientPaused} class:archive-view={section === 'articles'} class:series-view={section === 'series'} class:graph-view={section === 'graph'} class:source-view={section === 'code'} class:about-view={section === 'about'}>
  <svg class="terminal-orbit" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true"><path d="M136 123C38 280 20 705 143 902"/><path d="M127 121C24 305 17 716 137 907"/><path class="orbit-transmission" d="M136 123C38 280 20 705 143 902" pathLength="1"/><circle cx="136" cy="123" r="5"/><circle cx="143" cy="902" r="5"/><path class="orbit-ground" d="M215 950H1450l75-75"/></svg>
  <header class="terminal-header">
    <button class="brand" aria-label={t("Miao's Blog，返回文章档案")} onclick={() => navigate("articles")}>
      <svg class="brand-mark" viewBox="0 0 52 52" aria-hidden="true"><path d="M35 4h10L17 36H7zM19 30h9L12 48H2z" fill="currentColor"/><path d="M34 29h12L31 47H19z" fill="#f3dc26"/></svg>
      <span><strong>Miao's Blog</strong><small>SYSTEMS & NOTES</small></span>
    </button>
    <span class="header-hairline" aria-hidden="true"><i></i><span>PERSONAL ARCHIVE</span></span>
    <div class="header-tools">
      <LanguageSwitcher {reducedMotion}/>
      <div class="search-frame">
        <TerminalIcon name="search" size={20}/>
        <input bind:this={searchInput} bind:value={query} oninput={search} aria-label={t("搜索文章")} placeholder={t("搜索文章")} type="search" autocomplete="off" />
        <kbd>Ctrl K</kbd>
      </div>
      <a class="github-link" href="https://github.com/ChenMiaoi" target="_blank" rel="noreferrer"><BrandIcon name="github" size={18} framed={false}/>GitHub <TerminalIcon name="external" size={17}/></a>
    </div>
  </header>

  <div class="terminal-workspace">
    <aside class="terminal-sidebar">
      <p class="sidebar-label">NAVIGATION</p>
      <nav class="primary-nav" aria-label={t("主导航")} use:navigationBeacon={section}>
        <span class="nav-tracer" aria-hidden="true"></span>
        {#each navigation as item, index}
          <a href={localePrefix + sectionPaths[item.id]} class:active={section === item.id} style={`--nav-offset:${[17,4,0,4,17][index]}px`} aria-current={section === item.id ? "page" : undefined} onclick={(event) => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(item.id); }}>
            <TerminalIcon name={item.icon} size={20}/><span>{item.label}</span><small aria-hidden="true">{String(index + 1).padStart(2, "0")}</small>
          </a>
        {/each}
      </nav>
      <button class="sidebar-note author-entry" aria-label={t("关于作者：{v0}", { v0: profile.name })} onclick={openAuthor}>
        <span class="sidebar-avatar" aria-hidden="true">
          {#if profile.avatar}<img src={profile.avatar} alt="" width="36" height="36"/>{:else}<span>{profile.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</span>{/if}
        </span>
        <span class="sidebar-author-copy"><strong>{profile.name}</strong><span>{t("关于作者")}<TerminalIcon name="arrow" size={14}/></span></span>
      </button>
    </aside>

    <main id="terminal-main" class="terminal-main" bind:this={mainElement} tabindex="-1">
      {#if notFound}<p class="route-notice" role="status">{t("没有找到这个页面。你可以从文章档案继续探索。")}</p>{/if}
      {#key section}
      <div class="archive-heading">
        <div><p class="terminal-kicker"><span></span>{activeSection.kicker}</p><h1>{activeSection.title}<span class="heading-mark" aria-hidden="true">/</span></h1>{#if descriptions[section]}<p class="heading-description">{descriptions[section]}</p>{/if}</div>
        {#if section === "articles"}
          <div class="category-tabs" aria-label={t("文章分类")}>
            {#each [{ value: "all", label: t("全部") }, { value: "linux", label: "Linux" }, { value: "hardware", label: t("硬件设计") }] as tab}
              <button class:active={category === tab.value} aria-pressed={category === tab.value} onclick={() => { category = tab.value; seriesFilter = ""; setSection("articles"); storeFilters(); }}>{#if tab.value !== 'all'}<BrandIcon name={tab.value === 'linux' ? 'linux' : 'chip'} size={15} framed={false}/>{/if}{tab.label}</button>
            {/each}
          </div>
        {:else}<span class="section-coordinate">MIAO'S PERSONAL ARCHIVE</span>{/if}
      </div>
      {/key}

      {#if section === "articles"}
        <ArticleArchive {posts} {series} {category} {query} {seriesFilter} {reducedMotion} {motionReady} {resetKey} {openReader} resetFilters={clearFilters}/>
      {:else if section === "series"}
        <SeriesExplorer {posts} {series} {reducedMotion} onRead={openReader} onBrowse={filterSeries}/>
      {:else if section === "graph"}
        <KnowledgeAtlas {posts} {series} {reducedMotion} onRead={openReader} onBrowse={filterSeries}/>
      {:else if section === "code"}
        <SourceDock {projects} {activity} {detailsUrl} {reducedMotion} bind:projectId={sourceProject} bind:selectedId={sourceRecord} bind:kindFilter={sourceKind} onNavigate={sourceNavigate}/>
      {:else}
        <ProfileDossier {profile} onNavigate={navigate} onExplore={(nextCategory) => { navigate('articles'); category = nextCategory; storeFilters(); }}/>
      {/if}
    </main>
  </div>

  <footer class="terminal-footer"><span>Miao's Blog <i>·</i> Chen Miao</span><span class="footer-line" aria-hidden="true"></span><button class="motion-control" aria-label={systemReducedMotion ? t("系统已减少动态效果") : effectsEnabled ? t("暂停页面动效") : t("开启页面动效")} aria-pressed={!reducedMotion} disabled={systemReducedMotion} onclick={toggleMotion} title={systemReducedMotion ? t("跟随系统的减少动态效果设置") : t("切换页面动效")}><TerminalIcon name={reducedMotion ? 'play' : 'pause'} size={13}/><span>{reducedMotion ? t("动效暂停") : t("动效开启")}</span></button><a class="feed-link" href={localePrefix === '/en' ? '/en/rss.xml' : '/rss.xml'}>RSS</a><span class="footer-words">{t("文章")} <i>/</i> {t("系列")} <i>/</i> {t("关联")}</span></footer>
</div>

{/if}

<ArticleReader bind:this={reader} {reducedMotion} bind:readerOpen onClosed={readerClosed}/>
