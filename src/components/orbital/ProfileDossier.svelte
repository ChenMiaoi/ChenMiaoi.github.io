<script lang="ts">
  import { useTranslations } from "../../features/orbital/i18n/context";
  const { t } = useTranslations();
  import TerminalIcon from "./TerminalIcon.svelte";
  import BrandIcon from "./BrandIcon.svelte";
  import InteractionGlow from "./InteractionGlow.svelte";
  import type { ProfileConfig } from "../../types/config";

  export let profile: ProfileConfig;
  export let onNavigate: (section: "articles" | "code") => void;
  export let onExplore: (category: "linux" | "hardware") => void;

  $: github = profile.links.find((link) => link.url.startsWith("https://github.com/"));
  $: handle = github?.url.replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "");
  $: initials = profile.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2);

  function linkDetail(url: string) {
    if (url.startsWith("mailto:")) return url.slice(7);
    try {
      const address = new URL(url);
      if (address.hostname === "github.com") return `@${address.pathname.split("/").filter(Boolean)[0]}`;
      if (address.hostname.endsWith("zhihu.com")) return address.pathname.split("/").filter(Boolean)[1] || address.hostname;
      return address.hostname;
    } catch { return url; }
  }
  const linkName = (name: string) => name === "Zhihu" ? t("知乎") : name === "Email" ? t("邮件") : name;
  const linkIcon = (link: ProfileConfig["links"][number]) => link.url.startsWith("mailto:") ? "mail" : link.name.toLowerCase();
</script>

<section class="identity-dossier" aria-label={t("个人档案")}>
  <header class="identity-register"><span><i aria-hidden="true"></i>{t("个人档案库")}</span><span>{t("笔记背后的记录者")} <b aria-hidden="true">/ 05</b></span></header>

  <div class="identity-stage">
    <div class="portrait-apparatus">
      <svg class="portrait-orbit" viewBox="0 0 360 360" fill="none" aria-hidden="true">
        <circle cx="180" cy="180" r="150"/>
        <circle cx="180" cy="180" r="138" stroke-dasharray="1 10"/>
        <ellipse cx="180" cy="180" rx="171" ry="70" transform="rotate(-35 180 180)"/>
        <path d="M180 16V41M180 319V344M16 180H41M319 180H344"/>
        <g class="portrait-orbit-segment"><path d="M180 30A150 150 0 0 1 319 124M180 330A150 150 0 0 1 41 236"/><circle cx="319" cy="124" r="4"/></g>
      </svg>
      <div class="portrait-mount" data-feedback>
        <InteractionGlow/>
        <div class="portrait-image">{#if profile.avatar}<img src={profile.avatar} alt={t("{v0} 的博客头像", { v0: profile.name })} width="210" height="210"/>{:else}<span>{initials}</span>{/if}</div>
        <span class="portrait-bracket portrait-bracket-top" aria-hidden="true"></span><span class="portrait-bracket portrait-bracket-bottom" aria-hidden="true"></span>
      </div>
      <p class="portrait-caption">{handle ? `@${handle}` : profile.name}<span aria-hidden="true"></span></p>
    </div>

    <div class="identity-introduction">
      <h2>{profile.name}<span class="identity-cursor" aria-hidden="true">_</span></h2>
      <p class="identity-statement">{t("记录系统的")}<span>{t("内部世界。")}</span></p>
      {#if profile.bio}<p class="identity-bio">{profile.bio}</p>{/if}
      {#if profile.affiliations?.length}
        <ul class="identity-affiliations" aria-label={t("个人经历")}>
          {#each profile.affiliations as entry}
            <li class="identity-affiliation">
              <div class="identity-affiliation-copy">
                <span class="identity-affiliation-institution">{entry.institution}</span>
                {#if entry.role}<span class="identity-affiliation-role"><span>{entry.role}</span>{#if entry.department}<span class="identity-affiliation-department">[{entry.department}]</span>{/if}</span>{/if}
              </div>
              <span class="identity-affiliation-period"><time datetime={entry.start}>{entry.start.replace('-', '/')}</time><span aria-hidden="true">—</span>{#if entry.end}<time datetime={entry.end}>{entry.end.replace('-', '/')}</time>{:else}<span class="identity-affiliation-present">{t("至今")}</span>{/if}</span>
            </li>
          {/each}
        </ul>
      {/if}
      <div class="identity-actions">
        <button class="identity-primary" data-feedback onclick={() => onNavigate("articles")}><InteractionGlow/>{t("阅读我的文章")}<TerminalIcon name="external" size={20}/></button>
        <button class="identity-secondary" data-feedback onclick={() => onNavigate("code")}><InteractionGlow/>{t("开源实践")}<TerminalIcon name="arrow" size={16}/></button>
      </div>
    </div>
  </div>

  <div class="identity-lower">
    <section class="identity-fields" aria-labelledby="identity-fields-heading">
      <header class="identity-section-title"><h3 id="identity-fields-heading">{t("笔记里的方向")}</h3><span>{t("领域笔记")}</span></header>
      <button class="identity-field" data-feedback onclick={() => onExplore("linux")}><InteractionGlow/><BrandIcon name="linux"/><span class="identity-field-copy"><strong>{t("操作系统")}</strong><small>{t("Linux · 内存与文件系统")}</small></span><TerminalIcon name="arrow" size={18}/></button>
      <button class="identity-field" data-feedback onclick={() => onExplore("hardware")}><InteractionGlow/><BrandIcon name="chip"/><span class="identity-field-copy"><strong>{t("硬件与底层架构")}</strong><small>RISC-V · Verilog / Chisel / BSV</small></span><TerminalIcon name="arrow" size={18}/></button>
      <button class="identity-field" data-feedback onclick={() => onNavigate("code")}><InteractionGlow/><BrandIcon name="code"/><span class="identity-field-copy"><strong>{t("开源实践")}</strong><small>Linux · LLVM · Cargo</small></span><TerminalIcon name="arrow" size={18}/></button>
    </section>
    <section class="identity-contacts" aria-labelledby="identity-contacts-heading">
      <header class="identity-section-title"><h3 id="identity-contacts-heading">{t("在其他地方")}</h3><span>{t("其他平台")}</span></header>
      {#each profile.links as link}
        <a class="identity-contact" data-feedback href={link.url} target={link.url.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer"><InteractionGlow/><BrandIcon name={linkIcon(link)}/><span class="identity-contact-text"><strong>{linkName(link.name)}</strong><small>{linkDetail(link.url)}</small></span><TerminalIcon name="external" size={18}/></a>
      {/each}
    </section>
  </div>
  <div class="identity-signoff" aria-hidden="true"><span>{t("系统与笔记")}</span><i></i><span>{initials}</span></div>
</section>
