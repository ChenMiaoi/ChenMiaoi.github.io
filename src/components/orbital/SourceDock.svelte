<script lang="ts">
  import { useTranslations } from "../../features/orbital/i18n/context";
  const { t } = useTranslations();
  import { summarizeChecks } from "../../lib/contributions/checks";
  import { checkPresentation, recordPresentation } from "../../lib/contributions/presentation";
  import ContributionIcon from "./ContributionIcon.svelte";
  import ContributionStatus from "./ContributionStatus.svelte";
  import { onMount, tick } from "svelte";
  import { projectRecords, sortContributionProjects } from "../../lib/contributions/projects";
  import type { ContributionFeed } from "../../lib/contributions/types";
  import TerminalIcon from "./TerminalIcon.svelte";
  import BrandIcon from "./BrandIcon.svelte";
  import { projectTone } from "../../features/orbital/topic-colors";
  import { revealOnView } from "./motion";
  import { selectionRail } from "./interaction-motion";
  import ContributionReader from "./ContributionReader.svelte";
  import ContributionControl from "./ContributionControl.svelte";
  import type { ContributionProject } from "../../types/config";
  import type { ContributionActivitySnapshot, ContributionDetailsSnapshot, SourceRecord } from "./types";

  export let projects: ContributionProject[];
  export let activity: ContributionActivitySnapshot;
  export let detailsUrl: string;
  let details: ContributionDetailsSnapshot = { syncedAt: activity.syncedAt, records: [] };
  let detailsError = false;
  let loadingDetails = true;
  let pending: AbortController | undefined;
  let disposed = false;
  export let projectId: string | undefined;
  export let reducedMotion = false;
  export let selectedId = "";
  export let kindFilter = "all";
  let showDashboard = !projectId && !selectedId;
  let dashboardRoute = `${projectId ?? ''}|${selectedId}|${kindFilter}`;
  $: {
    const nextRoute = `${projectId ?? ''}|${selectedId}|${kindFilter}`;
    if (nextRoute !== dashboardRoute) {
      showDashboard = !projectId && !selectedId;
      dashboardRoute = nextRoute;
    }
  }
  export let onNavigate: (project: string, record: string, kind: string) => void = () => {};
  let recordRail: HTMLDivElement;
  let deck: HTMLDivElement;
  let tether: { width: number; height: number; path: string; x: number; y: number; endX: number; endY: number } | undefined;

  $: orderedProjects = sortContributionProjects(projects, activity, details);
  $: project = orderedProjects.find((item) => item.id === projectId) ?? orderedProjects[0];
  $: allRecords = project ? projectRecords(project, activity, details) : [];
  $: recordKinds = [...new Set(allRecords.map((item) => item.kind))];
  $: records = allRecords.filter((item) => kindFilter === "all" || item.kind === kindFilter);
  $: selected = selectedId ? records.find((item) => item.id === selectedId) : records[0];
  $: if (typeof document !== "undefined") document.title = `${showDashboard ? t("任务控制台") : selectedId && selected ? selected.title : project?.name ?? t("任务日志")} · Miao's Blog`;
  $: selectedDetail = details.records.find((item) => item.url === selected?.url);
  $: selectedIndex = records.findIndex((item) => item.id === selected?.id);
  $: if (selected && recordRail) revealSelection(selected.id);
  const number = (value: number) => String(value).padStart(2, "0");
  const repositoryPath = (url?: string) => url?.replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, "") ?? "";
  const kindName = (kind: string) => kind === "commit" ? t("提交") : kind === "pr" ? "PR" : "Issue";
  const contributionStateLabel = (state?: string, draft = false) =>
    ({ open: t("进行中"), draft: t("草稿"), merged: t("已合并"), closed: t("已关闭") } as Record<string, string>)[state ?? (draft ? 'draft' : 'open')] ?? '';

  function chooseProject(id: string) {
    projectId = id;
    selectedId = "";
    kindFilter = "all";
    onNavigate(id, "", "all");
  }

  function openMission(id: string, record: string) {
    showDashboard = false;
    projectId = id;
    selectedId = record;
    kindFilter = 'all';
    onNavigate(id, record, 'all');
  }

  function showControl() {
    projectId = undefined;
    selectedId = '';
    kindFilter = 'all';
    showDashboard = true;
    onNavigate('', '', 'all');
  }

  function step(direction: number) {
    const record = records[selectedIndex + direction];
    if (record) selectRecord(record.id);
  }

  function selectRecord(id: string) {
    selectedId = id;
    onNavigate(project.id, id, kindFilter);
  }

  function filterKind(kind: string) {
    kindFilter = kind;
    selectedId = "";
    onNavigate(project.id, "", kind);
  }

  async function revealSelection(_id: string) {
    await tick();
    const active = recordRail?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!active) return;
    const container = recordRail.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    const horizontal = recordRail.scrollWidth > recordRail.clientWidth;
    if (horizontal && (item.left < container.left || item.right > container.right)) {
      recordRail.scrollTo({ left: recordRail.scrollLeft + item.left - container.left, behavior: reducedMotion ? "instant" : "smooth" });
    } else if (!horizontal && (item.top < container.top || item.bottom > container.bottom)) {
      recordRail.scrollTo({ top: recordRail.scrollTop + (item.top < container.top ? item.top - container.top : item.bottom - container.bottom), behavior: reducedMotion ? "instant" : "smooth" });
    }
    updateTether();
  }

  function updateTether() {
    const active = recordRail?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    const crown = deck?.querySelector<HTMLElement>('.chamber-crown');
    if (!active || !crown || window.innerWidth < 1000) { tether = undefined; return; }
    const frame = deck.getBoundingClientRect();
    const rail = recordRail.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    const target = crown.getBoundingClientRect();
    const y = item.top + 27;
    if (y < rail.top || y > rail.bottom) { tether = undefined; return; }
    const x = item.right - frame.left - 2;
    const startY = y - frame.top;
    const endX = target.left - frame.left + 2;
    const endY = target.top - frame.top + target.height / 2;
    const elbow = x + (endX - x) * .5;
    tether = { width: frame.width, height: frame.height, x, y: startY, endX, endY, path: `M ${x} ${startY} H ${elbow - 5} L ${elbow} ${startY - 5} V ${endY + 5} L ${elbow + 5} ${endY} H ${endX}` };
  }

  function connectDeck(node: HTMLDivElement) {
    deck = node;
    const observer = new ResizeObserver(updateTether);
    observer.observe(node);
    node.addEventListener('scroll', updateTether, true);
    return { destroy() { observer.disconnect(); node.removeEventListener('scroll', updateTether, true); } };
  }
  async function loadDetails() {
    if (pending || disposed) return;
    const controller = new AbortController();
    pending = controller;
    detailsError = false;
    loadingDetails = !details.records.length;
    try {
      const response = await fetch(detailsUrl, { cache: 'no-cache', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      if (!response.ok) throw new Error('Contribution data unavailable');
      const next = await response.json() as ContributionFeed;
      if (!Array.isArray(next.records) || !next.syncedAt || (next.version === 1 && !Array.isArray(next.activity?.items))) throw new Error('Invalid contribution data');
      if (!disposed) {
        // Update list and details together so record selection never mixes generations.
        // Preserve explicit route selection, including a record discovered in this refresh.
        details = next;
        if (next.version === 1) activity = next.activity;
      }
    } catch {
      if (!disposed) { detailsError = !details.records.length; }
    } finally { pending = undefined; if (!disposed) loadingDetails = false; }
  }
  onMount(() => {
    disposed = false;
    void loadDetails();
    const refresh = () => { if (document.visibilityState === 'visible') void loadDetails(); };
    const timer = window.setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { disposed = true; pending?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  });
</script>

<section class="source-dock" class:control-mode={showDashboard} aria-label={t("开源贡献接入站")}>
  <div class="projection-environment" aria-hidden="true">
    <svg class="projection-orbits" viewBox="0 0 900 900" fill="none">
      <circle cx="450" cy="450" r="355"/>
      <circle cx="450" cy="450" r="330" stroke-dasharray="2 14"/>
      <ellipse cx="450" cy="450" rx="415" ry="160" transform="rotate(-32 450 450)"/>
      <path d="M95 450H180M720 450H805M450 95V165M450 735V805"/>
      <g class="projection-orbit-arc"><path d="M450 95A355 355 0 0 1 787 339M450 805A355 355 0 0 1 113 561"/><circle cx="787" cy="339" r="5"/></g>
    </svg>
  </div>
  <nav class="source-mode-tabs" aria-label={t("切换开源视图")} use:selectionRail={{key: String(showDashboard), enabled: !reducedMotion}}><button aria-pressed={showDashboard} onclick={showControl}>{t("任务控制台")}</button><button aria-pressed={!showDashboard} onclick={() => { showDashboard = false; if (!projectId) chooseProject(project.id); }}>{t("记录档案")}</button><span class="selection-rail" aria-hidden="true"></span></nav>
  {#if showDashboard}
    <ContributionControl {projects} {activity} {details} {reducedMotion} loading={loadingDetails} failed={detailsError} onOpen={openMission}/>
  {:else}
  <header class="source-console-bar">
    <nav class="project-docks" aria-label={t("选择开源项目")}>
      {#each orderedProjects as item (item.id)}
        <button class="project-port" data-topic={projectTone(item.id)} class:active={project?.id === item.id} aria-label={t("选择项目：{v0}", { v0: item.name })} aria-pressed={project?.id === item.id} onclick={() => chooseProject(item.id)}>
          <BrandIcon name={item.id} size={26}/>
          <strong>{item.name}</strong>
          <span class="port-count" aria-label={t("{v0}条记录", { v0: projectRecords(item, activity, details).length })}>{number(projectRecords(item, activity, details).length)}</span>
        </button>
      {/each}
    </nav>
    {#if project?.repository}<a class="source-repository" href={project.repository} target="_blank" rel="noreferrer"><BrandIcon name="github" size={16} framed={false}/>{t("项目仓库")}<TerminalIcon name="external" size={15}/></a>{/if}
  </header>

  {#if project}
    <div class="contribution-deck" class:empty-deck={!records.length} use:connectDeck>
      {#if tether}
        <svg class="selection-tether" viewBox={`0 0 ${tether.width} ${tether.height}`} aria-hidden="true">
          <path d={tether.path}/>
          {#key selected?.id}<path class="tether-arrival" d={tether.path} pathLength="1"/>{/key}
          <circle cx={tether.x} cy={tether.y} r="2.5"/>
          <rect x={tether.endX - 3} y={tether.endY - 3} width="6" height="6" transform={`rotate(45 ${tether.endX} ${tether.endY})`}/>
        </svg>
      {/if}
      <aside class="contribution-rail" aria-label={t("{v0}贡献记录", { v0: project.name })}>
        <header><span>{allRecords.some((item) => item.kind !== 'commit') ? t("协作轨迹") : t("提交轨迹")}</span><small>{number(records.length)} {t("/ 记录")}</small></header>
        {#if recordKinds.length > 1}
          <div class="contribution-kind-filter" aria-label={t("筛选贡献类型")}>
            <button class:active={kindFilter === 'all'} aria-pressed={kindFilter === 'all'} onclick={() => filterKind("all")}>{t("全部")} <small>{allRecords.length}</small></button>
            {#each recordKinds as kind}<button class:active={kindFilter === kind} aria-pressed={kindFilter === kind} onclick={() => filterKind(kind)}>{kindName(kind)} <small>{allRecords.filter((item) => item.kind === kind).length}</small></button>{/each}
          </div>
        {/if}
        {#if records.length}
          <div class="contribution-records" bind:this={recordRail} use:revealOnView={{key: `${project.id}|${kindFilter}`, enabled: !reducedMotion, selector: '.record-text'}}>
            {#each records as record, index}
              {@const pr = record.kind === "pr" ? details.records.find((item) => item.url === record.url)?.pullRequest : undefined}
              {@const ci = pr ? summarizeChecks(pr.checks) : undefined}
              {@const visual = recordPresentation(record.kind, record.state, record.draft)}
              <button class="contribution-record" class:active={selected?.id === record.id} aria-pressed={selected?.id === record.id} aria-label={t("查看{v0}：{v1}", { v0: kindName(record.kind), v1: record.title })} onclick={() => selectRecord(record.id)}>
                <span class="record-point" aria-hidden="true">{number(index + 1)}</span>
                <span class="record-text"><span class="record-date"><ContributionIcon name={visual.icon} tone={visual.tone} size={18}/><time datetime={record.date}>{record.date.slice(0, 10)}</time>{#if record.kind !== 'commit'}<ContributionStatus label={contributionStateLabel(record.state, record.draft)} icon={visual.icon} tone={visual.tone}/>{/if}</span><strong>{record.title}</strong><code>{record.reference}</code>{#if ci}<span class="record-ci" title={t("检查详情")}><ContributionStatus label={`CI · ${({passed:t("通过"),failed:t("检查未通过"),pending:t("运行中"),neutral:t("检查已结束"),none:t("暂无检查")} as Record<string,string>)[ci.state]}`} {...checkPresentation(ci.state)}/></span>{/if}</span>
                <TerminalIcon name="arrow" size={13}/>
              </button>
            {/each}
          </div>
        {:else}
          <div class="rail-empty"><span aria-hidden="true">—</span><p>{t("暂无收录记录")}</p><small>{t("项目仓库仍可访问")}</small></div>
        {/if}
      </aside>

      <div class="projection-shell">
      <svg class="projection-depth" viewBox="0 0 1000 800" preserveAspectRatio="none" aria-hidden="true">
        <path class="projection-backplane" d="M32 9H942L993 51V746L965 790H12V33Z"/>
        <path d="M12 33L0 18M993 51L982 40M965 790L953 776M12 790L0 776"/>
        <path class="projection-ribs" d="M994 112V260M994 290V333M60 790H218M242 790H271"/>
        {#key `${project.id}:${selected?.id ?? 'empty'}`}<path class="projection-reception" pathLength="1" d="M32 9H942L993 51V260"/>{/key}
      </svg>
      <section class="patch-chamber" aria-label={t("当前贡献详情")}>
        <header class="chamber-crown">
          <span class="chamber-aperture" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="chamber-address" data-topic={projectTone(project.id)}>{repositoryPath(project.repository) || project.name}</span>
          <span class="chamber-position"><b>{number(Math.max(0, selectedIndex + 1))}</b><i>/</i>{number(records.length)}</span>
        </header>
        {#key `${project.id}:${selected?.id ?? 'empty'}`}
          <div class="patch-presentation">
            {#if selected}
              {#if loadingDetails}<p class="dock-note" role="status">{t("正在读取记录内容…")}</p>{:else if detailsError}<p class="dock-note" role="alert">{t("记录内容暂时无法读取。")}<button onclick={loadDetails}>{t("重试")}</button></p>{/if}
              <ContributionReader record={selected} detail={selectedDetail} account={activity.account} {reducedMotion}/>
            {:else}
              {#if selectedId}<div class="patch-content patch-empty"><h2>{t("未找到这条贡献记录")}</h2><p>{t("这条记录未收录或已不在当前项目中。")}</p><button class="signal-button" onclick={() => chooseProject(project.id)}>{t("返回项目记录")}</button></div>{:else}<div class="patch-content patch-empty"><p class="patch-eyebrow">{project.name} <i>/</i> {t("开源项目")}</p><h2>{t("尚未收录贡献记录")}</h2><p>{t("这里会展示博客收录的提交与讨论。你可以先前往项目仓库浏览源码。")}</p>{#if project.repository}<a class="patch-primary" href={project.repository} target="_blank" rel="noreferrer">{t("浏览项目源码")}<TerminalIcon name="external" size={20}/></a>{/if}</div>{/if}
            {/if}
          </div>
        {/key}
        <footer class="chamber-footer"><span>{selected ? t("浏览收录记录") : t("项目入口")}</span>{#if records.length}<div><button aria-label={t("上一条贡献记录")} disabled={selectedIndex <= 0} onclick={() => step(-1)}><TerminalIcon name="back" size={16}/></button><span>{number(selectedIndex + 1)}<i>/</i>{number(records.length)}</span><button aria-label={t("下一条贡献记录")} disabled={selectedIndex >= records.length - 1} onclick={() => step(1)}><TerminalIcon name="arrow" size={16}/></button></div>{:else}<code>{repositoryPath(project.repository)}</code>{/if}</footer>
      </section>
      </div>
    </div>
  {:else}<p class="dock-note">{t("尚未配置开源项目。")}</p>{/if}
  {/if}
</section>
