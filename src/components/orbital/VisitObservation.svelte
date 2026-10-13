<script lang="ts">
import { useTranslations } from "../../features/orbital/i18n/context";
import { onMount } from "svelte";
import { parseVisitSummary, type VisitSummary } from "../../lib/analytics";
const { t, dateLocale } = useTranslations();
let summary: VisitSummary | null = null;
let unavailable = false;
let series: { date: string; visitors: number }[] = [];
let period = "—";
let updated = "";
$: series = summary?.daily ?? [];
$: maxDaily = Math.max(1, ...series.map((day) => day.visitors));
const number = (value: number | undefined) =>
	value === undefined ? "—" : new Intl.NumberFormat(dateLocale).format(value);
onMount(() => {
	const controller = new AbortController();
	fetch("https://nyachen.cn/visit-summary.json", {
		signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
	})
		.then(async (response) => {
			if (!response.ok) throw new Error("Visit summary unavailable");
			summary = parseVisitSummary(await response.json());
			const format = (timestamp: number) =>
				new Intl.DateTimeFormat(dateLocale, {
					timeZone: "Asia/Shanghai",
					month: "2-digit",
					day: "2-digit",
				}).format(timestamp);
			period = `${format(summary.startAt)} — ${format(summary.endAt)}`;
			updated = new Intl.DateTimeFormat(dateLocale, {
				timeZone: "Asia/Shanghai",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
			}).format(summary.updatedAt);
		})
		.catch(() => {
			if (!controller.signal.aborted) unavailable = true;
		});
	return () => controller.abort();
});
let panel: HTMLElement;
let trigger: HTMLButtonElement;
function dismiss(event: MouseEvent) {
	if (
		panel?.matches(":popover-open") &&
		event.target instanceof Node &&
		!panel.contains(event.target) &&
		!trigger.contains(event.target)
	)
		panel.hidePopover();
}
</script>

<svelte:document onclick={dismiss} />
<div class="visit-observation">
  <button bind:this={trigger} class="visit-trigger" popovertarget="visit-observation" aria-label={t("访问观测")}><span class="visit-signal" aria-hidden="true"></span><span>{t("近 30 天访客")}</span><strong>{number(summary?.visitors)}</strong><span aria-hidden="true">↗</span></button>
  <section bind:this={panel} id="visit-observation" popover="auto" class="visit-panel" aria-labelledby="visit-title">
    <header class="visit-heading"><span class="visit-number" aria-hidden="true">01</span><div><h2 id="visit-title">{t("访问观测")}</h2><small><span>ORBITAL</span> / {t("观测记录")}</small></div><button class="visit-close" popovertarget="visit-observation" popovertargetaction="hide" aria-label={t("关闭访问观测")}>×</button></header>
    <div class="visit-period"><span>{t("近 30 天")} / {period}</span></div>
    <div class="visit-metrics"><div><span>{t("独立访客")}</span><strong>{number(summary?.visitors)}</strong></div><div><span>{t("访问次数")}</span><strong>{number(summary?.visits)}</strong></div></div>
    <div class="visit-chart-title"><span>{t("每日访客")}</span><span>{t("近 30 天")}</span></div>
    <div class="visit-chart" role="img" aria-label={t("每日访客趋势")}>
      {#each series as day}<span style={`height:${day.visitors / maxDaily * 100}%`} title={`${day.date}: ${number(day.visitors)}`}></span>{/each}
    </div>
    <div class="visit-axis"><span>{series[0]?.date.slice(5) ?? "—"}</span><span>{series[14]?.date.slice(5) ?? "—"}</span><span>{series[29]?.date.slice(5) ?? "—"}</span></div>
    {#if unavailable}<p class="visit-note" role="status">{t("访问数据暂时无法更新")}</p>{:else if updated}<p class="visit-note">{t("更新于 {v0}", { v0: updated })}</p>{/if}
    <p class="visit-note">{t("全站匿名汇总 · 访问次数按会话统计")}</p>
  </section>
</div>

<style>
.visit-observation{margin-left:auto;flex-shrink:0}
.visit-trigger{display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 12px;color:var(--muted);background:#141c2080;border:1px solid var(--rule);border-left:2px solid var(--signal);font:12px var(--sans)}
.visit-trigger:hover{background:var(--signal-soft);border-color:var(--signal)}
.visit-trigger strong{font:18px var(--numeric);color:var(--paper);font-variant-numeric:tabular-nums}
.visit-trigger>span:last-child{color:var(--signal)}
.visit-signal{width:5px;height:5px;background:var(--signal)}
.visit-demo{font:10px var(--sans);color:var(--signal);border:1px solid #f4eb3240;padding:2px 5px;white-space:nowrap}
.visit-panel{position:fixed;inset:auto max(20px,calc((100vw - 1700px)/2 + 58px)) 90px auto;width:360px;max-width:calc(100vw - 40px);max-height:calc(100svh - 120px);overflow:auto;margin:0;padding:22px;background:linear-gradient(135deg,#20292e,#10181c);color:var(--paper);border:1px solid var(--edge);border-top:2px solid var(--signal);box-shadow:0 20px 70px #0008;clip-path:polygon(12px 0,calc(100% - 16px) 0,100% 16px,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 12px)}
.visit-panel::backdrop{background:transparent}
.visit-heading{display:flex;align-items:center;gap:12px}.visit-number{font:24px var(--numeric);color:var(--signal);padding-right:12px;border-right:1px solid var(--rule)}
.visit-heading h2{font:22px var(--display);margin:0 0 6px}.visit-heading small{font:9px var(--mono);letter-spacing:.07em;color:var(--muted)}
.visit-close{margin-left:auto;align-self:flex-start;width:32px;height:32px;border:1px solid var(--rule);background:transparent;color:var(--muted);font-size:21px}
.visit-period{margin-top:20px;display:flex;align-items:center;justify-content:space-between;gap:8px;border-block:1px solid var(--rule);padding:12px 0;color:var(--muted);font:11px var(--sans)}
.visit-metrics{display:grid;grid-template-columns:1fr 1fr;padding:22px 0}.visit-metrics>div{display:flex;flex-direction:column;gap:9px}.visit-metrics>div+div{padding-left:20px;border-left:1px solid var(--rule)}.visit-metrics span{font:12px var(--sans);color:var(--muted)}.visit-metrics strong{font:38px var(--numeric);font-variant-numeric:tabular-nums}
.visit-chart-title{display:flex;justify-content:space-between;border-top:1px solid var(--rule);padding-top:15px;font:11px var(--sans);color:var(--muted)}.visit-chart-title>span+span{font:10px var(--mono);color:var(--topic-cyan)}
.visit-chart{display:flex;gap:3px;align-items:flex-end;height:45px;margin-top:15px;background:repeating-linear-gradient(to top,transparent 0,transparent 14px,#a7b6bf12 14px,#a7b6bf12 15px)}.visit-chart>span{flex:1;background:#93cbd54d;border-top:2px solid var(--topic-cyan)}.visit-chart>span:last-child{background:#f4eb3240;border-color:var(--signal)}.visit-axis{display:flex;justify-content:space-between;margin:7px 0 16px;font:10px var(--mono);color:var(--muted)}.visit-panel .visit-note{font:11px var(--sans);line-height:1.8;color:var(--muted);margin:6px 0 0}.visit-panel .visit-note:last-child{color:var(--signal)}
@media(max-width:720px){.visit-observation{margin-left:0}.visit-trigger{gap:8px;font-size:11px;padding:6px 9px}.visit-panel{inset:auto 20px 20px auto;max-height:calc(100svh - 40px)} }
</style>
