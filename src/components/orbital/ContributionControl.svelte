<script lang="ts">
import { useTranslations } from "../../features/orbital/i18n/context";
import {
	contributionOverview,
	contributionQueue,
	type ContributionKindFilter,
	type ContributionQueue,
} from "../../lib/contributions/overview";
import {
	checkPresentation,
	conflictPresentation,
	recordPresentation,
	reviewPresentation,
} from "../../lib/contributions/presentation";
import { conflictState, summarizeChecks } from "../../lib/contributions/checks";
import { resolveReviewSummary } from "../../lib/contributions/reviews";
import { linkedContributions } from "../../lib/contributions/links";
import { projectTone } from "../../features/orbital/topic-colors";
import ContributionIcon from "./ContributionIcon.svelte";
import ContributionStatus from "./ContributionStatus.svelte";
import type { ContributionProject } from "../../types/config";
import type {
	ContributionActivitySnapshot,
	ContributionDetailsSnapshot,
} from "./types";
import BrandIcon from "./BrandIcon.svelte";
import TerminalIcon from "./TerminalIcon.svelte";
import { revealSequence } from "./motion";
import { selectionRail } from "./interaction-motion";
import { metricTransition, missionLink } from "./mission-motion";
import InteractionGlow from "./InteractionGlow.svelte";
const { t } = useTranslations();
export let projects: ContributionProject[];
export let activity: ContributionActivitySnapshot;
export let details: ContributionDetailsSnapshot;
export let loading = false;
export let failed = false;
export let reducedMotion = true;
export let onOpen: (project: string, record: string) => void;
let sectorId = "all";
let tab: ContributionQueue = "active";
let kind: ContributionKindFilter = "pr";
let queueElement: HTMLDivElement | undefined;
let focusedId = "";
$: overview = contributionOverview(projects, activity, details);
$: selectedSectors = overview.sectors.filter(
	(sector) => sectorId === "all" || sector.project.id === sectorId,
);
$: totals = selectedSectors.reduce(
	(sum, sector) => ({
		issues: sum.issues + sector.issues,
		prs: sum.prs + sector.prs,
		active: sum.active + sector.active,
		commits: sum.commits + sector.commits,
		unknown: sum.unknown + sector.unknown,
	}),
	{ issues: 0, prs: 0, active: 0, commits: 0, unknown: 0 },
);
$: records = overview.records.filter(
	(record) => sectorId === "all" || record.projectId === sectorId,
);
$: activeCount = records.filter(
	(record) => record.state === "open" || record.state === "draft",
).length;
$: queue = contributionQueue(records, tab, kind);
$: archiveCount = contributionQueue(records, "archive").counts.all;
$: kindOptions = (
	tab === "active" ? ["all", "pr", "issue"] : ["all", "pr", "issue", "commit"]
) as ContributionKindFilter[];
$: missions = queue.records;
$: focusedMission =
	missions.find((mission) => (mission.url ?? mission.id) === focusedId) ??
	missions[0];
$: focusedDetail = focusedMission
	? details.records.find((detail) => detail.url === focusedMission.url)
	: undefined;
$: linkedRecords = linkedContributions(focusedDetail, details.records);
$: reviewSummary =
	focusedMission?.kind === "pr"
		? resolveReviewSummary(focusedDetail)
		: undefined;
$: pr = focusedMission?.kind === "pr" ? focusedDetail?.pullRequest : undefined;
$: ci = pr ? summarizeChecks(pr.checks) : undefined;
$: conflict = conflictState(pr, focusedMission?.state ?? "");
$: mergedCommitUrl =
	focusedMission?.kind === "pr" &&
	focusedDetail?.state === "merged" &&
	focusedDetail.mergeCommitSha
		? focusedMission.url?.replace(
				/\/pull\/\d+$/,
				`/commit/${focusedDetail.mergeCommitSha}`,
			)
		: undefined;
const pad = (value: number) => String(value).padStart(2, "0");
const kindLabel = (value: ContributionKindFilter) =>
	({ all: t("全部"), pr: "PR", issue: "Issue", commit: t("提交") })[value];
const resetQueueScroll = () => {
	if (queueElement) queueElement.scrollTop = 0;
};
function selectQueue(value: ContributionQueue) {
	tab = value;
	if (value === "active" && kind === "commit") kind = "all";
	resetQueueScroll();
}
function selectKind(value: ContributionKindFilter) {
	kind = value;
	resetQueueScroll();
}
const status = (value: string) =>
	(
		({
			open: t("进行中"),
			draft: t("草稿"),
			merged: t("已合并"),
			closed: t("已关闭"),
			commit: t("提交记录"),
		}) as Record<string, string>
	)[value];
const ciLabel = (value: string) =>
	(
		({
			passed: t("通过"),
			failed: t("检查未通过"),
			pending: t("运行中"),
			neutral: t("检查已结束"),
			none: t("暂无检查"),
		}) as Record<string, string>
	)[value];
const conflictLabel = (value: string) =>
	(
		({
			clear: t("无冲突"),
			conflict: t("存在冲突"),
			pending: t("冲突检查中"),
			"not-applicable": t("冲突检测不适用"),
		}) as Record<string, string>
	)[value];
const relation = (relations?: string[]) =>
	relations?.includes("author")
		? t("发起")
		: relations?.includes("assignee")
			? t("受指派")
			: relations?.includes("commenter")
				? t("参与讨论")
				: t("代码提交");
const chapterNames: Record<string, string> = {
	linux: t("内核 / 系统"),
	"llvm-project": t("编译器 / 工具链"),
	cargo: t("构建 / 包管理"),
};
const coverPosition: Record<string, string> = {
	linux: "0%",
	"llvm-project": "50%",
	cargo: "100%",
};
const projectLabel = (id: string, name: string) =>
	id === "llvm-project" ? "LLVM" : name;
</script>

<section class="mission-control" data-topic={sectorId === 'all' ? 'neutral' : projectTone(sectorId)} aria-label={t("开源任务控制台")}>
  <div class="mission-crown console-register"><span><i aria-hidden="true"></i>{t("贡献档案")}</span><span>{activity.account} <b aria-hidden="true">//</b> {t("{v0} 个项目", { v0: pad(projects.length) })}</span></div>
  <div class="mission-metrics" aria-label={t("协作统计")} aria-live="polite" aria-atomic="true">
    <div class="mission-metric metric-issues">
      <strong use:metricTransition={{value: totals.issues, enabled: !reducedMotion}}>{pad(totals.issues)}</strong>
      <span class="metric-label"><ContributionIcon name="issue" size={15}/><span>{t("参与 Issue")}</span></span>
    </div>
    <div class="mission-metric metric-prs">
      <strong use:metricTransition={{value: totals.prs, enabled: !reducedMotion}}>{pad(totals.prs)}</strong>
      <span class="metric-label"><ContributionIcon name="pr" size={15}/><span>{t("收录 PR")}</span></span>
    </div>
    <div class="mission-metric metric-active">
      <strong use:metricTransition={{value: totals.active, enabled: !reducedMotion}}>{pad(totals.active)}</strong>
      <span class="metric-label"><ContributionIcon name="discussion" tone="positive" size={15}/><span>{t("当前协作")}</span></span>
    </div>
    <div class="mission-metric metric-commits">
      <strong use:metricTransition={{value: totals.commits, enabled: !reducedMotion}}>{pad(totals.commits)}</strong>
      <span class="metric-label"><ContributionIcon name="commit" tone="recorded" size={15}/><span>{t("收录提交")}</span></span>
    </div>
  </div>
  <div class="mission-chapters" role="group" aria-label={t("分项目统计")} use:revealSequence={{key: overview.sectors.map((sector) => sector.project.id).join('|'), enabled: !reducedMotion, selector: '.chapter-caption', wait: 80}}>
    {#each overview.sectors as sector, index (sector.project.id)}
      <button class="mission-chapter" data-topic={projectTone(sector.project.id)} class:chapter-selected={sectorId === sector.project.id} aria-label={t("选择项目：{v0}", {v0: sector.project.name})} aria-pressed={sectorId === sector.project.id} style={`--cover-position:${coverPosition[sector.project.id] ?? '50%'}`} onclick={() => sectorId = sectorId === sector.project.id ? "all" : sector.project.id}>
        <span class="chapter-art" aria-hidden="true"></span>
        <span class="chapter-glint" aria-hidden="true"></span>
        <span class="chapter-lock" aria-hidden="true"></span>
        <span class="chapter-number" aria-hidden="true">{pad(index + 1)}</span>
        <span class="chapter-symbol" aria-hidden="true"><BrandIcon name={sector.project.id} size={20} framed={false}/></span>
        <span class="chapter-caption"><span class="chapter-category">{chapterNames[sector.project.id] ?? t("开源")}</span><strong>{projectLabel(sector.project.id, sector.project.name)}</strong><span class="chapter-counts">{#if sector.issues}<span>{pad(sector.issues)} Issue</span>{/if}{#if sector.prs}<span>{pad(sector.prs)} PR</span>{/if}{#if sector.commits}<span>{pad(sector.commits)} {t("提交记录")}</span>{/if}</span></span>
      </button>
    {/each}
  </div>
  <div class="mission-workspace" data-topic={focusedMission ? projectTone(focusedMission.projectId) : 'neutral'} use:missionLink={{key: `${sectorId}|${tab}|${queue.kind}|${focusedMission?.url ?? focusedMission?.id ?? ''}|${missions.length}`, enabled: !reducedMotion}}>
    <svg class="mission-link" aria-hidden="true"><path pathLength="1"/></svg>
    <section class="mission-queue" aria-label={t("协作任务列表")}>
      <header class="mission-queue-heading"><div class="mission-tabs" role="group" aria-label={t("选择任务队列")} use:selectionRail={{key: tab, enabled: !reducedMotion}}><button aria-pressed={tab === 'active'} onclick={() => selectQueue('active')}>{t("当前协作")} <span>{activeCount}</span></button><button aria-pressed={tab === 'archive'} onclick={() => selectQueue('archive')}>{t("历史档案")} <span>{archiveCount}</span></button><span class="selection-rail" aria-hidden="true"></span></div><span aria-live="polite" aria-atomic="true">{t("{v0} 条记录", { v0: pad(missions.length) })}</span></header>
      <div class="mission-type-filters" role="group" aria-label={t("筛选记录类型")}>
        {#each kindOptions as option (option)}
          <button class={`mission-type-${option}`} aria-pressed={queue.kind === option} onclick={() => selectKind(option)}>
            {#if option !== 'all'}<ContributionIcon name={option} size={14}/>{/if}
            <span>{kindLabel(option)}</span><span class="mission-type-count">{queue.counts[option]}</span>
          </button>
        {/each}
      </div>
      {#if tab === 'archive'}
        <div class="mission-history-summary" role="group" aria-label={t("历史状态统计")} aria-live="polite">
          {#if queue.kind === 'all' || queue.kind === 'pr'}
            <ContributionStatus label={t("{v0} PR 已合并", {v0: queue.states.mergedPRs})} {...recordPresentation('pr', 'merged')}/>
            <ContributionStatus label={t("{v0} PR 已关闭", {v0: queue.states.closedPRs})} {...recordPresentation('pr', 'closed')}/>
          {/if}
          {#if queue.kind === 'all' || queue.kind === 'issue'}<ContributionStatus label={t("{v0} Issue 已关闭", {v0: queue.states.closedIssues})} {...recordPresentation('issue', 'closed')}/>{/if}
          {#if queue.kind === 'all' || queue.kind === 'commit'}<ContributionStatus label={t("{v0} 条提交", {v0: queue.states.commits})} {...recordPresentation('commit', 'commit')}/>{/if}
        </div>
      {/if}
      <div class="mission-log-scroll" bind:this={queueElement} tabindex="0" role="region" aria-label={t("协作任务列表")} use:revealSequence={{key: `${sectorId}|${tab}|${queue.kind}|${missions.length}`, enabled: !reducedMotion, selector: '.mission-entry-body'}}>
        <span class="mission-selection" aria-hidden="true"></span>
        {#each missions as mission (mission.url ?? mission.id)}
          {@const visual = recordPresentation(mission.kind, mission.state)}
          <button class="mission-entry console-row" data-feedback data-topic={projectTone(mission.projectId)} aria-pressed={focusedMission?.url === mission.url && focusedMission?.id === mission.id} onclick={() => focusedId = mission.url ?? mission.id}>
            <InteractionGlow/>
            <span class="console-lock" aria-hidden="true"></span>
            <span class="mission-kind" aria-hidden="true"><ContributionIcon name={visual.icon} tone={visual.tone} size={20}/></span>
            <span class="mission-entry-body"><span class="mission-entry-meta"><code>{mission.kind === 'commit' ? mission.reference.slice(0, 10) : mission.reference}</code>{#if sectorId === 'all'}<span class="mission-project" data-topic={projectTone(mission.projectId)}>{mission.projectName}</span>{:else}<ContributionStatus label={status(mission.state)} icon={visual.icon} tone={visual.tone}/>{/if}</span><strong>{mission.title}</strong></span>
            <TerminalIcon name="arrow" size={14}/>
          </button>
        {:else}<div class="mission-no-records"><span aria-hidden="true">◇</span><p>{loading ? t("正在读取记录内容…") : failed ? t("记录内容暂时无法读取。") : t("当前分区暂无此类记录。")}</p></div>{/each}
      </div>
    </section>
    <section class="mission-briefing console-panel" aria-label={t("任务简报")}>
      {#key focusedMission?.url ?? focusedMission?.id}{#if focusedMission}<span class="briefing-reception" aria-hidden="true"></span>{/if}{/key}
      <header class="briefing-heading"><h2>{t("任务简报")}</h2><span>{t("记录 / 详情")}</span></header>
      <div class="mission-focus" use:revealSequence={{key: focusedMission?.url ?? focusedMission?.id ?? '', enabled: !reducedMotion, selector: '.focus-project, h3, .focus-reference, .focus-facts > div', wait: 70}}>
        {#if focusedMission}
          {@const visual = recordPresentation(focusedMission.kind, focusedMission.state)}
          <p class="focus-project" data-topic={projectTone(focusedMission.projectId)}><BrandIcon name={focusedMission.projectId} size={15} framed={false}/>{focusedMission.projectName}</p><h3>{focusedMission.title}</h3>
          <div class="focus-reference"><code>{focusedMission.kind === 'commit' ? focusedMission.reference.slice(0, 10) : focusedMission.reference}</code><ContributionStatus label={status(focusedMission.state)} icon={visual.icon} tone={visual.tone}/>
            {#if focusedMission.kind === 'pr'}
              {#if reviewSummary}
                {#if reviewSummary.approved.length}<span title={t("批准：{v0}", {v0: reviewSummary.approved.join(', ')})}><ContributionStatus label={t("{v0} 人批准", {v0: reviewSummary.approved.length})} {...reviewPresentation('APPROVED')}/></span>{/if}
                {#if reviewSummary.changesRequested.length}<span title={t("要求修改：{v0}", {v0: reviewSummary.changesRequested.join(', ')})}><ContributionStatus label={t("{v0} 人要求修改", {v0: reviewSummary.changesRequested.length})} {...reviewPresentation('CHANGES_REQUESTED')}/></span>{/if}
                {#if !reviewSummary.approved.length && !reviewSummary.changesRequested.length}
                  {#if ['merged', 'closed'].includes(focusedMission.state)}<ContributionStatus label={t("无批准记录")} tone="muted" icon="info"/>
                  {:else if reviewSummary.commented.length}<ContributionStatus label={t("评审中")} tone="attention" icon="discussion"/>
                  {:else}<ContributionStatus label={t("等待评审")} tone="attention" icon="clock"/>{/if}
                {/if}
              {:else if loading}<ContributionStatus label={t("正在读取评审…")} tone="muted" icon="clock"/>
              {:else if failed}<ContributionStatus label={t("评审暂不可用")} tone="muted" icon="info"/>{/if}
              {#if ci}
                <span title={t("{v0} 通过 · {v1} 未通过 · {v2} 等待 · {v3} 其他", {v0: ci.passed, v1: ci.failed, v2: ci.pending, v3: ci.neutral})}><ContributionStatus label={`CI · ${ciLabel(ci.state)}`} {...checkPresentation(ci.state)}/></span>
              {:else}<ContributionStatus label={loading ? t("正在读取 CI…") : t("CI 暂不可用")} tone="muted" icon={loading ? 'clock' : 'info'}/>{/if}
              {#if conflict === 'unavailable'}<ContributionStatus label={loading ? t("正在读取合并状态…") : t("冲突检测暂不可用")} tone="muted" icon={loading ? 'clock' : 'info'}/>
              {:else}<ContributionStatus label={conflictLabel(conflict)} {...conflictPresentation(conflict)}/>{/if}
            {/if}
          </div>
          <dl class="focus-facts"><div><dt>{t("参与方式")}</dt><dd>{relation(focusedMission.relations)}</dd></div><div><dt>{t("更新于")}</dt><dd><time datetime={focusedMission.date}>{focusedMission.date.slice(0, 10)}</time></dd></div>{#if focusedDetail}<div><dt>{t("讨论记录")}</dt><dd>{focusedDetail.commentsTotal}</dd></div>{/if}
            {#if focusedMission.kind === 'pr' || focusedMission.kind === 'issue'}
              <div><dt>{focusedMission.kind === 'pr' ? t("关联 Issue") : t("关联 PR")}</dt><dd class="focus-linked-numbers">
                {#each linkedRecords as link, index (link.url)}{#if index > 0}{' · '}{/if}<a href={link.url} target="_blank" rel="noreferrer" title={link.title}>#{link.number}</a>{:else}<span>{loading ? '…' : '—'}</span>{/each}
              </dd></div>
            {/if}
          </dl>
          {#if mergedCommitUrl}<div class="focus-reference"><span>{t("合并提交")}</span><a href={mergedCommitUrl} target="_blank" rel="noreferrer"><code>{focusedDetail?.mergeCommitSha?.slice(0, 10)}</code></a></div>{/if}

        {:else}<p class="mission-briefing-empty">{t("当前分区暂无此类记录。")}</p>{/if}
      </div>
      {#if focusedMission}<button class="mission-open console-action" data-feedback onclick={() => onOpen(focusedMission.projectId, focusedMission.id)}><InteractionGlow/>{t("查看这条记录")}<TerminalIcon name="external" size={15}/></button>{/if}
    </section>
  </div>
</section>
