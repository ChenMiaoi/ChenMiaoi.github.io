<script lang="ts">
  import { provideTranslations } from "../../features/orbital/i18n/context";
  import type { Locale } from "../../constants/locales";
  import SiteHeader from "./SiteHeader.svelte";
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
  import { navigationBeacon, revealSequence } from "./motion";
  import { selectionRail } from "./interaction-motion";
  import { surfaceFeedback } from "./surface-feedback";
  import type { ArchivePost, ArchiveSeries, ContributionActivitySnapshot } from "./types";
  import type { ContributionProject, ProfileConfig } from "../../types/config";

  export let posts: ArchivePost[];
  export let series: ArchiveSeries[];
  export let projects: ContributionProject[];
  export let activity: ContributionActivitySnapshot;
  export let detailsUrl: string;
  export let profile: ProfileConfig;

  import { contributionUrl, resolveContributionSelection } from "../../lib/contributions/navigation";
  import { sectionPaths, welcomePath, resolveOrbitalLocation, isWelcomeLocation, type Section } from "../../lib/content/navigation";
  import { createDeferredNavigation, WELCOME_RETURN_DURATION } from "../../lib/content/navigation-transition";
  export let initialSection: Section = "articles";
  export let initialSeries = "";
  export let initialProject = "";
  export let localePrefix = "";
  export let notFound = false;
  export let initialWelcome = false;
  export let hasArticle = false;
  let welcome = initialWelcome;
  let archiveArrival = false;
  let welcomeArrival = false;
  let returningToWelcome = false;
  let welcomePortal: WelcomePortal;
  let hydrated = false;
  let mainElement: HTMLElement;
  const navigation: { id: Section; label: string; icon: string; kicker: string; title: string }[] = [
    { id: "articles", label: t("文章"), icon: "article", kicker: t("写作 / 档案"), title: t("文章档案") },
    { id: "series", label: t("系列"), icon: "series", kicker: t("系列 / 目录"), title: t("探索路径") },
    { id: "graph", label: t("知识地图"), icon: "graph", kicker: t("知识 / 关联"), title: t("知识地图") },
    { id: "code", label: t("开源"), icon: "code", kicker: t("开源 / 实践"), title: t("代码与实践") },
    { id: "about", label: t("关于"), icon: "about", kicker: t("作者 / {v0}", { v0: profile.name.toUpperCase() }), title: t("关于我") },
  ];
  let section: Section = initialSection;
  let query = "";
  let category = "all";
  let seriesFilter = initialSeries;
  let returnPath = `${localePrefix}${sectionPaths.articles}`;
  let resetKey = 0;
  let reader: ArticleReader;
  let sourceProject = initialProject;
  let sourceRecord = "";
  let sourceKind = "all";
  let searchInput: HTMLInputElement;
  let systemReducedMotion = true;
  let effectsEnabled = true;
  let motionReady = false;
  let pageVisible = true;
  let notFoundPath = "";
  let readerOpen = false;
  let finePointer = false;
  let cameraX = 0;
  let cameraY = 0;
  let cameraFrame = 0;
  const welcomeReturn = createDeferredNavigation(finishWelcomeReturn, WELCOME_RETURN_DURATION);
  $: reducedMotion = systemReducedMotion || !effectsEnabled;
  $: if (reducedMotion) archiveArrival = false;
  $: if (reducedMotion && returningToWelcome) welcomeReturn.finish();
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
    const projectName = next === "code" ? projects.find((item) => item.id === sourceProject)?.name : "";
    const path = next === "code"
      ? contributionUrl(sourceProject || "", sourceRecord, sourceKind, localePrefix)
      : localePrefix + sectionPaths[next];
    if (window.location.pathname !== path || (!preserveQuery && window.location.search) || window.location.hash) history.pushState(null, "", path);
    document.title = `${projectName || navigation.find((item) => item.id === next)?.title} · Miao's Blog`;
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
      sourceProject = undefined;
      sourceRecord = "";
      sourceKind = "all";
    }
    setSection(next);
    if (next === "articles") resetFilters();
  }

  async function enterArchive(animated = false) {
    archiveArrival = animated && !reducedMotion;
    navigate("articles");
    await tick();
    window.scrollTo({ top: 0, behavior: "instant" });
    mainElement?.focus({ preventScroll: true });
  }

  function cancelWelcomeReturn() {
    welcomeReturn.cancel();
    returningToWelcome = false;
    welcomeArrival = false;
  }

  async function finishWelcomeReturn() {
    const animated = !reducedMotion;
    const path = localePrefix + welcomePath;
    if (window.location.pathname + window.location.search + window.location.hash !== path) history.pushState(null, "", path);
    restoreLocation();
    welcomeArrival = animated;
    resetCamera();
    await tick();
    window.scrollTo({ top: 0, behavior: "instant" });
    welcomePortal?.focusMain();
  }

  function returnToWelcome(event: MouseEvent) {
    if (notFound || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (welcome || returningToWelcome) return;
    returningToWelcome = true;
    archiveArrival = false;
    welcomeReturn.start(reducedMotion);
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

  async function search(value: string, submitted = false) {
    const fromWelcome = welcome;
    query = value;
    if (fromWelcome && !submitted) return;
    if (fromWelcome || section !== "articles") {
      category = "all";
    }
    seriesFilter = "";
    setSection("articles", true);
    storeFilters();
    if (fromWelcome) {
      await tick();
      searchInput?.focus({ preventScroll: true });
    }
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
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !readerOpen) {
      event.preventDefault();
      searchInput?.focus();
    }
  }

  function restoreLocation() {
      cancelWelcomeReturn();
      welcome = !notFound && isWelcomeLocation(window.location.pathname, window.location.search, localePrefix);
      if (welcome) {
        welcomePortal?.cancelDeparture();
        query = "";
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
          sourceProject = target.contributionProject;
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
        const locationTitle = notFound && window.location.pathname === notFoundPath
          ? t("页面未找到")
          : projectTitle || series.find((item) => item.slug === seriesFilter)?.title || navigation.find((item) => item.id === section)?.title;
        document.title = `${locationTitle} · Miao's Blog`;
      }
  }

  onMount(() => {
    hydrated = true;
    document.body.classList.add("orbital-ready");
    if (notFound) notFoundPath = window.location.pathname;
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
      cancelWelcomeReturn();
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
<div class="station-atmosphere" class:motion-running={motionReady && !reducedMotion} class:motion-idle={ambientPaused} style={`--camera-x:${cameraX}px;--camera-y:${cameraY}px`} aria-hidden="true">
  {#each [0, 1, 2, 3, 4] as mote}<span style={`--mote-x:${[19,39,66,83,94][mote]}%;--mote-y:${[73,40,83,33,65][mote]}%;--mote-time:${[13,17,19,15,21][mote]}s;--mote-delay:${mote * -3}s`}></span>{/each}
  {#each [0, 1, 2] as mote}<span class="atmosphere-near" style={`--mote-x:${[7,76,96][mote]}%;--mote-y:${[32,17,79][mote]}%;--mote-time:${[23,29,26][mote]}s;--mote-delay:${mote * -7}s`}></span>{/each}
  <i class="station-edge-signal"></i>
</div>
{#if welcome}
  <WelcomePortal bind:this={welcomePortal} bind:searchInput {query} onSearch={search} {localePrefix} {reducedMotion} {motionReady} {ambientPaused} {systemReducedMotion} {toggleMotion} {cameraX} {cameraY} arriving={welcomeArrival} onReturn={returnToWelcome} onEnter={enterArchive} author={profile.name}/>
{:else}
<a class="skip-link" href="#terminal-main">{t("跳到文章")}</a>

<div class="terminal-shell" use:surfaceFeedback={motionReady && !reducedMotion} class:station-arriving={archiveArrival} class:station-returning={returningToWelcome} inert={returningToWelcome} aria-busy={returningToWelcome} style={`--welcome-return-duration:${WELCOME_RETURN_DURATION}ms`} onanimationend={(event) => { if (event.target === event.currentTarget) archiveArrival = false; }} class:motion-ready={motionReady} class:motion-paused={reducedMotion} class:ambient-paused={ambientPaused} class:archive-view={section === 'articles'} class:series-view={section === 'series'} class:graph-view={section === 'graph'} class:source-view={section === 'code'} class:about-view={section === 'about'}>
  <svg class="terminal-orbit" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true"><g class="orbit-rail"><path d="M136 123C38 280 20 705 143 902"/><path d="M127 121C24 305 17 716 137 907"/><path class="orbit-transmission" d="M136 123C38 280 20 705 143 902" pathLength="1"/><circle cx="136" cy="123" r="5"/><circle cx="143" cy="902" r="5"/></g><path class="orbit-ground" d="M215 950H1450l75-75"/></svg>
  <SiteHeader {localePrefix} {reducedMotion} {query} bind:searchInput onReturn={returnToWelcome} onSearch={search}/>

  <div class="terminal-workspace">
    <aside class="terminal-sidebar">
      <p class="sidebar-label">{t("导航")}</p>
      <nav class="primary-nav" aria-label={t("主导航")} use:navigationBeacon={section}>
        <span class="nav-tracer" aria-hidden="true"></span>
        {#each navigation as item, index}
          <a href={localePrefix + sectionPaths[item.id]} class:active={section === item.id} aria-current={section === item.id ? "page" : undefined} onclick={(event) => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(item.id); }}>
            <TerminalIcon name={item.icon} size={20}/><span>{item.label}</span><small aria-hidden="true">{String(index + 1).padStart(2, "0")}</small>
          </a>
        {/each}
      </nav>
      <button class="sidebar-note author-entry" aria-label={t("关于作者：{v0}", { v0: profile.name })} onclick={openAuthor}>
        <span class="sidebar-avatar" aria-hidden="true">
          {#if profile.avatar}<img src={profile.avatar} alt="" width="180" height="180" decoding="async"/>{:else}<span>{profile.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</span>{/if}
        </span>
        <span class="sidebar-author-copy"><strong>{profile.name}</strong></span>
      </button>
    </aside>

    <main id="terminal-main" class="terminal-main" bind:this={mainElement} tabindex="-1" use:revealSequence={{key: section, enabled: motionReady && !reducedMotion, selector: ".project-port, .identity-field-copy, .identity-contact-text"}}>
      {#if notFound}<p class="route-notice" role="status">{t("没有找到这个页面。你可以从文章档案继续探索。")}</p>{/if}
      {#key section}
      <span class="section-transfer" data-section={section} aria-hidden="true"><i></i></span>
      <div class="archive-heading">
        <div><p class="terminal-kicker"><span></span>{activeSection.kicker}</p><svelte:element this={(!hydrated && hasArticle) || readerOpen ? "p" : "h1"} class="heading-title">{activeSection.title}<span class="heading-mark" aria-hidden="true">/</span></svelte:element>{#if descriptions[section]}<p class="heading-description">{descriptions[section]}</p>{/if}</div>
        {#if section === "articles"}
          <div class="category-tabs" aria-label={t("文章分类")} use:selectionRail={{key: category, enabled: motionReady && !reducedMotion}}>
            {#each [{ value: "all", label: t("全部") }, { value: "linux", label: "Linux" }, { value: "hardware", label: t("硬件设计") }] as tab}
              <button class:active={category === tab.value} aria-pressed={category === tab.value} onclick={() => { category = tab.value; seriesFilter = ""; setSection("articles"); storeFilters(); }}>{#if tab.value !== 'all'}<BrandIcon name={tab.value === 'linux' ? 'linux' : 'chip'} size={15} framed={false}/>{/if}{tab.label}</button>
            {/each}
            <span class="selection-rail" aria-hidden="true"></span>
          </div>
        {:else}<span class="section-coordinate">{t("Miao 的个人档案")}</span>{/if}
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

  <footer class="terminal-footer"><span>Miao's Blog <i>·</i> Chen Miao</span><span class="footer-line" aria-hidden="true"></span><button class="motion-control" aria-label={systemReducedMotion ? t("系统已减少动态效果") : effectsEnabled ? t("暂停页面动效") : t("开启页面动效")} aria-pressed={!reducedMotion} disabled={systemReducedMotion} onclick={toggleMotion} title={systemReducedMotion ? t("跟随系统的减少动态效果设置") : t("切换页面动效")}><TerminalIcon name={reducedMotion ? 'play' : 'pause'} size={13}/><span>{reducedMotion ? t("动效暂停") : t("动效开启")}</span></button><a class="feed-link" href={localePrefix === '/en' ? '/en/rss.xml' : '/rss.xml'}>{t("订阅更新")}</a></footer>
</div>

{/if}

<ArticleReader bind:this={reader} {reducedMotion} bind:readerOpen onClosed={readerClosed}/>
