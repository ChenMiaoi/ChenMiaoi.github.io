<script lang="ts">
  import { useTranslations } from "../../features/orbital/i18n/context";
  const { t, dateLocale } = useTranslations();
  import TerminalIcon from "./TerminalIcon.svelte";
  import BrandIcon from "./BrandIcon.svelte";
  import { contributionDiffLines } from "../../utils/contribution-diff";
  import type { ContributionDetail, SourceRecord } from "./types";

  export let record: SourceRecord;
  export let detail: ContributionDetail | undefined;
  export let syncedAt: string;
  let copyState = "";
  let copyAttempt = 0;
  $: kind = record.kind === "commit" ? t("提交") : record.kind === "pr" ? "PR" : "Issue";
  $: state = detail?.state ?? record.state ?? (record.draft ? "draft" : "open");
  $: stateLabel = ({ open: t("进行中"), draft: t("草稿"), merged: t("已合并"), closed: t("已关闭"), commit: t("提交记录") } as Record<string, string>)[state] ?? "";
  $: reference = detail?.sha ?? record.sha ?? String(record.number ?? record.reference);
  const date = (value: string) => value.slice(0, 10).replaceAll("-", "/");
  const discussionDate = (value: string) => new Intl.DateTimeFormat(dateLocale, { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
  const snapshotDate = (value: string) => new Intl.DateTimeFormat(dateLocale, { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
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
    <div class="reader-record-footer"><div class="reader-record-attribution">{#if detail}<span>{t("原文作者")} <b>{detail.author}</b></span>{/if}{#if record.relations?.length}<span>{record.relations.map((relation) => relation === 'author' ? t("我发起") : relation === 'assignee' ? t("指派给我") : '').filter(Boolean).join(' · ')}</span>{/if}<time datetime={detail?.updatedAt ?? record.date}>{record.kind === 'commit' ? t("提交于") : t("更新于")} {date(detail?.updatedAt ?? record.date)}</time></div>
    <div class="reader-source-links">{#if record.url}<a href={record.url} target="_blank" rel="noreferrer"><BrandIcon name="github" size={14} framed={false}/>{t("在 GitHub 查看")}<TerminalIcon name="external" size={14}/></a>{/if}{#if record.discussionUrl}<a href={record.discussionUrl} target="_blank" rel="noreferrer">{record.discussionLabel?.startsWith('PR #') ? record.discussionLabel : t("邮件讨论")}<TerminalIcon name="external" size={14}/></a>{/if}</div></div>
  </header>

  <div class="contribution-reader-scroll" tabindex="0" role="region" aria-label={t("贡献正文与改动")}>
    {#if detail}
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
          {#each detail.comments as comment}
            <details class="reader-comment">
              <summary><span><strong>{comment.author}</strong><span class="comment-kind">{comment.kind === 'review' ? reviewLabel(comment.reviewState) : comment.path ? t("行内讨论") : t("讨论")}{#if comment.bot} {t("· 机器人")}{/if}</span><time datetime={comment.createdAt}>{discussionDate(comment.createdAt)}</time><span class="comment-excerpt">{comment.excerpt || reviewLabel(comment.reviewState)}</span></span><TerminalIcon name="arrow" size={14}/></summary>
              <div class="reader-comment-content">
                {#if comment.path}<p class="comment-file">{t("代码评审")} <code>{comment.path}</code></p>{/if}
                {#if comment.commitSha}<p class="reader-muted">{t("评审时版本")} <code>{comment.commitSha.slice(0, 10)}</code></p>{/if}
                {#if comment.bodyHtml}<div class="contribution-prose">{@html comment.bodyHtml}</div>{/if}
                {#if comment.replyToUrl}<a class="comment-permalink" href={comment.replyToUrl} target="_blank" rel="noreferrer">{t("查看回复的讨论")}<TerminalIcon name="external" size={13}/></a>{/if}
                <a class="comment-permalink" href={comment.url} target="_blank" rel="noreferrer">{t("查看这条记录")}<TerminalIcon name="external" size={13}/></a>
              </div>
            </details>
          {/each}
        </section>
      {/if}
      <p class="reader-snapshot-note">{t("内容来自公开原始记录 · 同步于 {v0}（北京时间）", { v0: snapshotDate(syncedAt) })}</p>
    {:else}
      <div class="reader-detail-unavailable"><p>{t("这条记录的正文尚未收录。")}</p><p>{t("你仍可以通过上方链接查看原始说明和讨论。")}</p></div>
    {/if}
  </div>
</article>
