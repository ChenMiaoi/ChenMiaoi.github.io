<script lang="ts">
import type {
	ContributionSymbol,
	ContributionTone,
} from "../../lib/contributions/presentation";
import ContributionIcon from "./ContributionIcon.svelte";
export let label: string;
export let tone: ContributionTone = "muted";
export let icon: ContributionSymbol = "info";
</script>

<span class={`contribution-status status-${tone}`}><span>{label}</span><ContributionIcon name={icon} {tone} size={16}/></span>
