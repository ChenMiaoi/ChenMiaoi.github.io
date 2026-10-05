<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { LOCALES, LOCALE_NAMES, LOCALE_PREFIX, htmlLang, type Locale } from "../../constants/locales";
  import { languageUrl } from "../../features/orbital/i18n";
  import { useTranslations } from "../../features/orbital/i18n/context";

  import TerminalIcon from "./TerminalIcon.svelte";
  export let reducedMotion = true;
  const { t, locale } = useTranslations();
  const codes: Record<Locale, string> = { zh_CN: "CN", en: "EN", zh_TW: "TW", ja: "JP" };
  let currentLocation = `${LOCALE_PREFIX[locale]}/`;
  let expanded = false;
  let switching: Locale | undefined;
  let trigger: HTMLButtonElement;
  let panel: HTMLElement;
  let container: HTMLDivElement;
  let departure: ReturnType<typeof setTimeout> | undefined;
  function updateLocation() {
    currentLocation = window.location.pathname + window.location.search + window.location.hash;
  }
  async function toggle() {
    updateLocation();
    expanded = !expanded;
    if (expanded) { await tick(); panel?.querySelector<HTMLAnchorElement>('[aria-current="true"]')?.focus(); }
  }
  function close(returnFocus = false) {
    expanded = false;
    if (returnFocus) trigger?.focus();
  }
  function keydown(event: KeyboardEvent) {
    if (!expanded || !container?.contains(document.activeElement)) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const links = [...panel.querySelectorAll<HTMLAnchorElement>('a')];
      const index = links.indexOf(document.activeElement as HTMLAnchorElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
      links[next]?.focus();
    }
  }
  function select(event: MouseEvent, target: Locale) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (target === locale) { event.preventDefault(); close(true); return; }
    if (reducedMotion) return;
    event.preventDefault();
    if (switching) return;
    switching = target;
    departure = setTimeout(() => window.location.assign(languageUrl(currentLocation, target)), 240);
  }
  onMount(updateLocation);
  onDestroy(() => clearTimeout(departure));
</script>

<svelte:window onpopstate={() => { updateLocation(); close(); }} onkeydown={keydown}/>
<svelte:document onclick={(event) => { if (event.target instanceof Node && !container?.contains(event.target)) close(); }}/>

<div class="language-switcher" class:language-expanded={expanded} class:language-static={reducedMotion} bind:this={container}>
  <button class="language-toggle" bind:this={trigger} aria-label={t("选择语言")} aria-expanded={expanded} onclick={toggle}>
    <svg class="language-orbit" viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="10"/><ellipse class="language-orbit-ring" cx="16" cy="16" rx="14" ry="5" transform="rotate(-35 16 16)"/><path d="M16 6c-6 5-6 15 0 20M16 6c6 5 6 15 0 20M6 16h20"/><circle class="language-satellite" cx="27" cy="9" r="2"/></svg>
    <span class="language-current"><small>{codes[locale]}</small><span>{LOCALE_NAMES[locale]}</span></span>
    <span class="language-chevron" aria-hidden="true"><TerminalIcon name="arrow" size={12}/></span>
  </button>
  {#if expanded}
    <nav class="language-options" bind:this={panel} aria-label={t("选择语言")} onfocusout={(event) => { if (event.relatedTarget instanceof Node && !container.contains(event.relatedTarget)) close(); }}>
      <header class="language-panel-heading"><span>{t("选择语言")}</span><small aria-hidden="true">LOCALE / 04</small></header>
      <div class="language-channels">
        {#each LOCALES as target, index}
          <a class:language-tuning={switching === target} href={languageUrl(currentLocation, target)} lang={htmlLang(target)} hreflang={htmlLang(target)} aria-current={target === locale ? "true" : undefined} aria-label={LOCALE_NAMES[target]} style={`--channel-index:${index}`} onclick={(event) => select(event, target)}>
            <span class="language-channel-code" aria-hidden="true">{codes[target]}</span>
            <span class="language-channel-copy"><strong>{LOCALE_NAMES[target]}</strong><small>{htmlLang(target)}</small></span>
            {#if target === locale}<span class="language-active-point" aria-hidden="true"></span>{:else}<TerminalIcon name="arrow" size={15}/>{/if}
          </a>
        {/each}
      </div>
      <footer class="language-panel-footer"><span aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span>{t("保留当前页面")}</span></footer>
    </nav>
  {/if}
</div>
{#if switching}
  <div class="language-transfer" role="status" aria-live="polite">
    <div class="language-transfer-grid" aria-hidden="true"></div>
    <div class="language-transfer-core"><span class="language-transfer-ring" aria-hidden="true"></span><small aria-hidden="true">{codes[locale]} <span>→</span> {codes[switching]}</small><strong>{LOCALE_NAMES[switching]}</strong><p>{t("正在切换到 {v0}", { v0: LOCALE_NAMES[switching] })}</p><span class="language-transfer-meter" aria-hidden="true"></span></div>
  </div>
{/if}
