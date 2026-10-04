<script lang="ts">
  import TerminalIcon from "./TerminalIcon.svelte";
  import BrandIcon from "./BrandIcon.svelte";
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
  const linkName = (name: string) => name === "Zhihu" ? "知乎" : name === "Email" ? "邮件" : name;
  const linkIcon = (link: ProfileConfig["links"][number]) => link.url.startsWith("mailto:") ? "mail" : link.name.toLowerCase();
</script>

<section class="identity-dossier" aria-label="个人档案">
  <header class="identity-register"><span><i aria-hidden="true"></i>PERSONAL ARCHIVE</span><span>笔记背后的记录者 <b aria-hidden="true">/ 05</b></span></header>

  <div class="identity-stage">
    <div class="portrait-apparatus">
      <svg class="portrait-orbit" viewBox="0 0 360 360" fill="none" aria-hidden="true">
        <circle cx="180" cy="180" r="150"/>
        <circle cx="180" cy="180" r="138" stroke-dasharray="1 10"/>
        <ellipse cx="180" cy="180" rx="171" ry="70" transform="rotate(-35 180 180)"/>
        <path d="M180 16V41M180 319V344M16 180H41M319 180H344"/>
        <g class="portrait-orbit-segment"><path d="M180 30A150 150 0 0 1 319 124M180 330A150 150 0 0 1 41 236"/><circle cx="319" cy="124" r="4"/></g>
      </svg>
      <div class="portrait-mount">
        <div class="portrait-image">{#if profile.avatar}<img src={profile.avatar} alt={`${profile.name} 的博客头像`} width="210" height="210"/>{:else}<span>{initials}</span>{/if}</div>
        <span class="portrait-bracket portrait-bracket-top" aria-hidden="true"></span><span class="portrait-bracket portrait-bracket-bottom" aria-hidden="true"></span>
      </div>
      <span class="portrait-coordinate" aria-hidden="true">PORTRAIT / AUTHOR</span>
      <p class="portrait-caption">{handle ? `@${handle}` : profile.name}<span aria-hidden="true"></span></p>
    </div>

    <div class="identity-introduction">
      <p class="identity-eyebrow">THE PERSON BEHIND THE NOTES</p>
      <h2>{profile.name}<span aria-hidden="true">_</span></h2>
      <p class="identity-statement">记录系统的<span>内部世界。</span></p>
      {#if profile.bio}<p class="identity-bio">{profile.bio}</p>{/if}
      <div class="identity-actions">
        <button class="identity-primary" onclick={() => onNavigate("articles")}>阅读我的文章<TerminalIcon name="external" size={20}/></button>
        <button class="identity-secondary" onclick={() => onNavigate("code")}>开源实践<TerminalIcon name="arrow" size={16}/></button>
      </div>
    </div>
  </div>

  <div class="identity-lower">
    <section class="identity-fields" aria-labelledby="identity-fields-heading">
      <header class="identity-section-title"><h3 id="identity-fields-heading">笔记里的方向</h3><span>FIELD NOTES</span></header>
      <button class="identity-field" onclick={() => onExplore("linux")}><BrandIcon name="linux"/><span class="identity-field-copy"><strong>操作系统</strong><small>Linux · 内存与文件系统</small></span><TerminalIcon name="arrow" size={18}/></button>
      <button class="identity-field" onclick={() => onExplore("hardware")}><BrandIcon name="chip"/><span class="identity-field-copy"><strong>硬件与底层架构</strong><small>RISC-V · Verilog / Chisel / BSV</small></span><TerminalIcon name="arrow" size={18}/></button>
      <button class="identity-field" onclick={() => onNavigate("code")}><BrandIcon name="code"/><span class="identity-field-copy"><strong>开源实践</strong><small>Linux · LLVM · Cargo</small></span><TerminalIcon name="arrow" size={18}/></button>
    </section>
    <section class="identity-contacts" aria-labelledby="identity-contacts-heading">
      <header class="identity-section-title"><h3 id="identity-contacts-heading">在其他地方</h3><span>ELSEWHERE</span></header>
      {#each profile.links as link}
        <a class="identity-contact" href={link.url} target={link.url.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer"><BrandIcon name={linkIcon(link)}/><span class="identity-contact-text"><strong>{linkName(link.name)}</strong><small>{linkDetail(link.url)}</small></span><TerminalIcon name="external" size={18}/></a>
      {/each}
    </section>
  </div>
  <div class="identity-signoff" aria-hidden="true"><span>SYSTEMS & NOTES</span><i></i><span>{initials}</span></div>
</section>
