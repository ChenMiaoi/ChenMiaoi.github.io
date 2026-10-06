<script lang="ts">
  import { useTranslations } from "../../features/orbital/i18n/context";
  const { t } = useTranslations();
  import { onDestroy } from "svelte";
  import TerminalIcon from "./TerminalIcon.svelte";
  import LanguageSwitcher from "./LanguageSwitcher.svelte";
  import { sectionPaths } from "../../lib/content/navigation";

  export let localePrefix = "";
  export let author: string;
  export let reducedMotion = true;
  export let motionReady = false;
  export let ambientPaused = false;
  export let systemReducedMotion = true;
  export let toggleMotion: () => void;
  export let onEnter: (animated?: boolean) => void;
  export let cameraX = 0;
  export let cameraY = 0;
  let departing = false;
  let departureTimer: ReturnType<typeof setTimeout> | undefined;
  $: archiveUrl = localePrefix + sectionPaths.articles;
  $: if (departing && reducedMotion) {
    clearTimeout(departureTimer);
    onEnter();
  }

  function enter(event: MouseEvent, immediate = false) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (departing) return;
    if (reducedMotion || immediate) { onEnter(); return; }
    departing = true;
    departureTimer = setTimeout(() => onEnter(true), 680);
  }

  onDestroy(() => clearTimeout(departureTimer));
</script>

<div class="welcome-portal" class:portal-moving={motionReady && !reducedMotion} class:portal-idle={ambientPaused} class:portal-departing={departing} style={`--instrument-x:${reducedMotion ? 0 : cameraX}px;--instrument-y:${reducedMotion ? 0 : cameraY}px`}>
  <div class="portal-grid" aria-hidden="true"></div>
  <header class="portal-header">
    <a class="brand portal-brand" href={archiveUrl} onclick={(event) => enter(event, true)} aria-label={t("Miao's Blog，进入文章档案")}>
      <img class="brand-mark" src="/images/orbital/miao-mark.svg" alt="" width="60" height="48"/>
      <span><strong>Miao's Blog</strong></span>
    </a>
    <span class="portal-header-label" aria-hidden="true"><i></i> {t("个人的探索空间")}</span>
    <a class="portal-skip" href={archiveUrl} onclick={(event) => enter(event, true)}>{t("直接进入")} <TerminalIcon name="arrow" size={16}/></a>
    <LanguageSwitcher {reducedMotion}/>
  </header>

  <main class="portal-main">
    <div class="portal-copy">
      <p class="portal-eyebrow"><span></span> {t("你好，探索者")} <i>/</i> {t("欢迎登站")}</p>
      <h1>{t("原天地之美")}<br/>{t("而达")}<span>{t("万物之理")}</span><b aria-hidden="true">{t("。")}</b></h1>
      <div class="portal-action-row">
        <a class="portal-enter" href={archiveUrl} onclick={enter} aria-label={t("进入档案")}>
          <span class="portal-enter-index" aria-hidden="true">↗</span>
          <span><strong>{t("进入档案")}</strong></span>
          <TerminalIcon name="arrow" size={23}/>
        </a>
        <span class="portal-action-note">{t("保持好奇")}<br/><span>{t("继续探索")}</span></span>
      </div>
      <p class="portal-signature"><span></span> {author} <i>/</i> {t("让我驱动你的世界。")}</p>
    </div>

    <div class="portal-instrument" aria-hidden="true">
      <span class="portal-orbit-caption">{t("代码之下的世界")}</span>
      <svg class="portal-orbits" viewBox="0 0 640 640" fill="none">
        <defs>
          <radialGradient id="portal-core-glow"><stop stop-color="#e7ef8a" stop-opacity=".13"/><stop offset="1" stop-color="#d9e9ae" stop-opacity="0"/></radialGradient>
          <linearGradient id="portal-orbit-light" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f0e433"/><stop offset=".6" stop-color="#c5d5bd" stop-opacity=".1"/><stop offset="1" stop-color="#f0e433" stop-opacity=".65"/></linearGradient>
        </defs>
        <circle cx="320" cy="320" r="258" fill="url(#portal-core-glow)" stroke="#bfd0c3" stroke-opacity=".16"/>
        <circle cx="320" cy="320" r="282" stroke="#bfd0c3" stroke-opacity=".12"/>
        <path d="M320 15v38m0 534v38M15 320h38m534 0h38" stroke="#b7c8bb" stroke-opacity=".6"/>
        <path d="M112 112l20 20m376 376 20 20M112 528l20-20m376-376 20-20" stroke="#b7c8bb" stroke-opacity=".25"/>
        <g class="portal-depth-outer"><g class="portal-outer-ring">
          <circle cx="320" cy="320" r="274" stroke="#c0cdba" stroke-opacity=".4" stroke-width="4" stroke-dasharray="1 17"/>
          <circle cx="320" cy="320" r="258" stroke="url(#portal-orbit-light)" stroke-width="2" stroke-dasharray="260 1360" transform="rotate(-74 320 320)"/>
          <circle cx="389" cy="71" r="5" fill="#f0e433"/>
          <circle cx="389" cy="71" r="12" stroke="#f0e433" stroke-opacity=".35"/>
        </g></g>
        <g class="portal-depth-inner"><g class="portal-inner-ring">
          <circle cx="320" cy="320" r="201" stroke="#b7c8bb" stroke-opacity=".2" stroke-dasharray="2 9"/>
          <path d="M136 256a195 195 0 0 1 274-107M504 384a195 195 0 0 1-274 107" stroke="#bccdb4" stroke-opacity=".65"/>
          <circle cx="134" cy="381" r="3" fill="#f0e433"/>
        </g></g>
        <g class="portal-orbital-signal">
          <ellipse cx="320" cy="320" rx="305" ry="103" transform="rotate(-35 320 320)" pathLength="1"/>
        </g>
        <ellipse cx="320" cy="320" rx="305" ry="103" transform="rotate(-35 320 320)" stroke="#c9d5b5" stroke-opacity=".3"/>
        <g class="portal-depth-core">
        <circle class="portal-core-halo" cx="320" cy="320" r="115" fill="url(#portal-core-glow)"/>
        <circle class="portal-lock-ring" cx="320" cy="320" r="129" stroke="#f0e433" stroke-dasharray="32 170"/>
        <path class="portal-reticle" d="M165 356v-46l25-25h43m174 0h43l25 25v46M165 390v13l25 25h43m174 0h43l25-25v-13" stroke="#d3dfb7" stroke-opacity=".5"/>
        <path d="M220 320h32m136 0h32M320 216v29m0 158v21" stroke="#d3dfb7" stroke-opacity=".45"/>
        <image class="portal-emblem" href="/images/orbital/miao-mark.svg" x="225" y="246" width="190" height="152"/>
        </g>
        <circle cx="563" cy="407" r="4" fill="#d4ddba"/>
        <path d="M563 407h43l19 19M120 171H69l-22-22" stroke="#cbd6b9" stroke-opacity=".5"/>
      </svg>
      <span class="portal-orbit-word">ORBITAL</span>
      <span class="portal-orbit-subtitle">{t("内部世界的笔记")}</span>
      <span class="portal-coordinate coordinate-top">01 <i>/</i> {t("系统")}</span>
      <span class="portal-coordinate coordinate-bottom">∞ <i>/</i> {t("好奇心")}</span>
    </div>
  </main>

  <footer class="portal-footer">
    <span>{t("一个人的探索，也期待与你相遇。")}</span>
    <span class="portal-footer-index" aria-hidden="true">{t("Miao / 个人档案")}</span>
    <button class="motion-control" aria-label={systemReducedMotion ? t("系统已减少动态效果") : reducedMotion ? t("开启页面动效") : t("暂停页面动效")} aria-pressed={!reducedMotion} disabled={systemReducedMotion} onclick={toggleMotion}><TerminalIcon name={reducedMotion ? 'play' : 'pause'} size={13}/><span>{reducedMotion ? t("动效暂停") : t("动效开启")}</span></button>
  </footer>
</div>
