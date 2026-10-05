<script lang="ts">
  import { useTranslations } from "../../features/orbital/i18n/context";
  const { t, dateLocale } = useTranslations();
  import { checkState, summarizeChecks } from "../../lib/contributions/checks";
  import TerminalIcon from "./TerminalIcon.svelte";
  import BrandIcon from "./BrandIcon.svelte";
  import { contributionDiffLines } from "../../utils/contribution-diff";
  import type { ContributionDetail, SourceRecord } from "./types";

  export let record: SourceRecord;
  export let detail: ContributionDetail | undefined;
  export let account = "";
  $: pr = detail?.pullRequest;
  $: ci = summarizeChecks(pr?.checks ?? []);
  const ciLabel = (value: string) => ({ passed: t("检查通过"), failed: t("检查未通过"), pending: t("检查进行中"), neutral: t("检查已结束"), none: t("暂无检查") } as Record<string, string>)[value];
  const checkLabel = (status: string, conclusion: string | null) => status !== "completed" ? (status === "in_progress" ? t("运行中") : t("等待运行")) : ({ success: t("通过"), failure: t("失败"), error: t("失败"), timed_out: t("超时"), cancelled: t("已取消"), skipped: t("已跳过"), neutral: t("中性结果"), action_required: t("需要处理"), stale: t("已过期"), startup_failure: t("启动失败") } as Record<string, string>)[conclusion ?? ""] ?? t("结果未知");
  const mergeLabel = (value: string) => ({ clean: t("无合并阻碍"), unstable: t("检查尚未通过"), blocked: t("合并受阻"), behind: t("分支落后"), dirty: t("存在冲突"), draft: t("草稿待就绪"), unknown: t("计算中") } as Record<string,string>)[value] ?? t("尚未确认");
  let copyState = "";
  let copyAttempt = 0;
  $: kind = record.kind === "commit" ? t("提交") : record.kind === "pr" ? "PR" : "Issue";
  $: state = detail?.state ?? record.state ?? (record.draft ? "draft" : "open");
  $: stateLabel = ({ open: t("进行中"), draft: t("草稿"), merged: t("已合并"), closed: t("已关闭"), commit: t("提交记录") } as Record<string, string>)[state] ?? "";
  $: reference = detail?.sha ?? record.sha ?? String(record.number ?? record.reference);
  const date = (value: string) => value.slice(0, 10).replaceAll("-", "/");
  const discussionDate = (value: string) => new Intl.DateTimeFormat(dateLocale, { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
  const fullDiscussionDate = (value: string) => new Intl.DateTimeFormat(dateLocale, { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const reviewLabel = (value?: string | null) => ({ APPROVED: t("批准"), CHANGES_REQUESTED: t("要求修改"), DISMISSED: t("评审已撤销"), COMMENTED: t("评审意见") } as Record<string, string>)[value ?? ''] ?? t("评审");

  async function copyReference() {
    const attempt = ++copyAttempt;
    try {
      await navigator.clipboard.writeText(reference);
      if (attempt === copyAttempt) copyState = t("已复制");
    } catch {
      if (attempt === copyAttempt) copyState = t("复制失败");
    }
  }
</script>

<article class="contribution-reader" aria-label={t("{v0}内容阅读器", { v0: kind })}>
  <header class="contribution-reader-heading">
    <div class="reader-record-topline"><span class="reader-record-type">{kind} {t("/ 原始记录")}</span>{#if record.kind !== 'commit'}<span class="collaboration-state" class:draft={state === 'draft'} class:merged={state === 'merged'} class:closed={state === 'closed'}>{stateLabel}</span>{/if}<button class="record-copy" aria-label={t("复制{v0}{v1}", { v0: kind, v1: record.kind === 'commit' ? ' SHA' : t("编号") })} onclick={copyReference}><code>{record.reference}</code><span>{copyState || t("复制")}</span></button><span class="copy-feedback" role="status">{copyState}</span></div>
    <h2>{detail?.title ?? record.title}</h2>
    <div class="reader-record-footer"><div class="reader-record-attribution">{#if detail}<span>{t("原文作者")} <b>{detail.author}</b></span>{/if}{#if record.relations?.length}<span>{record.relations.map((relation) => relation === 'author' ? t("我发起") : relation === 'assignee' ? t("指派给我") : relation === 'commenter' ? t("我参与讨论") : '').filter(Boolean).join(' · ')}</span>{/if}<time datetime={detail?.updatedAt ?? record.date}>{record.kind === 'commit' ? t("提交于") : t("更新于")} {date(detail?.updatedAt ?? record.date)}</time></div>
    <div class="reader-source-links">{#if record.url}<a href={record.url} target="_blank" rel="noreferrer"><BrandIcon name="github" size={14} framed={false}/>{t("在 GitHub 查看")}<TerminalIcon name="external" size={14}/></a>{/if}{#if record.discussionUrl}<a href={record.discussionUrl} target="_blank" rel="noreferrer">{record.discussionLabel?.startsWith('PR #') ? record.discussionLabel : t("邮件讨论")}<TerminalIcon name="external" size={14}/></a>{/if}</div></div>
  </header>

  <div class="contribution-reader-scroll" tabindex="0" role="region" aria-label={t("贡献正文与改动")}>
    {#if detail}
      {#if record.kind === 'pr'}
        <section class="reader-pr-status" aria-label={t("PR 进展")}>
          <div class="reader-section-label"><span>{t("PR 进展")}</span><small>PR OVERVIEW</small></div>
          {#if pr}
            <div class="pr-overview-grid"><div><small>{t("持续集成")}</small><strong class={`ci-summary ci-${ci.state}`}><i aria-hidden="true"></i>{ciLabel(ci.state)}</strong><span>{t("{v0} 通过 · {v1} 未通过 · {v2} 等待 · {v3} 其他", {v0:ci.passed,v1:ci.failed,v2:ci.pending,v3:ci.neutral})}</span></div><div><small>{t("合并状态")}</small><strong>{state === 'merged' ? t("已合并") : state === 'closed' ? t("已关闭") : mergeLabel(pr.mergeState)}</strong><span>{t("冲突检测")}: {pr.mergeable === null ? t("尚未确认") : pr.mergeable ? t("无冲突") : t("存在冲突")}</span></div></div>
            <div class="pr-branches"><span>{t("目标分支")}</span><code>{pr.baseRef || '—'}</code><span aria-hidden="true">←</span><code>{pr.headRef || '—'}</code></div>
            {#if pr.requestedReviewers.length}<p class="pr-meta-line"><span>{t("待评审人")}</span>{pr.requestedReviewers.join(' · ')}</p>{/if}
            {#if pr.labels.length}<div class="pr-labels">{#each pr.labels as label}<span>{label}</span>{/each}</div>{/if}
            <details class="pr-checks" open={ci.state === 'failed'}><summary><span>{t("检查详情")} <b>{ci.total}</b></span><TerminalIcon name="arrow" size={14}/></summary><div class="pr-check-list">
              {#each pr.checks as check}<div class="pr-check-row"><span class={`check-indicator ci-${checkState(check)}`} aria-hidden="true"></span><div>{#if check.url}<a href={check.url} target="_blank" rel="noopener noreferrer">{check.name}<TerminalIcon name="external" size={12}/></a>{:else}<strong>{check.name}</strong>{/if}<small>{check.ref === 'merge' ? t("合并测试") : 'HEAD'} · {check.sha.slice(0, 10)}{#if check.description} · {check.description}{/if}</small></div><span class={`check-result ci-${checkState(check)}`}>{checkLabel(check.status,check.conclusion)}</span></div>{/each}
              {#if !ci.total}<p class="reader-muted">{t("该版本没有公开的检查记录。")}</p>{/if}
            </div></details>
          {:else}<p class="reader-muted">{t("CI 与合并状态尚未同步。")}</p>{/if}
        </section>
      {/if}

      <section class="reader-description" aria-label={t("说明原文")}><div class="reader-section-label"><span>{t("说明原文")}</span><small>DESCRIPTION</small></div>{#if detail.bodyHtml}<div class="contribution-prose">{@html detail.bodyHtml}</div>{:else}<p class="reader-muted">{t("原始记录没有提供进一步说明。")}</p>{/if}
        {#if detail.trailers}<details class="commit-trailers"><summary>{t("提交附注与签署信息")}<TerminalIcon name="arrow" size={13}/></summary><pre>{detail.trailers}</pre></details>{/if}
      </section>

      {#if detail.commits?.length}
        <section class="reader-commits" aria-label={t("提交历史")}>
          <div class="reader-section-label"><span>{t("提交历史")} <b>{detail.commitsTotal ?? detail.commits.length}</b></span><small>COMMITS</small></div>
          {#if detail.commitsComplete === false}<p class="reader-muted">{t("当前收录 {v0} / {v1} 次提交。", { v0: detail.commits.length, v1: detail.commitsTotal ?? detail.commits.length })}<a href={`${record.url}/commits`} target="_blank" rel="noreferrer">{t("查看完整历史 ↗")}</a></p>{/if}
          {#each [...detail.commits].reverse() as commit}
            <a class="reader-commit" href={commit.url} target="_blank" rel="noreferrer"><code>{commit.sha.slice(0, 10)}</code><span><strong>{commit.title}</strong><small>{commit.author} · <time datetime={commit.date}>{discussionDate(commit.date)}</time>{#if commit.sha === detail.headSha} {t("· 最新提交")}{/if}</small></span><TerminalIcon name="external" size={14}/></a>
          {/each}
        </section>
      {/if}

      {#if detail.stats}
        <section class="reader-changes" aria-label={t("改动文件")}>
          <div class="reader-section-label"><span>{t("改动文件")} <b>{detail.stats.files}</b></span><div class="change-totals"><span class="lines-added">+{detail.stats.additions}</span><span class="lines-removed">−{detail.stats.deletions}</span></div></div>
          {#if detail.headSha}<p class="reader-diff-version">{t("PR 累计改动 · 截至")} <code>{detail.headSha.slice(0, 10)}</code></p>{/if}
          {#if !detail.filesComplete}<p class="reader-muted">{t("当前收录 {v0} / {v1} 个文件，其余改动请查看原始记录。", { v0: detail.files.length, v1: detail.stats.files })}</p>{/if}
          <div class="change-file-list">
            {#each detail.files as file}
              <details class="change-file">
                <summary><TerminalIcon name="arrow" size={14}/><span><code>{file.filename}</code>{#if file.previousFilename}<small>{t("原路径：")}{file.previousFilename}</small>{/if}</span><span class="file-change-count"><span class="lines-added">+{file.additions}</span><span class="lines-removed">−{file.deletions}</span></span></summary>
                {#if file.patch}
                  <div class="patch-diff-scroll" tabindex="0" role="region" aria-label={t("{v0}代码差异", { v0: file.filename })}>
                    <pre class="contribution-patch"><code>{#each contributionDiffLines(file.patch) as line}<span class={`patch-line patch-${line.kind}`}>{line.text}</span>{/each}</code></pre>
                  </div>
                {:else}<p class="diff-unavailable">{t("GitHub 未提供此文件的文本差异。")}{#if record.url}<a href={record.kind === 'pr' ? `${record.url}/files` : record.url} target="_blank" rel="noreferrer">{t("查看原始改动 ↗")}</a>{/if}</p>{/if}
              </details>
            {/each}
          </div>
        </section>
      {/if}

      {#if detail.references.length}
        <section class="reader-references" aria-label={t("关联记录")}><div class="reader-section-label"><span>{t("关联记录")}</span><small>REFERENCES</small></div>{#each detail.references as reference}<a href={reference.url} target="_blank" rel="noreferrer"><span><small>{reference.kind === 'pr' ? 'PR' : 'Issue'} #{reference.number} <i>·</i> {reference.relation === 'cross-reference' ? t("交叉引用") : t("原文引用")}</small><strong>{reference.title}</strong></span><TerminalIcon name="external" size={15}/></a>{/each}</section>
      {/if}

      {#if detail.comments.length}
        <section class="reader-comments" aria-label={t("讨论与评审")}>
          <div class="reader-section-label"><span>{t("讨论与评审")}</span><small>{t("{v0} 条 · 最新在前", { v0: detail.comments.length })}</small></div>
          <div class="discussion-timeline">
          {#each detail.comments as comment (comment.url)}
            <details class="reader-comment" class:comment-own={comment.author === account} class:comment-bot={comment.bot}>
              <summary>
                <span class="comment-avatar" aria-hidden="true">{comment.bot ? '↳' : comment.author.slice(0, 2).toUpperCase()}</span>
                <span class="comment-summary">
                  <span class="comment-heading"><strong>{comment.author}</strong>{#if comment.author === account}<span class="comment-role">{t("我")}</span>{:else if comment.author === detail.author}<span class="comment-role">{t("原文作者")}</span>{/if}<time datetime={comment.createdAt} title={fullDiscussionDate(comment.createdAt)}>{discussionDate(comment.createdAt)}</time></span>
                  <span class="comment-meta"><span class="comment-kind" class:review-approved={comment.kind === 'review' && comment.reviewState === 'APPROVED'} class:review-changes={comment.kind === 'review' && comment.reviewState === 'CHANGES_REQUESTED'}>{comment.kind === 'review' ? reviewLabel(comment.reviewState) : comment.path ? t("行内讨论") : t("讨论")}</span>{#if comment.bot}<span class="comment-role">{t("机器人")}</span>{/if}{#if comment.path}<code class="comment-path">{comment.path}</code>{/if}</span>
                  {#if comment.excerpt}<span class="comment-excerpt">{comment.excerpt}</span>{/if}
                </span>
                <TerminalIcon name="arrow" size={14}/>
              </summary>
              <div class="reader-comment-content">
                {#if comment.path}<p class="comment-file">{t("代码评审")} <code>{comment.path}</code></p>{/if}
                {#if comment.commitSha}<p class="reader-muted">{t("评审时版本")} <code>{comment.commitSha.slice(0, 10)}</code></p>{/if}
                {#if comment.bodyHtml}<div class="contribution-prose">{@html comment.bodyHtml}</div>{/if}
                <div class="comment-actions">{#if comment.replyToUrl}<a class="comment-permalink" href={comment.replyToUrl} target="_blank" rel="noreferrer">{t("查看回复的讨论")}<TerminalIcon name="external" size={13}/></a>{/if}
                <a class="comment-permalink" href={comment.url} target="_blank" rel="noreferrer">{t("查看这条记录")}<TerminalIcon name="external" size={13}/></a></div>
              </div>
            </details>
          {/each}
          </div>
        </section>
      {/if}
    {:else}
      <div class="reader-detail-unavailable"><p>{t("这条记录的正文尚未收录。")}</p><p>{t("你仍可以通过上方链接查看原始说明和讨论。")}</p></div>
    {/if}
  </div>
</article>
