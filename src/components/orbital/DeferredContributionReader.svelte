<script lang="ts">
import { onMount } from "svelte";
import { useTranslations } from "../../features/orbital/i18n/context";
import type { ContributionDetail, SourceRecord } from "./types";

const { t } = useTranslations();
export let record: SourceRecord;
export let detail: ContributionDetail | undefined;
export let account = "";
export let reducedMotion = true;
let Reader: typeof import("./ContributionReader.svelte").default | undefined;
let failed = false;
let disposed = false;
async function load() {
	failed = false;
	try {
		const module = await import("./ContributionReader.svelte");
		if (!disposed) Reader = module.default;
	} catch {
		if (!disposed) failed = true;
	}
}
onMount(() => {
	void load();
	return () => {
		disposed = true;
	};
});
</script>

{#if Reader}
  <svelte:component this={Reader} {record} {detail} {account} {reducedMotion}/>
{:else if failed}
  <p class="dock-note" role="alert">{t("记录内容暂时无法读取。")}<button onclick={load}>{t("重试")}</button></p>
{:else}
  <p class="dock-note" role="status">{t("正在读取记录内容…")}</p>
{/if}
