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
  export let onEnter: () => void;
  let departing = false;
  let departureTimer: ReturnType<typeof setTimeout> | undefined;
  $: archiveUrl = localePrefix + sectionPaths.articles;

  function enter(event: MouseEvent, immediate = false) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (departing) return;
    if (reducedMotion || immediate) { onEnter(); return; }
    departing = true;
    departureTimer = setTimeout(onEnter, 520);
  }

  onDestroy(() => clearTimeout(departureTimer));
</script>

<div class="welcome-portal" class:portal-moving={motionReady && !reducedMotion} class:portal-idle={ambientPaused} class:portal-departing={departing}>
  <div class="portal-grid" aria-hidden="true"></div>
  <header class="portal-header">
    <a class="brand portal-brand" href={archiveUrl} onclick={(event) => enter(event, true)} aria-label={t("Miao's Blog，进入文章档案")}>
      <svg class="brand-mark" viewBox="0 0 52 52" aria-hidden="true"><path d="M35 4h10L17 36H7zM19 30h9L12 48H2z" fill="currentColor"/><path d="M34 29h12L31 47H19z" fill="#f0e433"/></svg>
      <span><strong>Miao's Blog</strong><small>SYSTEMS & NOTES</small></span>
    </a>
    <span class="portal-header-label" aria-hidden="true"><i></i> A PERSONAL SPACE FOR EXPLORATION</span>
    <a class="portal-skip" href={archiveUrl} onclick={(event) => enter(event, true)}>{t("直接进入")} <TerminalIcon name="arrow" size={16}/></a>
    <LanguageSwitcher {reducedMotion}/>
  </header>

  <main class="portal-main">
    <div class="portal-copy">
      <p class="portal-eyebrow"><span></span> HELLO, EXPLORER <i>/</i> {t("欢迎登站")}</p>
      <h1>{t("原天地之美")}<br/>{t("而达")}<span>{t("万物之理")}</span><b aria-hidden="true">。</b></h1>
      <div class="portal-action-row">
        <a class="portal-enter" href={archiveUrl} onclick={enter} aria-label={t("进入档案")}>
          <span class="portal-enter-index" aria-hidden="true">↗</span>
          <span><strong>{t("进入档案")}</strong><small>ENTER THE ARCHIVE</small></span>
          <TerminalIcon name="arrow" size={23}/>
        </a>
        <span class="portal-action-note">{t("保持好奇")}<br/><span>KEEP EXPLORING</span></span>
      </div>
      <p class="portal-signature"><span></span> {author} <i>/</i> Let me drive your world.</p>
    </div>

    <div class="portal-instrument" aria-hidden="true">
      <span class="portal-orbit-caption">THE WORLD BENEATH THE CODE</span>
      <svg class="portal-orbits" viewBox="0 0 640 640" fill="none">
        <defs>
          <radialGradient id="portal-core-glow"><stop stop-color="#e7ef8a" stop-opacity=".13"/><stop offset="1" stop-color="#d9e9ae" stop-opacity="0"/></radialGradient>
          <linearGradient id="portal-orbit-light" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f0e433"/><stop offset=".6" stop-color="#c5d5bd" stop-opacity=".1"/><stop offset="1" stop-color="#f0e433" stop-opacity=".65"/></linearGradient>
        </defs>
        <circle cx="320" cy="320" r="258" fill="url(#portal-core-glow)" stroke="#bfd0c3" stroke-opacity=".16"/>
        <circle cx="320" cy="320" r="282" stroke="#bfd0c3" stroke-opacity=".12"/>
        <path d="M320 15v38m0 534v38M15 320h38m534 0h38" stroke="#b7c8bb" stroke-opacity=".6"/>
        <path d="M112 112l20 20m376 376 20 20M112 528l20-20m376-376 20-20" stroke="#b7c8bb" stroke-opacity=".25"/>
        <g class="portal-outer-ring">
          <circle cx="320" cy="320" r="274" stroke="#c0cdba" stroke-opacity=".4" stroke-width="4" stroke-dasharray="1 17"/>
          <circle cx="320" cy="320" r="258" stroke="url(#portal-orbit-light)" stroke-width="2" stroke-dasharray="260 1360" transform="rotate(-74 320 320)"/>
          <circle cx="389" cy="71" r="5" fill="#f0e433"/>
          <circle cx="389" cy="71" r="12" stroke="#f0e433" stroke-opacity=".35"/>
        </g>
        <g class="portal-inner-ring">
          <circle cx="320" cy="320" r="201" stroke="#b7c8bb" stroke-opacity=".2" stroke-dasharray="2 9"/>
          <path d="M136 256a195 195 0 0 1 274-107M504 384a195 195 0 0 1-274 107" stroke="#bccdb4" stroke-opacity=".65"/>
          <circle cx="134" cy="381" r="3" fill="#f0e433"/>
        </g>
        <ellipse cx="320" cy="320" rx="305" ry="103" transform="rotate(-35 320 320)" stroke="#c9d5b5" stroke-opacity=".3"/>
        <path d="M165 356v-46l25-25h43m174 0h43l25 25v46M165 390v13l25 25h43m174 0h43l25-25v-13" stroke="#d3dfb7" stroke-opacity=".5"/>
        <path d="M220 320h32m136 0h32M320 216v29m0 158v21" stroke="#d3dfb7" stroke-opacity=".45"/>
        <path d="M338 260h29l-87 101h-29zm-49 83h26l-46 53h-28z" fill="#edf1e6"/>
        <path d="M337 340h34l-43 52h-34z" fill="#f0e433"/>
        <circle cx="563" cy="407" r="4" fill="#d4ddba"/>
        <path d="M563 407h43l19 19M120 171H69l-22-22" stroke="#cbd6b9" stroke-opacity=".5"/>
      </svg>
      <span class="portal-orbit-word">ORBITAL</span>
      <span class="portal-orbit-subtitle">NOTES FROM THE INNER UNIVERSE</span>
      <span class="portal-coordinate coordinate-top">01 <i>/</i> SYSTEMS</span>
      <span class="portal-coordinate coordinate-bottom">∞ <i>/</i> CURIOSITY</span>
    </div>
  </main>

  <footer class="portal-footer">
    <span>{t("一个人的探索，也期待与你相遇。")}</span>
    <span class="portal-footer-index" aria-hidden="true">MIAO / PERSONAL ARCHIVE</span>
    <button class="motion-control" aria-label={systemReducedMotion ? t("系统已减少动态效果") : reducedMotion ? t("开启页面动效") : t("暂停页面动效")} aria-pressed={!reducedMotion} disabled={systemReducedMotion} onclick={toggleMotion}><TerminalIcon name={reducedMotion ? 'play' : 'pause'} size={13}/><span>{reducedMotion ? t("动效暂停") : t("动效开启")}</span></button>
  </footer>
</div>
