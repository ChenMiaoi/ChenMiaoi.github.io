<script lang="ts">
  import type { ContributionSymbol, ContributionTone } from "../../lib/contributions/presentation";
  export let name: ContributionSymbol = "issue";
  export let tone: ContributionTone = "muted";
  export let size = 18;
  const circle = "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z";
  const nodes = "M8 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z M8 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z M20 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z";
  const paths: Record<ContributionSymbol, string> = {
    pr: `${nodes} M6 7v10 M18 17V9c0-3-2-4-5-4 m2-2-2 2 2 2`,
    "pr-draft": `${nodes} M6 7v10 M18 17V9c0-3-2-4-5-4`,
    "pr-merged": `${nodes} M6 7v10 M8 6c5 0 3 12 8 12`,
    "pr-closed": `${nodes} M6 7v10 m9-13 6 6 m-6 0 6-6 M18 13v4`,
    issue: `${circle} M12 7v5 M12 16h.01`,
    "issue-closed": `${circle} m-13.5 0 3 3 6-6`,
    commit: "M8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z M3 12h5 M16 12h5",
    check: `${circle} m-13.5 0 3 3 6-6`,
    cross: `${circle} m-13-4 8 8 M8 16l8-8`,
    clock: `${circle} M12 7v5l3 2`,
    warning: "m12 3 10 18H2Z M12 9v5 M12 17h.01",
    minus: `${circle} M8 12h8`,
    discussion: "M4 4h16v12h-8l-4 4v-4H4Z M8 9h8 M8 12h5",
    info: `${circle} M12 11v6 M12 7h.01`,
  };
</script>

<svg class={`contribution-icon status-${tone}`} data-symbol={name} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d={paths[name]} stroke-dasharray={name === "pr-draft" ? "2.5 2" : undefined}/>
</svg>
