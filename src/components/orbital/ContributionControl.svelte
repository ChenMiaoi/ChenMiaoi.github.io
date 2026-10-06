<script lang="ts">
  import { useTranslations } from "../../features/orbital/i18n/context";
  import { contributionOverview } from "../../lib/contributions/overview";
  import type { ContributionProject } from "../../types/config";
  import type { ContributionActivitySnapshot, ContributionDetailsSnapshot } from "./types";
  import BrandIcon from "./BrandIcon.svelte";
  import TerminalIcon from "./TerminalIcon.svelte";
  const { t } = useTranslations();
  export let projects: ContributionProject[];
  export let activity: ContributionActivitySnapshot;
  export let details: ContributionDetailsSnapshot;
  export let loading = false;
  export let failed = false;
  export let onOpen: (project: string, record: string) => void;
  let sectorId = "all";
  let tab: "active" | "archive" = "active";
  let focusedId = "";
  $: overview = contributionOverview(projects, activity, details);
  $: selectedSectors = overview.sectors.filter((sector) => sectorId === "all" || sector.project.id === sectorId);
  $: totals = selectedSectors.reduce((sum, sector) => ({ issues: sum.issues + sector.issues, prs: sum.prs + sector.prs, active: sum.active + sector.active, commits: sum.commits + sector.commits, unknown: sum.unknown + sector.unknown }), { issues: 0, prs: 0, active: 0, commits: 0, unknown: 0 });
  $: records = overview.records.filter((record) => sectorId === "all" || record.projectId === sectorId);
  $: activeCount = records.filter((record) => record.state === "open" || record.state === "draft").length;
  $: missions = records.filter((record) => tab === "active" ? record.state === "open" || record.state === "draft" : ["merged", "closed", "commit"].includes(record.state));
  $: focusedMission = missions.find((mission) => (mission.url ?? mission.id) === focusedId) ?? missions[0];
  $: focusedDetail = focusedMission ? details.records.find((detail) => detail.url === focusedMission.url) : undefined;
  const pad = (value: number) => String(value).padStart(2, "0");
  const status = (value: string) => ({ open: t("进行中"), draft: t("草稿"), merged: t("已合并"), closed: t("已关闭"), commit: t("提交记录") } as Record<string, string>)[value];
  const relation = (relations?: string[]) => relations?.includes("author") ? t("我发起") : relations?.includes("assignee") ? t("指派给我") : relations?.includes("commenter") ? t("我参与讨论") : t("提交记录");
  const chapterNames: Record<string, string> = { linux: t("内核 / 系统"), "llvm-project": t("编译器 / 工具链"), cargo: t("构建 / 包管理") };
  const coverPosition: Record<string, string> = { linux: "0%", "llvm-project": "50%", cargo: "100%" };
  const projectLabel = (id: string, name: string) => id === "llvm-project" ? "LLVM" : name;
</script>

<section class="mission-control" aria-label={t("开源任务控制台")}>
  <div class="mission-crown"><span><i aria-hidden="true"></i>{t("贡献档案")}</span><span>{activity.account} <b aria-hidden="true">//</b> {t("{v0} 个项目", { v0: pad(projects.length) })}</span></div>
  <div class="mission-metrics" aria-label={t("协作统计")} aria-live="polite" aria-atomic="true">
    <div><strong>{pad(totals.issues)}</strong><span>{t("参与 Issue")}</span></div>
    <div><strong>{pad(totals.prs)}</strong><span>{t("收录 PR")}</span></div>
    <div><strong>{pad(totals.active)}</strong><span>{t("当前协作")}</span></div>
    <div><strong>{pad(totals.commits)}</strong><span>{t("收录提交")}</span></div>
  </div>
  <div class="mission-chapters" role="group" aria-label={t("分项目统计")}>
    {#each overview.sectors as sector, index (sector.project.id)}
      <button class="mission-chapter" class:chapter-selected={sectorId === sector.project.id} aria-label={t("选择项目：{v0}", {v0: sector.project.name})} aria-pressed={sectorId === sector.project.id} style={`--cover-position:${coverPosition[sector.project.id] ?? '50%'}`} onclick={() => sectorId = sectorId === sector.project.id ? "all" : sector.project.id}>
        <span class="chapter-art" aria-hidden="true"></span>
        <span class="chapter-number" aria-hidden="true">{pad(index + 1)}</span>
        <span class="chapter-symbol" aria-hidden="true"><BrandIcon name={sector.project.id} size={20} framed={false}/></span>
        <span class="chapter-caption"><span class="chapter-category">{chapterNames[sector.project.id] ?? t("开源")}</span><strong>{projectLabel(sector.project.id, sector.project.name)}</strong><span class="chapter-counts">{#if sector.issues}<span>{pad(sector.issues)} Issue</span>{/if}{#if sector.prs}<span>{pad(sector.prs)} PR</span>{/if}{#if sector.commits}<span>{pad(sector.commits)} {t("提交记录")}</span>{/if}</span></span>
      </button>
    {/each}
  </div>
  <div class="mission-workspace">
    <section class="mission-queue" aria-label={t("协作任务列表")}>
      <header class="mission-queue-heading"><div class="mission-tabs" role="group" aria-label={t("选择任务队列")}><button aria-pressed={tab === 'active'} onclick={() => tab = 'active'}>{t("当前协作")} <span>{activeCount}</span></button><button aria-pressed={tab === 'archive'} onclick={() => tab = 'archive'}>{t("成果档案")}</button></div><span>{t("{v0} 条记录", { v0: pad(missions.length) })}</span></header>
      <div class="mission-log-scroll" tabindex="0" role="region" aria-label={t("协作任务列表")}>
        {#each missions as mission (mission.url ?? mission.id)}
          <button class="mission-entry" aria-pressed={focusedMission?.url === mission.url && focusedMission?.id === mission.id} onclick={() => focusedId = mission.url ?? mission.id}>
            <span class="mission-kind" aria-hidden="true"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d={mission.kind === 'issue' ? 'M4 4h16v12H12l-4 4v-4H4z M8 8h1m3 0h1m3 0h1' : mission.kind === 'pr' ? 'M6 7v10 M6 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M6 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M18 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M18 17V9c0-3-3-4-6-4 m3-3-3 3 3 3' : 'M3 12h5m8 0h5 M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0'}/></svg></span>
            <span class="mission-entry-body"><span class="mission-entry-meta"><code>{mission.kind === 'commit' ? mission.reference.slice(0, 10) : mission.reference}</code><span>{sectorId === 'all' ? mission.projectName : status(mission.state)}</span></span><strong>{mission.title}</strong></span>
            <TerminalIcon name="arrow" size={14}/>
          </button>
        {:else}<div class="mission-no-records"><span aria-hidden="true">◇</span><p>{loading ? t("正在读取记录内容…") : failed ? t("记录内容暂时无法读取。") : t("当前分区暂无此类记录。")}</p></div>{/each}
      </div>
    </section>
    <section class="mission-briefing" aria-label={t("任务简报")}>
      <header class="briefing-heading"><h2>{t("任务简报")}</h2><span>{t("记录 / 详情")}</span></header>
      <div class="mission-focus">
        {#if focusedMission}
          <p class="focus-project">{focusedMission.projectName}</p><h3>{focusedMission.title}</h3>
          <div class="focus-reference"><code>{focusedMission.kind === 'commit' ? focusedMission.reference.slice(0, 10) : focusedMission.reference}</code><span class={`mission-state state-${focusedMission.state}`}>{status(focusedMission.state)}</span></div>
          <dl class="focus-facts"><div><dt>{t("我的参与")}</dt><dd>{relation(focusedMission.relations)}</dd></div><div><dt>{t("更新于")}</dt><dd><time datetime={focusedMission.date}>{focusedMission.date.slice(0, 10)}</time></dd></div>{#if focusedDetail}<div><dt>{t("讨论记录")}</dt><dd>{focusedDetail.commentsTotal}</dd></div>{/if}</dl>

        {:else}<p class="mission-briefing-empty">{t("选择项目，查看协作任务。")}</p>{/if}
      </div>
      {#if focusedMission}<button class="mission-open" onclick={() => onOpen(focusedMission.projectId, focusedMission.id)}>{t("查看这条记录")}<TerminalIcon name="external" size={15}/></button>{/if}
    </section>
  </div>
</section>
