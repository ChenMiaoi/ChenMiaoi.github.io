<script lang="ts">
  import { useTranslations } from "../../features/orbital/i18n/context";
  import { welcomePath } from "../../lib/content/navigation";
  import TerminalIcon from "./TerminalIcon.svelte";
  import BrandIcon from "./BrandIcon.svelte";
  import LanguageSwitcher from "./LanguageSwitcher.svelte";

  const { t } = useTranslations();
  export let localePrefix = "";
  export let reducedMotion = true;
  export let query = "";
  export let searchInput: HTMLInputElement | undefined = undefined;
  export let onReturn: (event: MouseEvent) => void;
  export let onSearch: (value: string, submitted?: boolean) => void;
</script>

<header class="terminal-header">
  <a class="brand" href={localePrefix + welcomePath} onclick={onReturn} aria-label={t("Miao's Blog，返回欢迎页")}>
    <img class="brand-mark" src="/images/orbital/miao-mark.svg" alt="" width="60" height="48"/>
    <span><strong>Miao's Blog</strong></span>
  </a>
  <span class="header-hairline" aria-hidden="true"><i></i><span>{t("个人档案库")}</span></span>
  <div class="header-tools">
    <LanguageSwitcher {reducedMotion}/>
    <form class="search-frame" role="search" onsubmit={(event) => { event.preventDefault(); onSearch(query, true); }}>
      <TerminalIcon name="search" size={20}/>
      <input bind:this={searchInput} value={query} oninput={(event) => onSearch(event.currentTarget.value)} aria-label={t("搜索文章")} placeholder={t("搜索文章")} type="search" autocomplete="off" />
      <kbd>Ctrl K</kbd>
    </form>
    <a class="github-link" href="https://github.com/ChenMiaoi" target="_blank" rel="noreferrer"><BrandIcon name="github" size={18} framed={false}/>GitHub <TerminalIcon name="external" size={17}/></a>
  </div>
</header>
